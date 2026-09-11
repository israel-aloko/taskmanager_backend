const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const VerificationToken = require('../models/VerificationToken');
const { sendOtp } = require('./emailService');

const SALT_ROUNDS = 10;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

async function register({ fullname, email, password, role }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        const err = new Error('User already exists');
        err.status = 409;
        throw err;
    }

    if (!PASSWORD_REGEX.test(password)) {
        const err = new Error('Your password MUST be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.');
        err.status = 400;
        throw err;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const otp = crypto.randomInt(100000, 999999).toString();

    await VerificationToken.deleteMany({ email });
    await VerificationToken.create({
        email,
        otp,
        fullname,
        password: hashedPassword,
        role: 'user',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await sendOtp(email, otp);

    return { email, message: 'OTP sent. Please verify to complete registration.'};
}

//user submits otp
async function verifyOtp(email, otp) {
    const token = await VerificationToken.findOne({ email, otp });

    if (!token) {
        const err = new Error('Invalid OTP');
        err.status = 400;
        throw err;
    }

    if (token.expiresAt < new Date()) {
        const err = new Error('OTP has expired');
        err.status = 400;
        throw err;
    }

    const user = await User.create({
        fullname: token.fullname,
        email: token.email,
        password: token.password,
        role: token.role,
        verified: true,
    });

    await VerificationToken.deleteMany({ email });
    
    return {
        userId: String(user._id),
        fullname: user.fullname,
        role: user.role,
    };
}

module.exports = { register, verifyOtp };