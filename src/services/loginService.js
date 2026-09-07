const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const { sendPasswordResetOtp } = require('./emailService');


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateToken(userId) {
    return jwt.sign({ id: userId}, process.env.JWT_SECRET, {expiresIn: '7d'});
}

async function login({ email, password }) {
    const user = await User.findOne({ email });

    if (!user) {
        return { userId: null, fullname: null, role: null, message: 'User not found'};
    }

    if (!user.isActive) {
        return { userId: null, fullname: null, role: null, message: 'Your account has been deactivated. Please contact support.'};
        //DO SOMETHING ABOUT THIS
    }

    if (!user.verified) {
        return { userId: null, fullname: null, role: null, message: 'Email not verified. Please check your inbox.'}
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
        return { userId: null, fullname: null, role: null, message: 'Invalid password'};
    }

    return {
        userId: String(user._id),
        fullname: user.fullname,
        role: user.role,
        token: generateToken(user._id),
        message: 'Login successful',
    };
}

async function handleGoogleLogin(idToken) {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            return { userId: null, fullname: null, role: null, message: 'Invalid Google Toekn'};
        }

        const {email, name} = payload;

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                email,
                fullname: name,
                role: 'user',
                verified: true,
                password: '',
                provider: 'google',
            });
        }

        if (!user.isActive) {
            return {userId: null, fullname: null, role: null, message: 'Your account has been deactivated. Please contact support.'};
        }

        return {
            userId: String(user._id),
            fullname: user.fullname,
            role: user.role,
            token: generateToken(user._id),
            message: "Login successful",
        };
    } catch (err) {
        return { userId: null, fullname: null, role: null, message: `Google login failed ${err.message}`};
    }
}

async function forgotPassword(email) {
    const user = await User.findOne({email});

    if (!user) {
        return {
            success: true,
            message: "If an account exists with this email, we've sent a verification code.",
        };
    }

    //Google accounts don't have a local password
    if (user.provider === "google") {
        return {
            success: true,
            message: "If an account exists with this email, we've sent a verification code.",
        };
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    await sendPasswordResetOtp(user.email, otp);

    return {
        success: true,
        message: "If an account exists with this email, we've sent a verification code.",
    };
}


async function verifyResetOtp({ email, otp }) {
    const user = await User.findOne({ email });

    if (!user) {
        return {
            success: false,
            message: "Invalid or expired code.",
        };
    }

    if (
        user.resetPasswordOtp !== otp ||
        !user.resetPasswordOtpExpires ||
        user.resetPasswordOtpExpires < new Date()
    ) {
        return {
            success: false,
            message: "Invalid or expired code.",
        };
    }

    return {
        success: true,
        message: "Code verified successfully.",
    };
}

async function resetPassword({ email, otp, password }) {
    const user = await User.findOne({ email });
    
    if (!user) {
        return {
            success: false,
            message: "Invalid request.",
        };
    }

    if ( user.resetPasswordOtp !== otp ||
        !user.resetPasswordOtpExpires ||
        user.resetPasswordOtpExpires < new Date()
    ) {
        return {
            success: false,
            message: "Invalid or expired code.",
        };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;

    //Clear OTP after successful reset 
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;

    await user.save();
    
    return {
        success: true,
        message: "Password reset successful.",
    };
}

module.exports = { login, handleGoogleLogin, forgotPassword, verifyResetOtp, resetPassword };