const express = require('express')
const mongoose = require('mongoose')

const router = express.Router()
router.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

module.exports = router
