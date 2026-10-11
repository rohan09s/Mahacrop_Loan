const cors = require('cors')
const MongoStore = require('connect-mongo').default
const rateLimit = require('express-rate-limit')
const session = require('express-session')
const express = require('express')
const { allowedOrigins, sessionDuration } = require('../config/constants')

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })
const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false })

function configureSecurity(app) {
  app.set('trust proxy', 1)
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Frontend origin is not allowed by CORS.'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '20kb' }))
  app.use(session({
    name: 'mahacrop.sid',
    secret: process.env.SESSION_SECRET || 'local-development-session-secret-change-me',
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions', ttl: sessionDuration / 1000 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionDuration,
    },
  }))
}

module.exports = { authLimiter, configureSecurity, otpLimiter, paymentLimiter, resetLimiter }
