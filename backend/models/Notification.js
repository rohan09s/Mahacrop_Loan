const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
  workflowStage: { type: String, enum: ['submitted', 'received', 'verifying', 'verified', 'forwarded', 'returned'], required: true },
  applicationNumber: { type: String, trim: true },
  type: { type: String, enum: ['submitted', 'received', 'verifying', 'verified', 'forwarded', 'returned', 'approved', 'rejected'], required: true },
  loanType: { type: String, enum: ['crop-loan', 'tractor-loan'], required: true },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  readAt: { type: Date, default: null },
}, { timestamps: true })

notificationSchema.index({ application: 1, workflowStage: 1 }, { unique: true })

module.exports = mongoose.model('Notification', notificationSchema)