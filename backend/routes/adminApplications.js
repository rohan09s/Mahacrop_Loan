const express = require('express')
const fs = require('node:fs')
const path = require('node:path')
const mongoose = require('mongoose')
const LoanApplication = require('../models/LoanApplication')
const Notification = require('../models/Notification')
const { requiredDocuments, uploadDirectory } = require('../config/constants')
const { requireAdmin } = require('../middleware/auth')
const { getLoanDocumentsBucket } = require('../services/documentStorage')

const router = express.Router()
router.get('/api/admin/applications', requireAdmin, async (_request, response, next) => {
  try {
    const applications = await LoanApplication.find()
      .populate('user', 'fullName mobileNumber townVillage tehsilTaluka district')
      .sort({ createdAt: -1 })
      .lean()
    return response.json({ applications })
  } catch (error) {
    return next(error)
  }
})

router.get('/api/admin/applications/:applicationId/documents/:documentName', requireAdmin, async (request, response, next) => {
  const { applicationId, documentName } = request.params
  const applicationDocumentNames = [...requiredDocuments, 'panCard']
  if (!applicationDocumentNames.includes(documentName) || !mongoose.isValidObjectId(applicationId)) return response.status(404).json({ message: 'कागदपत्र सापडले नाही.' })
  try {
    const application = await LoanApplication.findById(applicationId).select(applicationDocumentNames.join(' '))
    const document = application?.[documentName]
    if (!document) return response.status(404).json({ message: 'कागदपत्र सापडले नाही.' })
    response.set('X-Content-Type-Options', 'nosniff')

    const fileId = mongoose.isValidObjectId(document.filename) ? new mongoose.Types.ObjectId(document.filename) : null
    if (fileId && getLoanDocumentsBucket()) {
      const fileExists = await getLoanDocumentsBucket().find({ _id: fileId }).hasNext()
      if (fileExists) {
        response.type(document.mimeType)
        if (request.query.view === '1') {
          response.set('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(document.originalName))}"`)
        } else {
          response.attachment(path.basename(document.originalName))
        }
        const downloadStream = getLoanDocumentsBucket().openDownloadStream(fileId)
        downloadStream.on('error', (error) => {
          if (!response.headersSent) response.status(404).json({ message: 'फाइल उपलब्ध नाही.' })
          else response.destroy(error)
        })
        downloadStream.pipe(response)
        return
      }
    }

    const legacyPath = path.join(uploadDirectory, path.basename(document.filename))
    if (!fs.existsSync(legacyPath)) return response.status(404).json({ message: 'फाइल उपलब्ध नाही. जुनी स्थानिक फाइल GridFS मध्ये स्थलांतरित करा.' })
    if (request.query.view === '1') {
      response.type(document.mimeType)
      response.set('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(document.originalName))}"`)
      return response.sendFile(legacyPath)
    }
    return response.download(legacyPath, path.basename(document.originalName))
  } catch (error) {
    return next(error)
  }
})

const workflowActions = {
  receive: {
    from: 'submitted',
    to: 'received',
    message: (application) => `अर्ज क्रमांक ${application.applicationNumber}: प्रशासकाने तुमचा अर्ज प्राप्त करून उघडला आहे.`,
  },
  'start-verification': {
    from: 'received',
    to: 'verifying',
    status: 'under-review',
    message: (application) => `अर्ज क्रमांक ${application.applicationNumber}: प्रशासक तुमचा अर्ज आणि जोडलेली कागदपत्रे तपासत आहेत.`,
  },
  'complete-verification': {
    from: 'verifying',
    to: 'verified',
    status: 'under-review',
    message: (application) => `अर्ज क्रमांक ${application.applicationNumber}: तुमच्या अर्जाची आणि कागदपत्रांची पडताळणी पूर्ण झाली आहे.`,
  },
  forward: {
    from: 'verified',
    to: 'forwarded',
    status: 'approved',
    message: (application) => `अर्ज क्रमांक ${application.applicationNumber}: प्रशासकाने तुमचा अर्ज मंजूर करून पुढील टप्प्यासाठी पाठवला आहे.`,
  },
  return: {
    from: 'verified',
    to: 'returned',
    status: 'rejected',
    message: (application, reason) => `अर्ज क्रमांक ${application.applicationNumber}: प्रशासकाने तुमचा अर्ज दुरुस्तीसाठी परत पाठवला आहे. कारण: ${reason}`,
  },
}

router.patch('/api/admin/applications/:applicationId/review', requireAdmin, async (request, response, next) => {
  const { applicationId } = request.params
  const body = request.body || {}
  const { action } = body
  const transition = workflowActions[action]
  const reason = body.reason?.toString().trim() || ''
  if (!mongoose.isValidObjectId(applicationId) || !transition) return response.status(400).json({ message: 'अर्जाची पुढील कार्यवाही तपासा.' })
  if (action === 'return' && !reason) return response.status(400).json({ message: 'अर्ज परत पाठवण्याचे कारण लिहा.' })
  if (reason.length > 1000) return response.status(400).json({ message: 'कारण १००० अक्षरांपेक्षा कमी असावे.' })

  try {
    let application = await LoanApplication.findById(applicationId)
    if (!application) return response.status(404).json({ message: 'अर्ज सापडला नाही.' })

    if (!application.workflowStage) {
      application.workflowStage = application.status === 'approved'
        ? 'forwarded'
        : application.status === 'rejected'
          ? 'returned'
          : application.status === 'under-review'
            ? 'verifying'
            : 'submitted'
      await application.save()
    }

    if (application.workflowStage !== transition.to) {
      if (application.workflowStage !== transition.from) {
        return response.status(409).json({ message: 'अर्जाची स्थिती बदलली आहे. यादी रिफ्रेश करून पुन्हा प्रयत्न करा.' })
      }
      const update = {
        workflowStage: transition.to,
        status: transition.status || application.status,
        reviewedBy: request.session.adminId,
        reviewedAt: new Date(),
      }
      if (action === 'return') update.adminFeedback = reason
      application = await LoanApplication.findOneAndUpdate(
        { _id: application._id, workflowStage: transition.from },
        { $set: update },
        { new: true, runValidators: true },
      )
      if (!application) return response.status(409).json({ message: 'अर्जाची स्थिती बदलली आहे. यादी रिफ्रेश करून पुन्हा प्रयत्न करा.' })
    }

    const notificationMessage = transition.message(application, reason)
    const notification = await Notification.findOneAndUpdate(
      { application: application._id, workflowStage: transition.to },
      {
        $setOnInsert: {
          user: application.user,
          type: transition.to,
          workflowStage: transition.to,
          loanType: application.loanType,
          applicationNumber: application.applicationNumber,
          message: notificationMessage,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    return response.json({ application, notification })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
