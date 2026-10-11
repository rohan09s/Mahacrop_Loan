const express = require('express')
const mongoose = require('mongoose')
const LoanApplication = require('../models/LoanApplication')
const Notification = require('../models/Notification')
const StampDutyPayment = require('../models/StampDutyPayment')
const User = require('../models/User')
const { requiredDocuments } = require('../config/constants')
const { requireAuth } = require('../middleware/auth')
const { upload } = require('../middleware/uploads')
const { deleteStoredDocument, removeUploadedFiles } = require('../services/documentStorage')

const rupeesPerHectare = 59400
const stampDutyThresholdPaise = 20000000
const stampDutyRate = 0.003
const applicationCrops = ['सोयाबीन', 'ऊस', 'हरभरा', 'तूर']
const draftIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const wizardDocumentFields = ['identityProof', 'panCard', 'landRecord712', 'landRecord8a', 'mutationRecord']

const router = express.Router()

function getSubmittedNotification(application) {
  return {
    user: application.user,
    application: application._id,
    applicationNumber: application.applicationNumber,
    type: 'submitted',
    workflowStage: 'submitted',
    loanType: 'crop-loan',
    message: `अर्ज क्रमांक ${application.applicationNumber}: तुमचा पीक कर्ज अर्ज यशस्वीरित्या जमा झाला आहे. तुमचा अर्ज तपासणीसाठी पाठवण्यात आला आहे.`,
  }
}

