const { publicUser } = require('../utils/users')

function normalizeMobile(value) {
  return value?.toString().trim().replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)))
}

function establishSession(request, values) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError)
      Object.assign(request.session, values)
      request.session.save((saveError) => saveError ? reject(saveError) : resolve())
    })
  })
}

function requireAuth(request, response, next) {
  if (!request.session.userId) return response.status(401).json({ message: 'कृपया आधी लॉग इन करा.' })
  return next()
}

function requireAdmin(request, response, next) {
  if (!request.session.adminId) return response.status(401).json({ message: 'प्रशासक म्हणून लॉग इन करा.' })
  return next()
}

module.exports = { establishSession, normalizeMobile, requireAdmin, requireAuth, publicUser }
