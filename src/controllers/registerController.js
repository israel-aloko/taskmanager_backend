const registerService = require('../services/registerService');

async function register(req, res) {
    try {
        const registered = await registerService.register(req.body);
        res.status(201).json(registered);
    } catch (err) {
        res.status(err.status || 409).json(err.message);
    }
}

async function verify(req, res) {
    try{
        const { email, otp } = req.body;
        await registerService.verifyOtp(email, otp);
        res.status(200).send('Email verified successfully!');
    } catch (err) {
        res.status(err.status || 400).json(err.message);
    }
}

module.exports = { register, verify };