const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        status: {
            type: String,
            enum: ['todo', 'in-progress', 'done'],
            default: 'todo',
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },
        deadline: {
            type: Date,
            default: null,
        },
        reminders: {
            dayBefore: { type: Boolean, default: false },
            dueToday: { type: Boolean, default: false },
        },
        completedAt: {
            type: Date,
            default: null,
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    { timestamps: true }
);

//speeds up "Assigned to Me" cross-project queries (Task.find({ assignedTo:}))
taskSchema.index({ assignedTo: 1 });

// Speeds up project board queries (Task.find({ project: projectId }) and
// Task.find({ project: projectId, status: 'todo' }) for per-column filtering)
taskSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);