router.post(
  '/api/applications/wizard',
  requireAuth,
  upload.fields(wizardDocumentFields.map((name) => ({ name, maxCount: 1 }))),
  async (request, response, next) => {
  const body = request.body || {}
  const files = request.files || {}
  const removeFilesAndRespond = (status, message) => {
    removeUploadedFiles(files)
    return response.status(status).json({ message })
  }
  const draftId = body.draftId?.toString()
  const areaHectares = Number(body.cropAreaHectares)
  const loanAmountPaise = Math.round(areaHectares * rupeesPerHectare * 100)
  const stampDutyPaise = loanAmountPaise >= stampDutyThresholdPaise
    ? Math.round(loanAmountPaise * stampDutyRate)
    : 0
  const normalizeName = (name) => typeof name === 'string'
    ? name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    : ''
  const requiredTextFields = [
    body.fullName, body.townVillage, body.tehsilTaluka, body.district, body.surveyNumber,
    body.aadharName, body.panName, body.satbaraSurveyNumber, body.eightASurveyNumber,
    body.mutationSurveyNumber, body.cropSurveyNumber,
  ]

  if (wizardDocumentFields.some((field) => !files[field]?.[0]
    || files[field][0].mimetype !== 'application/pdf'
    || !files[field][0].originalname.toLowerCase().endsWith('.pdf'))) {
    return removeFilesAndRespond(400, 'कृपया सर्व आवश्यक PDF कागदपत्रे जोडा.')
  }

  if (!draftIdPattern.test(draftId || '')
    || body.loanType !== 'crop-loan'
    || body.state !== 'Maharashtra'
    || body.surveyNumber !== '158'
    || body.termsAccepted !== 'true'
    || body.aadharFetched !== 'true'
    || !Number.isFinite(areaHectares) || areaHectares <= 0 || areaHectares > 100000
    || !Number.isSafeInteger(loanAmountPaise)
    || !/^\d{12}$/.test(body.aadharNumber?.toString() || '')
    || !/^[A-Z]{5}\d{4}[A-Z]$/.test(body.panNumber?.toString().toUpperCase() || '')
    || body.panNumber?.toString().toUpperCase() !== body.cibilPanNumber?.toString().trim().toUpperCase()
    || normalizeName(body.aadharName) !== normalizeName(body.panName)
    || !normalizeName(body.aadharName)
    || !applicationCrops.includes(body.crop)
    || body.cibilChecked !== 'true'
    || Number(body.cibilScore) !== 750
    || !['yes', 'no'].includes(body.occupantClassOne)
    || !['yes', 'no'].includes(body.occupantClassTwo)
    || body.occupantClassOne === body.occupantClassTwo
    || body.occupantClassTwo === 'yes'
    || !requiredTextFields.every((value) => typeof value === 'string' && value.trim() && value.length <= 100)) {
    return removeFilesAndRespond(400, 'कृपया अर्जातील सर्व माहिती तपासून पुन्हा प्रयत्न करा.')
  }

  let application
  try {
    const user = await User.findById(request.session.userId)
    if (!user) return removeFilesAndRespond(401, 'तुमचे सत्र संपले आहे. कृपया पुन्हा लॉग इन करा.')

    let paidPayment = null
    if (stampDutyPaise > 0) {
      paidPayment = await StampDutyPayment.findOne({
        user: user._id,
        draftId,
        status: 'paid',
        loanAmountPaise,
        stampDutyPaise,
      })
      if (!paidPayment) return removeFilesAndRespond(402, 'अर्ज जमा करण्यापूर्वी मुद्रांक शुल्काचे पेमेंट पूर्ण करा.')
    } else {
      const previousPayment = await StampDutyPayment.findOne({ user: user._id, draftId, status: 'paid' })
      if (previousPayment) return removeFilesAndRespond(409, 'या अर्जासाठी आधीच पेमेंट नोंदले आहे. क्षेत्रफळ बदलले असल्यास मदतीसाठी संपर्क साधा.')
    }

    application = await LoanApplication.findOne({ user: user._id, submissionDraftId: draftId })
    if (application) {
      removeUploadedFiles(files)
    }
    if (!application) {
      try {
        const documentData = Object.fromEntries(wizardDocumentFields.map((field) => {
          const file = files[field][0]
          return [field, {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          }]
        }))
        application = await LoanApplication.create({
          user: user._id,
          submissionDraftId: draftId,
          loanType: 'crop-loan',
          workflowStage: 'submitted',
          fullName: body.fullName.trim(),
          state: body.state,
          townVillage: body.townVillage.trim(),
          tehsilTaluka: body.tehsilTaluka.trim(),
          district: body.district.trim(),
          surveyNumber: body.surveyNumber.trim(),
          aadharLastFour: body.aadharNumber.toString().slice(-4),
          panLastFour: body.panNumber.toString().toUpperCase().slice(-4),
          aadharName: body.aadharName.trim(),
          panName: body.panName.trim(),
          cibilScore: 750,
          occupantClassOne: body.occupantClassOne,
          occupantClassTwo: body.occupantClassTwo,
          satbaraSurveyNumber: body.satbaraSurveyNumber.trim(),
          eightASurveyNumber: body.eightASurveyNumber.trim(),
          mutationSurveyNumber: body.mutationSurveyNumber.trim(),
          cropSurveyNumber: body.cropSurveyNumber.trim(),
          cropAreaHectares: areaHectares,
          crop: body.crop,
          loanAmountPaise,
          stampDutyPaise,
          stampDutyPaymentId: paidPayment?.razorpayPaymentId || '',
          termsAcceptedAt: new Date(),
          ...documentData,
        })
      } catch (createError) {
        if (createError.code !== 11000) throw createError
        application = await LoanApplication.findOne({ user: user._id, submissionDraftId: draftId })
        if (!application) throw createError
        removeUploadedFiles(files)
      }
    }

    let notification = await Notification.findOne({ application: application._id, workflowStage: 'submitted' })
    if (!notification) {
      try {
        notification = await Notification.create(getSubmittedNotification(application))
      } catch (createError) {
        if (createError.code !== 11000) throw createError
        notification = await Notification.findOne({ application: application._id, workflowStage: 'submitted' })
        if (!notification) throw createError
      }
    }

    return response.status(201).json({
      applicationId: application._id,
      applicationNumber: application.applicationNumber,
      message: 'अर्ज यशस्वीरित्या जमा झाला आहे.',
      notification,
    })
  } catch (error) {
    if (!application) removeUploadedFiles(files)
    return next(error)
  }
})

