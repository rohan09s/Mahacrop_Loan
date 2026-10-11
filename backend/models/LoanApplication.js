const mongoose = require('mongoose')
const crypto = require('node:crypto')

function createApplicationNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `MCL-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false })

const loanApplicationSchema = new mongoose.Schema({
  applicationNumber: { type: String, unique: true, sparse: true, default: createApplicationNumber },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  loanType: { type: String, enum: ['crop-loan', 'tractor-loan'], required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, trim: true, default: '' },
  townVillage: { type: String, required: true, trim: true, maxlength: 100 },
  tehsilTaluka: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, required: true, trim: true, maxlength: 100 },
  surveyNumber: { type: String, trim: true, default: '' },
  submissionDraftId: { type: String, trim: true, maxlength: 36 },
  aadharLastFour: { type: String, trim: true, maxlength: 4 },
  panLastFour: { type: String, trim: true, maxlength: 4 },
  aadharName: { type: String, trim: true, maxlength: 100 },
  panName: { type: String, trim: true, maxlength: 100 },
  cibilScore: { type: Number, min: 300, max: 900 },
  occupantClassOne: { type: String, enum: ['yes', 'no'] },
  occupantClassTwo: { type: String, enum: ['yes', 'no'] },
  satbaraSurveyNumber: { type: String, trim: true, maxlength: 100 },
  eightASurveyNumber: { type: String, trim: true, maxlength: 100 },
  mutationSurveyNumber: { type: String, trim: true, maxlength: 100 },
  cropSurveyNumber: { type: String, trim: true, maxlength: 100 },
  cropAreaHectares: { type: Number, min: 0 },
  crop: { type: String, enum: ['सोयाबीन', 'ऊस', 'हरभरा', 'तूर'] },
  loanAmountPaise: { type: Number, min: 1 },
  stampDutyPaise: { type: Number, min: 0 },
  stampDutyPaymentId: { type: String, trim: true },
  termsAcceptedAt: { type: Date },
  identityProof: { type: documentSchema, required: false },
  panCard: { type: documentSchema, required: false },
  landRecord712: { type: documentSchema, required: false },
  landRecord8a: { type: documentSchema, required: false },
  mutationRecord: { type: documentSchema, required: false },
  boundaryMap: { type: documentSchema, required: false },
  status: { type: String, enum: ['submitted', 'under-review', 'approved', 'rejected'], default: 'submitted' },
  workflowStage: { type: String, enum: ['submitted', 'received', 'verifying', 'verified', 'forwarded', 'returned'] },
  adminFeedback: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: { type: Date },
}, { timestamps: true })

loanApplicationSchema.index(
  { user: 1, submissionDraftId: 1 },
  { unique: true, partialFilterExpression: { submissionDraftId: { $type: 'string' } } },
)

module.exports = mongoose.model('LoanApplication', loanApplicationSchema)