const fs = require('node:fs')
const path = require('node:path')
const mongoose = require('mongoose')
const { uploadDirectory } = require('../config/constants')

let loanDocumentsBucket

function setLoanDocumentsBucket(bucket) {
  loanDocumentsBucket = bucket
}

function getLoanDocumentsBucket() {
  return loanDocumentsBucket
}

function removeUploadedFiles(files) {
  Object.values(files || {}).flat().forEach((file) => {
    if (file.id && loanDocumentsBucket) loanDocumentsBucket.delete(file.id).catch(() => {})
    else if (file.path) fs.rm(file.path, { force: true }, () => {})
  })
}

async function deleteStoredDocument(document) {
  if (!document?.filename) return
  if (mongoose.isValidObjectId(document.filename) && loanDocumentsBucket) {
    await loanDocumentsBucket.delete(new mongoose.Types.ObjectId(document.filename)).catch(() => {})
    return
  }
  await fs.promises.rm(path.join(uploadDirectory, path.basename(document.filename)), { force: true })
}

module.exports = { deleteStoredDocument, getLoanDocumentsBucket, removeUploadedFiles, setLoanDocumentsBucket }