router.post('/api/applications', requireAuth, upload.fields(requiredDocuments.map((name) => ({ name, maxCount: 1 }))), async (request, response, next) => {
  try {
    const files = request.files || {}
    if (requiredDocuments.some((field) => !files[field]?.[0])) {
      removeUploadedFiles(files)
      return response.status(400).json({ message: 'कृपया सर्व आवश्यक कागदपत्रे जोडा.' })
    }
    const user = await User.findById(request.session.userId)
    if (!user) {
      removeUploadedFiles(files)
      return response.status(401).json({ message: 'तुमचे सत्र संपले आहे. कृपया पुन्हा लॉग इन करा.' })
    }
    const { loanType, fullName, state, townVillage, tehsilTaluka, district, surveyNumber } = request.body
    if (loanType !== 'crop-loan' || state !== 'Maharashtra' || surveyNumber !== '158' || ![fullName, townVillage, tehsilTaluka, district].every((value) => value?.trim())) {
      removeUploadedFiles(files)
      return response.status(400).json({ message: 'कृपया अर्जातील सर्व माहिती भरा.' })
    }
    const documentData = Object.fromEntries(requiredDocuments.map((field) => {
      const file = files[field][0]
      return [field, { filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, size: file.size }]
    }))
    const application = await LoanApplication.create({
      user: user._id,
      loanType,
      workflowStage: 'submitted',
      fullName: fullName.trim(),
      state,
      townVillage: townVillage.trim(),
      tehsilTaluka: tehsilTaluka.trim(),
      district: district.trim(),
      surveyNumber,
      ...documentData,
    })

    const loanLabel = loanType === 'crop-loan'
      ? 'पीक कर्ज'
      : 'ट्रॅक्टर कर्ज'

    await Notification.create({
      user: user._id,
      application: application._id,
      applicationNumber: application.applicationNumber,
      type: 'submitted',
      workflowStage: 'submitted',
      loanType,
      message: `अर्ज क्रमांक ${application.applicationNumber}: तुमचा ${loanLabel} अर्ज यशस्वीरित्या जमा झाला आहे. तुमचा अर्ज तपासणीसाठी पाठवण्यात आला आहे.`,
    })

    return response.status(201).json({
      applicationId: application._id,
      applicationNumber: application.applicationNumber,
      message: 'अर्ज यशस्वीरित्या जमा झाला आहे.',
    })
  } catch (error) {
    removeUploadedFiles(request.files)
    return next(error)
  }
})

router.get('/api/applications/mine', requireAuth, async (request, response, next) => {
  try {
    const applications = await LoanApplication.find({ user: request.session.userId }).sort({ createdAt: -1 }).lean()
    return response.json({ applications })
  } catch (error) {
    return next(error)
  }
})

router.patch('/api/applications/mine/:applicationId', requireAuth, upload.fields(requiredDocuments.map((name) => ({ name, maxCount: 1 }))), async (request, response, next) => {
  const { applicationId } = request.params
  const files = request.files || {}
  if (!mongoose.isValidObjectId(applicationId)) {
    removeUploadedFiles(files)
    return response.status(404).json({ message: 'अर्ज सापडला नाही.' })
  }
  try {
    const application = await LoanApplication.findOne({ _id: applicationId, user: request.session.userId, status: 'submitted' })
    if (!application) {
      removeUploadedFiles(files)
      return response.status(404).json({ message: 'हा अर्ज सापडला नाही किंवा त्यात बदल करता येत नाही.' })
    }
    const { fullName, state, townVillage, tehsilTaluka, district, surveyNumber } = request.body
    if (state !== 'Maharashtra' || surveyNumber !== '158' || ![fullName, townVillage, tehsilTaluka, district].every((value) => value?.trim())) {
      removeUploadedFiles(files)
      return response.status(400).json({ message: 'कृपया अर्जातील सर्व माहिती भरा.' })
    }

    const replacedDocuments = []
    for (const field of requiredDocuments) {
      const file = files[field]?.[0]
      if (!file) continue
      replacedDocuments.push(application[field])
      application[field] = {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      }
    }
    application.fullName = fullName.trim()
    application.state = state
    application.townVillage = townVillage.trim()
    application.tehsilTaluka = tehsilTaluka.trim()
    application.district = district.trim()
    application.surveyNumber = surveyNumber
    await application.save()

    await Promise.all(replacedDocuments.map((document) => deleteStoredDocument(document)))
    return response.json({ application, message: 'अर्जातील बदल जतन केले.' })
  } catch (error) {
    removeUploadedFiles(files)
    return next(error)
  }
})

router.delete('/api/applications/mine/:applicationId', requireAuth, async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.applicationId)) return response.status(404).json({ message: 'अर्ज सापडला नाही.' })
  try {
    const application = await LoanApplication.findOne({
      _id: request.params.applicationId,
      user: request.session.userId,
      status: 'submitted',
    })
    if (!application) return response.status(404).json({ message: 'हा अर्ज सापडला नाही किंवा तो काढता येत नाही.' })
    await Promise.all(requiredDocuments.map((field) => deleteStoredDocument(application[field])))
    await application.deleteOne()
    return response.json({ success: true, message: 'अर्ज काढून टाकला.' })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
