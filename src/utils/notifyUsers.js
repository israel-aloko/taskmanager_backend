const Notification = require('../models/Notification');
const { getIO } = require('../socket'); 
//creates notifications for one or more recipients.
//fire-and-forget - a failure here should never break the primary action.
//automatically excludes the actor from the recipient list.
const notifyUsers = async ({ recipients, project, actor, type, targetTask = null, metadata = {} }) => {
    try {
        //never notify the person who performed the action
        const filteredRecipients = recipients.filter(
            (r) => r && r.toString() !== actor.toString()
        )

        if (filteredRecipients.length === 0) return 

        const docs = filteredRecipients.map((recipient) => ({
            recipient,
            project,
            actor,
            type,
            targetTask,
            metadata,
        }))

        const created = await Notification.insertMany(docs)

        const populated = await Notification.populate(created, {
            path: 'actor',
            select: 'fullname',
        })

        //emit each notification to its recipient's personal room
        try {
            const io = getIO()
            populated.forEach((notification) => {
                io.to(notification.recipient.toString()).emit('new_notification', notification)
            })
        } catch (socketError) {
            console.error('Socket emit failed:', socketError.message)
        }

        // await Notification.insertMany(docs)
    } catch (error) {
        console.error('Failed to create notifications:', error)
    }
}

module.exports = notifyUsers