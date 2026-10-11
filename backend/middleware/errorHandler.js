const multer = require('multer')

function handleError(error, _request, response, _next) {
  console.error(error)
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'प्रत्येक फाइलचा आकार १० MB पेक्षा कमी असावा.' : 'अपलोड केलेल्या फाइल्स तपासा.' })
  }
  if (error.message?.startsWith('फक्त JPG')) return response.status(400).json({ message: error.message })
  return response.status(500).json({ message: 'सर्व्हरमध्ये त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' })
}

module.exports = { handleError }
