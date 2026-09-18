const Notification = require('../models/Notification')

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

        await Notification.insertMany(docs)
    } catch (error) {
        console.error('Failed to create notifications:', error)
    }
}

module.exports = notifyUsers