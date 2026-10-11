const express = require('express')
const bcrypt = require('bcryptjs')
const Admin = require('../models/Admin')
const { authLimiter, resetLimiter } = require('../middleware/security')
const { establishSession, requireAdmin } = require('../middleware/auth')

const router = express.Router()
router.get('/api/admin/session', async (request, response, next) => {
  if (!request.session.adminId) return response.json({ admin: null })
  try {
    const admin = await Admin.findById(request.session.adminId).select('username')
    if (!admin) {
      request.session.destroy(() => {})
      return response.json({ admin: null })
    }
    request.session.touch()
    return response.json({ admin: { username: admin.username } })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/admin/login', authLimiter, async (request, response, next) => {
  const username = request.body.username?.toString().trim().toLowerCase()
  const password = request.body.password?.toString() || ''
  if (!username || !password) return response.status(400).json({ message: 'वापरकर्तानाव आणि पासवर्ड भरा.' })
  try {
    const admin = await Admin.findOne({ username }).select('+passwordHash')
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return response.status(401).json({ message: 'वापरकर्तानाव किंवा पासवर्ड चुकीचा आहे.' })
    await establishSession(request, { adminId: admin._id.toString() })
    return response.json({ admin: { username: admin.username } })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/admin/logout', requireAdmin, (request, response) => {
  request.session.destroy((error) => {
    if (error) return response.status(500).json({ message: 'लॉग आउट करता आले नाही.' })
    response.clearCookie('mahacrop.sid', {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return response.json({ success: true })
  })
})

router.post('/api/admin/reset-password', resetLimiter, async (request, response, next) => {
  const username = request.body.username?.toString().trim().toLowerCase()
  const recoveryKey = request.body.recoveryKey?.toString() || ''
  const password = request.body.password?.toString() || ''
  if (!username || !recoveryKey || password.length < 12) return response.status(400).json({ message: 'वापरकर्तानाव, रिकव्हरी की आणि किमान १२ अक्षरांचा पासवर्ड भरा.' })
  if (!process.env.ADMIN_RESET_KEY || recoveryKey !== process.env.ADMIN_RESET_KEY) return response.status(401).json({ message: 'रिकव्हरी की चुकीची आहे.' })
  try {
    const admin = await Admin.findOne({ username }).select('+passwordHash')
    if (!admin) return response.status(404).json({ message: 'प्रशासक खाते सापडले नाही.' })
    admin.passwordHash = await bcrypt.hash(password, 12)
    await admin.save()
    await mongoose.connection.collection('sessions').deleteMany({ 'session.adminId': admin._id.toString() })
    request.session.destroy(() => {})
    return response.json({ success: true, message: 'पासवर्ड बदलला. नव्या पासवर्डने लॉग इन करा.' })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
