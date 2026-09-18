const Activity = require('../models/Activity');

//records an activity event. fire and forger by desgin. a logging failure should never break the actual request

const logActivity = async ({ project, actor, type, targetTask = null, metadata = {} }) => {
    try {
        await Activity.create({ project, actor, type, targetTask, metadata })
    } catch (error) {
        console.error('Failed to log activity:', error)

    }
}

module.exports = logActivity