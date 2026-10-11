const express = require('express')
const fs = require('node:fs')
const { frontendBuildDirectory, frontendIndexFile } = require('./config/constants')
const { configureSecurity } = require('./middleware/security')
const { handleError } = require('./middleware/errorHandler')
const healthRoutes = require('./routes/health')
const authRoutes = require('./routes/auth')
const adminAuthRoutes = require('./routes/adminAuth')
const applicationRoutes = require('./routes/applications')
const adminApplicationRoutes = require('./routes/adminApplications')
const notificationRoutes = require('./routes/notifications')
const paymentRoutes = require('./routes/payments')

const app = express()
configureSecurity(app)
app.use(healthRoutes)
app.use(authRoutes)
app.use(adminAuthRoutes)
app.use(applicationRoutes)
app.use(adminApplicationRoutes)
app.use(notificationRoutes)
app.use(paymentRoutes)
app.use(express.static(frontendBuildDirectory))
app.use((request, response, next) => {
  const isApiRequest = request.path === '/api' || request.path.startsWith('/api/')
  if (request.method === 'GET' && !isApiRequest && fs.existsSync(frontendIndexFile)) {
    return response.sendFile(frontendIndexFile)
  }
  if (isApiRequest) return response.status(404).json({ message: 'API endpoint not found.' })
  return next()
})
app.use(handleError)

module.exports = app
