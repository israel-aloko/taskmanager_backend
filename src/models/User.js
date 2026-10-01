const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true},
    email: { type: String, required: true, unique: true, lowercase: true, trim: true},
    password: { type: String, default: ''},
    role: { type: String, enum: ['user'], default: 'user'},
    verified: { type: Boolean, default: false },
    provider: { type: String, default: 'local' },
    isActive: { type: Boolean, default: true},
    profilePicture: { type: String, default: null },
    avatarPublicId: { type: String, default: null},
    jobTitle: { type: String, default: '', trim: true, maxlength: 60 },
    bio: { type: String, default: '', trim: true, maxlength: 300 },
    timezone: { type: String, default: 'UTC'},

    resetPasswordOtp: {type: String, default: null},
    resetPasswordOtpExpires: {type: Date, default: null}

}, {timestamps: true});

module.exports = mongoose.model('User', userSchema);