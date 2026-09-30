const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member',
        },
    },
    { _id: false}
);

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Project name is required.'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        deadline: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'completed'],
            default: 'active',
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        members: {
            type: [memberSchema],
            default: [],
        },

        joinCode: {
            type: String,
            unique: true,
            sparse: true, //allows multiple docs with no joinCode without violating uniqueness.
        },
        reminders: {
            dayBefore: {type: Boolean, default: false},
            dueToday: {type: Boolean, default: false},
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);