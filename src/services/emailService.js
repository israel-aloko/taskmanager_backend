const { default: nodemailer } = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
    },
});

async function sendOtp(toEmail, otp) {
    await transporter.sendMail({
        from: `"Task Manager" <${process.env.MAIL_USERNAME}>`,
        to: toEmail,
        subject: 'Your Task Manager Verification Code',
        text:
        `Hi there!\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code expires in 15 minutes.\n\n` +
      `If you did not create an account, please ignore this email.\n\n` +
      `– The Team`,
    });
}

async function sendPasswordResetOtp(toEmail, otp) {
    await transporter.sendMail({
        from: `"Task Manager" <${process.env.MAIL_USERNAME}>`,
        to: toEmail,
        subject: "Your Password Reset Code",
        text:
            `Hi there!\n\n` +
            `We received a request to reset your TaskManager password.\n\n` +
            `Your password reset code is: ${otp}\n\n` +
            `This code expires in 15 minutes.\n\n` +
            `If you did not request a password reset, you can safely ignore this email.\n\n` +
            `- The Team`,
    });
}


module.exports = { sendOtp, sendPasswordResetOtp };