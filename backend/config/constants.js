const path = require('node:path')
const crypto = require('node:crypto')

const port = Number(process.env.PORT) || 5000
const sessionDuration = 14 * 24 * 60 * 60 * 1000
const frontendBuildDirectory = path.resolve(__dirname, '../../frontend/dist')
const frontendIndexFile = path.join(frontendBuildDirectory, 'index.html')
const uploadDirectory = path.resolve(__dirname, '../private-uploads')
const requiredDocuments = ['identityProof', 'landRecord712', 'landRecord8a', 'mutationRecord', 'boundaryMap']
const defaultFrontendOrigin = process.env.RENDER_EXTERNAL_HOSTNAME ? 'https://' + process.env.RENDER_EXTERNAL_HOSTNAME : 'http://localhost:5173'
const allowedOrigins = (process.env.FRONTEND_ORIGIN || defaultFrontendOrigin)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))

function createApplicationNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return 'MCL-' + date + '-' + crypto.randomBytes(4).toString('hex').toUpperCase()
}

module.exports = { allowedOrigins, createApplicationNumber, frontendBuildDirectory, frontendIndexFile, port, requiredDocuments, sessionDuration, uploadDirectory }
