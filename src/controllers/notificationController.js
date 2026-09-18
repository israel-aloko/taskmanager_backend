const Notification = require('../models/Notification')

//GET /api/notifications/mine
//All notifictions for the logged-in user, newest first, capped at 100.
const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .populate('actor', 'fullname')
            .sort({ createdAt: -1 })
            .limit(100)

        return res.status(200).json({ notifications })
    } catch (error) {
        console.error('getMyNotifications error:', error.message)
        return res.status(500).json({ message: 'Server error fetching notifications.' })
    }
}

//PATCH /api/notifications/:id/read
// Marks a single notification as read. Used when a notification is clicked.
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user._id, //only allows users to touch their own
        })

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' })
        }

        notification.read = true
        await notification.save()

        return res.status(200).json({ notification })
    } catch (error) {
        console.error('markAsRead error:', error.message)
        return res.status(500).json({ message: 'Server error updating notificaition.' })
    }
}

//PATCH /api/notifications/read-all
// "Clear all" - marks every unread notification for this user as read.
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { $set: { read: true }}
        )

        return res.status(200).json({ message: 'All notifications marked as read'})
    } catch (error) {
        console.error('markAllAsRead error:', error.message)
        return res.status(500).json({ message: 'Server error clearing notifications.' })
    }
}

module.exports = { getMyNotifications, markAsRead, markAllAsRead }