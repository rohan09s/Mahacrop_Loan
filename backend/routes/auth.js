const express = require('express')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { authLimiter, otpLimiter } = require('../middleware/security')
const { establishSession, normalizeMobile, publicUser, requireAuth } = require('../middleware/auth')

const router = express.Router()
router.get('/api/auth/session', async (request, response, next) => {
  if (!request.session.userId) return response.json({ user: null })
  try {
    const user = await User.findById(request.session.userId)
    if (!user) {
      request.session.destroy(() => {})
      return response.json({ user: null })
    }
    request.session.touch()
    return response.json({ user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/otp/send', otpLimiter, async (request, response, next) => {
  const mobileNumber = normalizeMobile(request.body.mobileNumber)
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) return response.status(400).json({ message: 'वैध १० अंकी मोबाईल क्रमांक भरा.' })
  if (!process.env.TWO_FACTOR_API_KEY) return response.status(503).json({ message: 'OTP सेवा कॉन्फिगर केलेली नाही. कृपया प्रशासकाशी संपर्क साधा.' })
  try {
    const providerResponse = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(process.env.TWO_FACTOR_API_KEY)}/SMS/${mobileNumber}/AUTOGEN`)
    const providerResult = await providerResponse.json()
    if (!providerResponse.ok || providerResult.Status !== 'Success' || !providerResult.Details) {
      console.error('2Factor OTP send failed:', providerResult.Status || providerResponse.status)
      return response.status(502).json({ message: 'OTP पाठवता आला नाही. मोबाईल क्रमांक तपासून पुन्हा प्रयत्न करा.' })
    }
    request.session.pendingOtp = {
      mobileNumber,
      sessionId: providerResult.Details,
      expiresAt: Date.now() + 5 * 60 * 1000,
    }
    await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    return response.json({ message: 'तुमच्या मोबाईलवर OTP पाठवला आहे.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/otp/verify', otpLimiter, async (request, response, next) => {
  const mobileNumber = normalizeMobile(request.body.mobileNumber)
  const otp = request.body.otp?.toString().trim().replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
  const pendingOtp = request.session.pendingOtp
  if (!/^[6-9]\d{9}$/.test(mobileNumber || '') || !/^\d{4,8}$/.test(otp || '')) {
    return response.status(400).json({ message: 'वैध मोबाईल क्रमांक आणि OTP भरा.' })
  }
  if (!pendingOtp || pendingOtp.mobileNumber !== mobileNumber || pendingOtp.expiresAt < Date.now()) {
    delete request.session.pendingOtp
    return response.status(400).json({ message: 'OTP सत्र कालबाह्य झाले. नवीन OTP मागवा.' })
  }
  try {
    const providerResponse = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(process.env.TWO_FACTOR_API_KEY)}/SMS/VERIFY/${encodeURIComponent(pendingOtp.sessionId)}/${encodeURIComponent(otp)}`)
    const providerResult = await providerResponse.json()
    if (!providerResponse.ok || providerResult.Status !== 'Success') {
      return response.status(400).json({ message: 'OTP चुकीचा किंवा कालबाह्य आहे.' })
    }

    const user = await User.findOne({ mobileNumber }).select('+passwordHash')
    delete request.session.pendingOtp
    if (user) {
      await establishSession(request, { userId: user._id.toString() })
      return response.json({ user: publicUser(user), needsProfile: false, needsPassword: !user.passwordHash })
    }
    request.session.verifiedMobileNumber = mobileNumber
    request.session.verifiedAt = Date.now()
    await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    return response.json({ needsProfile: true })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/password/reset/send', otpLimiter, async (request, response, next) => {
  const mobileNumber = normalizeMobile(request.body.mobileNumber)
  if (!/^[6-9]\d{9}$/.test(mobileNumber || '')) return response.status(400).json({ message: 'वैध १० अंकी मोबाईल क्रमांक भरा.' })
  if (!process.env.TWO_FACTOR_API_KEY) return response.status(503).json({ message: 'OTP सेवा कॉन्फिगर केलेली नाही. कृपया प्रशासकाशी संपर्क साधा.' })

  try {
    const user = await User.findOne({ mobileNumber }).select('_id')
    if (user) {
      const providerResponse = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(process.env.TWO_FACTOR_API_KEY)}/SMS/${mobileNumber}/AUTOGEN`)
      const providerResult = await providerResponse.json()
      if (!providerResponse.ok || providerResult.Status !== 'Success' || !providerResult.Details) {
        console.error('2Factor password reset OTP send failed:', providerResult.Status || providerResponse.status)
        return response.status(502).json({ message: 'OTP पाठवता आला नाही. मोबाईल क्रमांक तपासून पुन्हा प्रयत्न करा.' })
      }
      request.session.pendingPasswordResetOtp = {
        userId: user._id.toString(),
        mobileNumber,
        sessionId: providerResult.Details,
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
      await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    }
    return response.json({ message: 'जर हा मोबाईल क्रमांक नोंदणीकृत असेल, तर त्यावर पासवर्ड रीसेट OTP पाठवला आहे.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/password/reset/verify', otpLimiter, async (request, response, next) => {
  const mobileNumber = normalizeMobile(request.body.mobileNumber)
  const otp = request.body.otp?.toString().trim().replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
  const pendingOtp = request.session.pendingPasswordResetOtp
  if (!/^[6-9]\d{9}$/.test(mobileNumber || '') || !/^\d{4,8}$/.test(otp || '')) {
    return response.status(400).json({ message: 'वैध मोबाईल क्रमांक आणि OTP भरा.' })
  }
  if (!pendingOtp || pendingOtp.mobileNumber !== mobileNumber || pendingOtp.expiresAt < Date.now()) {
    delete request.session.pendingPasswordResetOtp
    return response.status(400).json({ message: 'OTP सत्र कालबाह्य झाले. नवीन OTP मागवा.' })
  }

  try {
    const providerResponse = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(process.env.TWO_FACTOR_API_KEY)}/SMS/VERIFY/${encodeURIComponent(pendingOtp.sessionId)}/${encodeURIComponent(otp)}`)
    const providerResult = await providerResponse.json()
    if (!providerResponse.ok || providerResult.Status !== 'Success') {
      return response.status(400).json({ message: 'OTP चुकीचा किंवा कालबाह्य आहे.' })
    }
    const user = await User.findOne({ _id: pendingOtp.userId, mobileNumber })
    if (!user) {
      delete request.session.pendingPasswordResetOtp
      return response.status(400).json({ message: 'पासवर्ड रीसेट करता आला नाही. पुन्हा OTP मागवा.' })
    }
    delete request.session.pendingPasswordResetOtp
    request.session.verifiedPasswordReset = { userId: user._id.toString(), verifiedAt: Date.now() }
    await new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    return response.json({ message: 'मोबाईल क्रमांक पडताळला. नवीन पासवर्ड तयार करा.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/password/reset/complete', authLimiter, async (request, response, next) => {
  const password = request.body.password?.toString()
  const verifiedReset = request.session.verifiedPasswordReset
  if (!verifiedReset || Date.now() - verifiedReset.verifiedAt > 10 * 60 * 1000) {
    delete request.session.verifiedPasswordReset
    return response.status(401).json({ message: 'पासवर्ड रीसेटची पडताळणी कालबाह्य झाली. पुन्हा OTP पडताळा.' })
  }
  if (!password || password.length < 8 || password.length > 128) {
    return response.status(400).json({ message: 'पासवर्डमध्ये किमान ८ आणि जास्तीत जास्त १२८ अक्षरे असावीत.' })
  }
  try {
    const user = await User.findById(verifiedReset.userId).select('+passwordHash')
    if (!user) {
      delete request.session.verifiedPasswordReset
      return response.status(401).json({ message: 'खाते सापडले नाही. पुन्हा OTP पडताळा.' })
    }
    user.passwordHash = await bcrypt.hash(password, 12)
    await user.save()
    await establishSession(request, { userId: user._id.toString() })
    return response.json({ user: publicUser(user), message: 'पासवर्ड यशस्वीरित्या बदलला आहे.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/complete-registration', authLimiter, async (request, response, next) => {
  const { fullName, townVillage, tehsilTaluka, district } = request.body
  const password = request.body.password?.toString()
  const mobileNumber = request.session.verifiedMobileNumber
  if (!mobileNumber || !request.session.verifiedAt || Date.now() - request.session.verifiedAt > 10 * 60 * 1000) {
    return response.status(401).json({ message: 'मोबाईल पडताळणी कालबाह्य झाली. पुन्हा OTP पडताळा.' })
  }
  if (![fullName, townVillage, tehsilTaluka, district].every((value) => value?.toString().trim())) {
    return response.status(400).json({ message: 'कृपया सर्व माहिती भरा.' })
  }
  if (!password || password.length < 8 || password.length > 128) {
    return response.status(400).json({ message: 'पासवर्डमध्ये किमान ८ आणि जास्तीत जास्त १२८ अक्षरे असावीत.' })
  }
  try {
    let user = await User.findOne({ mobileNumber }).select('+passwordHash')
    if (user) {
      await establishSession(request, { userId: user._id.toString() })
      return response.json({ user: publicUser(user), needsPassword: !user.passwordHash })
    }
    user = await User.create({
      fullName: fullName.trim(), mobileNumber, townVillage: townVillage.trim(),
      tehsilTaluka: tehsilTaluka.trim(), district: district.trim(),
      passwordHash: await bcrypt.hash(password, 12),
    })
    await establishSession(request, { userId: user._id.toString() })
    return response.status(201).json({ user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/password/login', authLimiter, async (request, response, next) => {
  const mobileNumber = normalizeMobile(request.body.mobileNumber)
  const password = request.body.password?.toString() || ''
  if (!/^[6-9]\d{9}$/.test(mobileNumber || '') || !password) {
    return response.status(400).json({ message: 'वैध मोबाईल क्रमांक आणि पासवर्ड भरा.' })
  }
  try {
    const user = await User.findOne({ mobileNumber }).select('+passwordHash')
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ message: 'मोबाईल क्रमांक किंवा पासवर्ड चुकीचा आहे. OTP नेही लॉग इन करू शकता.' })
    }
    await establishSession(request, { userId: user._id.toString() })
    return response.json({ user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/password/set', requireAuth, authLimiter, async (request, response, next) => {
  const password = request.body.password?.toString()
  if (!password || password.length < 8 || password.length > 128) {
    return response.status(400).json({ message: 'पासवर्डमध्ये किमान ८ आणि जास्तीत जास्त १२८ अक्षरे असावीत.' })
  }
  try {
    const user = await User.findById(request.session.userId).select('+passwordHash')
    if (!user) return response.status(401).json({ message: 'तुमचे सत्र संपले आहे. कृपया पुन्हा लॉग इन करा.' })
    if (user.passwordHash) return response.status(409).json({ message: 'या खात्यासाठी पासवर्ड आधीच तयार केला आहे.' })
    user.passwordHash = await bcrypt.hash(password, 12)
    await user.save()
    return response.json({ user: publicUser(user), message: 'पासवर्ड तयार केला आहे.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/api/auth/logout', (request, response) => {
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

module.exports = router
