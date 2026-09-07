const express = require('express');
const { login, googleLogin, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/loginController');

const router = express.Router();

router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;