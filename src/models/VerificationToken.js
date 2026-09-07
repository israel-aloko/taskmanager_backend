const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: String, required: true },
    fullname: { type: String, required: true},
    password: { type: String, required: true},
    role: { type: String, default: 'user'},
    expiresAt: { type: Date, required: true},
});

//mongodb ttl index: automatically deletes the document once expiresAt passes
verificationTokenSchema.index({ expiresAt: 1}, { expireAfterSeconds: 0});

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);