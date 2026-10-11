const crypto = require('node:crypto')
const path = require('node:path')
const multer = require('multer')
const { getLoanDocumentsBucket } = require('../services/documentStorage')

const gridFsStorage = {
  _handleFile(_request, file, callback) {
    const bucket = getLoanDocumentsBucket()
    if (!bucket) return callback(new Error('कागदपत्र साठवणूक सेवा उपलब्ध नाही.'))
    const storedName = crypto.randomUUID() + path.extname(file.originalname).toLowerCase()
    const uploadStream = bucket.openUploadStream(storedName, {
      metadata: { originalName: file.originalname, mimeType: file.mimetype },
    })
    let size = 0
    file.stream.on('data', (chunk) => { size += chunk.length })
    file.stream.on('error', callback)
    uploadStream.on('error', (error) => {
      bucket.delete(uploadStream.id).catch(() => {})
      callback(error)
    })
    uploadStream.on('finish', () => callback(null, {
      id: uploadStream.id,
      filename: uploadStream.id.toString(),
      originalname: file.originalname,
      mimetype: file.mimetype,
      size,
    }))
    file.stream.pipe(uploadStream)
  },
  _removeFile(_request, file, callback) {
    const bucket = getLoanDocumentsBucket()
    if (!file.id || !bucket) return callback(null)
    bucket.delete(file.id).then(() => callback(null), callback)
  },
}

const upload = multer({
  storage: gridFsStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_request, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) {
      return callback(new Error('फक्त JPG, PNG, WEBP किंवा PDF फाइल्स अपलोड करता येतात.'))
    }
    return callback(null, true)
  },
})

module.exports = { upload }
