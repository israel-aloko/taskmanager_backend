const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
    },
    { timestamps: true}
);

joinRequestSchema.index({ project: 1, user: 1, status: 1});

module.exports = mongoose.model('JoinRequest', joinRequestSchema);