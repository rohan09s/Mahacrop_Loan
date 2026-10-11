const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const dns = require('node:dns')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const Admin = require('./models/Admin')
const LoanApplication = require('./models/LoanApplication')
const Notification = require('./models/Notification')
const app = require('./app')
const { createApplicationNumber, port } = require('./config/constants')
const { setLoanDocumentsBucket } = require('./services/documentStorage')

dns.setServers(process.env.DNS_SERVERS
  ? process.env.DNS_SERVERS.split(',').map((server) => server.trim())
  : ['1.1.1.1', '8.8.8.8'])

async function start() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required. Copy .env.example to .env and configure MongoDB.')
  if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_RESET_KEY || !process.env.TWO_FACTOR_API_KEY)) {
    throw new Error('Production requires SESSION_SECRET, admin credentials, ADMIN_RESET_KEY, and TWO_FACTOR_API_KEY.')
  }
  await mongoose.connect(process.env.MONGO_URI)
  setLoanDocumentsBucket(new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'loanDocuments' }))
  await Promise.all([
    LoanApplication.updateMany({ workflowStage: { $exists: false }, status: 'submitted' }, { $set: { workflowStage: 'submitted' } }),
    LoanApplication.updateMany({ workflowStage: { $exists: false }, status: 'under-review' }, { $set: { workflowStage: 'verifying' } }),
    LoanApplication.updateMany({ workflowStage: { $exists: false }, status: 'approved' }, { $set: { workflowStage: 'forwarded' } }),
    LoanApplication.updateMany({ workflowStage: { $exists: false }, status: 'rejected' }, { $set: { workflowStage: 'returned' } }),
    Notification.updateMany({ workflowStage: { $exists: false }, type: 'submitted' }, { $set: { workflowStage: 'submitted' } }),
    Notification.updateMany({ workflowStage: { $exists: false }, type: 'approved' }, { $set: { workflowStage: 'forwarded' } }),
    Notification.updateMany({ workflowStage: { $exists: false }, type: 'rejected' }, { $set: { workflowStage: 'returned' } }),
  ])
  try {
    await Notification.collection.dropIndex('application_1')
  } catch (error) {
    if (![26, 27].includes(error.code) && !['IndexNotFound', 'NamespaceNotFound'].includes(error.codeName)) throw error
  }
  await Notification.createIndexes()
  const unnumberedApplications = await LoanApplication.find({ applicationNumber: { $exists: false } }).select('_id').lean()
  for (const application of unnumberedApplications) {
    await LoanApplication.updateOne(
      { _id: application._id, applicationNumber: { $exists: false } },
      { $set: { applicationNumber: createApplicationNumber() } },
    )
  }
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeAdmin123!'
  if (!(await Admin.exists({ username: adminUsername }))) {
    await Admin.create({ username: adminUsername, passwordHash: await bcrypt.hash(adminPassword, 12) })
    if (process.env.NODE_ENV !== 'production') console.warn(`Created development admin "${adminUsername}". Configure ADMIN_PASSWORD before deployment.`)
  }
  app.listen(port, '0.0.0.0', () => console.log(`Mahacrop Loan app listening on port ${port}`))
}

start().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
