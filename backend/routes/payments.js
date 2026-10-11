const crypto = require('node:crypto')
const express = require('express')
const Razorpay = require('razorpay')
const StampDutyPayment = require('../models/StampDutyPayment')
const { requireAuth } = require('../middleware/auth')
const { paymentLimiter } = require('../middleware/security')

const rupeesPerHectare = 59400
const stampDutyThresholdPaise = 20000000
const stampDutyRate = 0.003
const router = express.Router()

function getAmounts(areaHectares) {
  const loanAmountPaise = Math.round(areaHectares * rupeesPerHectare * 100)
  if (!Number.isSafeInteger(loanAmountPaise) || loanAmountPaise <= 0) return null
  const stampDutyPaise = loanAmountPaise >= stampDutyThresholdPaise
    ? Math.round(loanAmountPaise * stampDutyRate)
    : 0
  return { loanAmountPaise, stampDutyPaise }
}

function getPaymentResponse(payment, keyId, alreadyPaid = false) {
  return {
    keyId,
    orderId: payment.razorpayOrderId,
    amount: payment.stampDutyPaise,
    currency: 'INR',
    loanAmountPaise: payment.loanAmountPaise,
    stampDutyPaise: payment.stampDutyPaise,
    alreadyPaid,
    paymentId: payment.razorpayPaymentId || null,
  }
}

router.post('/api/payments/stamp-duty/order', requireAuth, paymentLimiter, async (request, response, next) => {
  const areaHectares = Number(request.body.areaHectares)
  const draftId = request.body.draftId?.toString()
  if (!Number.isFinite(areaHectares) || areaHectares <= 0 || areaHectares > 100000
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draftId || '')) {
    return response.status(400).json({ message: 'वैध क्षेत्रफळ आणि अर्जाचा संदर्भ आवश्यक आहे.' })
  }
  const amounts = getAmounts(areaHectares)
  if (!amounts) return response.status(400).json({ message: 'दिलेल्या क्षेत्रफळासाठी कर्जाची रक्कम मोजता येत नाही.' })
  if (amounts.stampDutyPaise === 0) {
    return response.status(400).json({ message: 'या कर्ज रकमेसाठी मुद्रांक शुल्क लागू नाही.' })
  }
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return response.status(503).json({ message: 'ऑनलाइन पेमेंट सेवा कॉन्फिगर केलेली नाही. कृपया प्रशासकाशी संपर्क साधा.' })
  }

  try {
    const existingPaid = await StampDutyPayment.findOne({
      user: request.session.userId,
      draftId,
      status: 'paid',
    })
    if (existingPaid) {
      if (existingPaid.loanAmountPaise !== amounts.loanAmountPaise) {
        return response.status(409).json({ message: 'या अर्जासाठी आधीच पेमेंट झाले आहे आणि कर्जाची रक्कम बदलली आहे. कृपया मदतीसाठी संपर्क साधा.' })
      }
      return response.json(getPaymentResponse(existingPaid, keyId, true))
    }

    const existingPending = await StampDutyPayment.findOne({
      user: request.session.userId,
      draftId,
      status: 'pending',
      loanAmountPaise: amounts.loanAmountPaise,
    })
    if (existingPending) return response.json(getPaymentResponse(existingPending, keyId))

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
    const order = await razorpay.orders.create({
      amount: amounts.stampDutyPaise,
      currency: 'INR',
      receipt: `mcl_${crypto.randomBytes(12).toString('hex')}`,
      notes: { userId: request.session.userId.toString(), draftId },
    })
    const payment = await StampDutyPayment.create({
      user: request.session.userId,
      draftId,
      areaHectares,
      loanAmountPaise: amounts.loanAmountPaise,
      stampDutyPaise: amounts.stampDutyPaise,
      razorpayOrderId: order.id,
    })
    return response.status(201).json(getPaymentResponse(payment, keyId))
  } catch (error) {
    return next(error)
  }
})

router.post('/api/payments/stamp-duty/verify', requireAuth, paymentLimiter, async (request, response, next) => {
  const orderId = request.body.razorpay_order_id?.toString()
  const paymentId = request.body.razorpay_payment_id?.toString()
  const signature = request.body.razorpay_signature?.toString()
  const draftId = request.body.draftId?.toString()
  if (!orderId || orderId.length > 100 || !paymentId || paymentId.length > 100
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draftId || '')
    || !/^[a-f0-9]{64}$/i.test(signature || '')) {
    return response.status(400).json({ message: 'पेमेंट पडताळणीसाठी आवश्यक माहिती उपलब्ध नाही.' })
  }
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) {
    return response.status(503).json({ message: 'पेमेंट पडताळणी सेवा कॉन्फिगर केलेली नाही. कृपया प्रशासकाशी संपर्क साधा.' })
  }
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest()
  const receivedSignature = Buffer.from(signature, 'hex')
  if (receivedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(receivedSignature, expectedSignature)) {
    return response.status(400).json({ message: 'पेमेंटची स्वाक्षरी पडताळता आली नाही.' })
  }

  try {
    const payment = await StampDutyPayment.findOne({
      user: request.session.userId,
      draftId,
      razorpayOrderId: orderId,
    })
    if (!payment) return response.status(404).json({ message: 'या अर्जासाठी पेमेंट ऑर्डर सापडली नाही.' })
    if (payment.status === 'paid') {
      if (payment.razorpayPaymentId !== paymentId) return response.status(409).json({ message: 'या ऑर्डरसाठी वेगळे पेमेंट आधीच नोंदले आहे.' })
      return response.json({ success: true, paymentId })
    }

    payment.status = 'paid'
    payment.razorpayPaymentId = paymentId
    payment.paidAt = new Date()
    await payment.save()
    return response.json({ success: true, paymentId })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
