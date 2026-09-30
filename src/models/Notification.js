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
        default: null,
    },
    type: {
        type: String,
        enum: ['task_assigned', 'task_status_changed', 'member_joined', 'task_deleted', 'comment_mention', 
        'comment_reply', 'comment_added', 'join_request_received', 'join_request_approved',
        'join_request_rejected', 
        'task_unassigned', 'task_updated', 'task_deadline_approaching', 'task_due_today',
        'project_deadline_approaching', 'project_due_today', 'member_role_changed', 'member_removed',
        'project_completed', 'project_reopened', 'project_deleted', 'member_left'],
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