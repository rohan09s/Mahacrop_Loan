const mongoose = require('mongoose')

const stampDutyPaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  draftId: { type: String, required: true, trim: true, maxlength: 36 },
  areaHectares: { type: Number, required: true, min: 0 },
  loanAmountPaise: { type: Number, required: true, min: 1 },
  stampDutyPaise: { type: Number, required: true, min: 1 },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending', required: true },
  paidAt: { type: Date },
}, { timestamps: true })

stampDutyPaymentSchema.index({ user: 1, draftId: 1, status: 1 })

module.exports = mongoose.model('StampDutyPayment', stampDutyPaymentSchema)
