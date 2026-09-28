const mongoose = require('mongoose')

const activitySchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: [
            'task_created',
            'task_status_changed',
            'task_assigned',
            'task_updated',
            'task_deleted',
            'member_joined',
            'project_created',
            'project_completed',
            'project_reopened',
            'comment_added',
        ],
        required: true,
    },
    targetTask: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        default: null,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {timestamps: true})

module.exports = mongoose.model('Activity', activitySchema)