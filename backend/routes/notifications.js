const express = require('express')
const Notification = require('../models/Notification')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
router.get('/api/notifications', requireAuth, async (request, response, next) => {
  try {
    const notifications = await Notification.find({ user: request.session.userId }).sort({ createdAt: -1 }).lean()
    return response.json({ notifications, unreadCount: notifications.filter((notification) => !notification.readAt).length })
  } catch (error) {
    return next(error)
  }
})

router.patch('/api/notifications/:notificationId/read', requireAuth, async (request, response, next) => {
  try {
    const readAt = request.body.read === false ? null : new Date()
    const notification = await Notification.findOneAndUpdate(
      { _id: request.params.notificationId, user: request.session.userId },
      { $set: { readAt } },
      { new: true },
    )
    if (!notification) return response.status(404).json({ message: 'सूचना सापडली नाही.' })
    return response.json({ notification })
  } catch (error) {
    return next(error)
  }
})

router.patch('/api/notifications/read-all', requireAuth, async (request, response, next) => {
  try {
    await Notification.updateMany({ user: request.session.userId, readAt: null }, { $set: { readAt: new Date() } })
    return response.json({ success: true })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
