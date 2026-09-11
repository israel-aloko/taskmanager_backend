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

//this will link to the invite page. If the recipient has no account, that page 
// (or a prompt on it) sends them to a normal /register - no auto-join,
//  they just sign up like anyone else, then they see the pending invite once logged in.

async function sendProjectInvite(toEmail, { projectName, inviterName, token }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/invites/${token}`;

    await transporter.sendMail({
        from: `"Task Manager" <${process.env.MAIL_USERNAME}>`,
        to: toEmail,
        subject: `${inviterName} invited you to join "${projectName}" on Task Manger`,
        text:
            `Hi there!\n\n` +
            `${inviterName} has invited you to join the project "${projectName}" on Task Manager.\n\n` +
            `Click the link below to view the invite. If you don't have an account yet, ` +
            `you'll be asked to sign up first — once you're logged in, you'll be able to accept or decline:\n` +
            `${link}\n\n` +
            `This invite expires in 7 days.\n\n` +
            `If you weren't expecting this, you can safely ignore this email.\n\n` +
            `– The Team`,
    });
}
module.exports = { sendOtp, sendPasswordResetOtp, sendProjectInvite };