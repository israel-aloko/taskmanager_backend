const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['task_assigned', 'task_status_changed', 'member_joined', 'task_deleted', 'comment_mention', 
        'comment_reply', 'comment_added', 'join_request_received', 'join_request_approved',
        'join_request_rejected'],
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
    read: {
        type: Boolean,
        default: false,
        index: true,
    },
}, {timestamps: true})

module.exports = mongoose.model('Notification', notificationSchema)