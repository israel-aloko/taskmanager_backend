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
        owner: {
            type: mongoose.Schema.Tyoes.ObjectId,
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);