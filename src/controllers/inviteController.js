const crypto = require('crypto');
const Invite = require('../models/Invite');
const User = require('../models/User');
const { sendProjectInvite } = require('../services/emailService');
const logActivity = require('../utils/logActivity');
const notifyUsers = require('../utils/notifyUsers');

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/projects/:id/invites
// Admin only (requireProjectMember + requireProjectAdmin already ran).
const sendInvite = async (req, res) => {
    try {
        const { email } = req.body;
        const project = req.project;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'An email address is required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // if user is already a member, 
        const targetUser = await User.findOne({ email: normalizedEmail });
        if (targetUser) {
            const alreadyMember = project.members.some(
                (m) => m.user.toString() === targetUser._id.toString()
            );
            if (alreadyMember) {
                return res.status(400).json({ message: 'This user is already a member of the project.' });
            }
        }
        // if the user has a pending invite to this project:
        const existingInvite = await Invite.findOne({
            project: project._id,
            email: normalizedEmail,
            status: 'pending',
        });
        if (existingInvite) {
            return res.status(400).json({ message: 'An invite is already pending for this email.' });
        }

        const token = crypto.randomBytes(32).toString('hex');

        const invite = await Invite.create({
            project: project._id,
            email: normalizedEmail,
            invitedBy: req.user._id,
            token,
            expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
        });

        await sendProjectInvite(normalizedEmail, {
            projectName: project.name,
            inviterName: req.user.fullname,
            token,
        });

        return res.status(201).json({ message: 'Invite sent successfully.', invite });
    } catch (error) {
        console.error('sendInvite error:', error.message);
        return res.status(500).json({ message: 'Server error sending invite.' });
    }
};

//GET /api/invites/mine
//Invites addressed to the logged-in user's email, still pending.
const getMyInvites = async (req, res) => {
    try {
        const invites = await Invite.find({
            email: req.user.email.toLowerCase(),
            status: 'pending',
        })
            .populate('project', 'name description deadline')
            .populate('invitedBy', 'fullname email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ invites });
    } catch (error) {
        console.error('getMyInvites error:', error.message);
        return res.status(500).json({ message: 'Server error fetching invites.' });
    }
};

//GET /api/invites/:token
//Public - no auth required.
//before the visitor even logs in. Does not mutate anything (except auto-expiring a stale invite).
const getInviteByToken = async (req, res) => {
    try {
        const { token } = req.params;

        const invite = await Invite.findOne({ token })
            .populate('project', 'name description')
            // .populate('project', 'name description members')
            .populate('invitedBy', 'fullname');

        if (!invite) {
            return res.status(404).json({ message: 'Invite not found.' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ message: `This invite has already been ${invite.status}.` });
        }

        if (invite.expiresAt < new Date()) {
            invite.status = 'expired';
            await invite.save();
            return res.status(400).json({ message: 'This invite has expired.' });
        }

        //lets the frontend decide between "log in" and "create an account"
        //without needing a second, separate request.
        const existingUser = await User.findOne({ email: invite.email });

        return res.status(200).json({
            invite: {
                token: invite.token,
                email: invite.email,
                project: invite.project,
                invitedBy: invite.invitedBy,
                expiresAt: invite.expiresAt,
                hasAccount: Boolean(existingUser),
            },
        });
    } catch (error) {
        console.error('getInviteByToken error:', error.message);
        return res.status(500).json({ message: 'Server error fetching invite.' });
    }
};

//POST /api/invites/:token/accept
const acceptInvite = async (req, res) => {
    try {
        const { token } = req.params;

        const invite = await Invite.findOne({ token }).populate('project', 'name description members');

        if (!invite) {
            return res.status(404).json({ message: 'Invite not found.' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ message: `This invite has already been ${invite.status}.` });
        }

        if (invite.expiresAt < new Date()) {
            invite.status = 'expired';
            await invite.save();
            return res.status(400).json({ message: 'This invite has expired.' });
        }

        if (invite.email !== req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'This invite was not sent to your email address.' });
        }

        const project = invite.project;

        const alreadyMember = project.members.some(
            (m) => m.user.toString() === req.user._id.toString()
        );

        if (!alreadyMember) {
            project.members.push({ user: req.user._id, role: 'member' });
            await project.save();

            await logActivity({
                project: project._id,
                actor: req.user._id,
                type: 'member_joined',
                metadata: { via: 'invite' },
            });

            const adminIds = project.members
                .filter((m) => m.role === 'admin')
                .map((m) => m.user);

            await notifyUsers({
                recipients: adminIds,
                project: project._id,
                actor: req.user._id,
                type: 'member_joined',
                metadata: { via: 'invite' },
            });
        }

        invite.status = 'accepted';
        await invite.save();

        return res.status(200).json({ message: 'Invite accepted. You have joined the project.', project });
    } catch (error) {
        console.error('acceptInvite error:', error.message);
        return res.status(500).json({ message: 'Server error accepting invite.' });
    }
};

//POST /api/invites/:token/decline
const declineInvite = async (req, res) => {
    try {
        const { token } = req.params;

        const invite = await Invite.findOne({ token });

        if (!invite) {
            return res.status(404).json({ message: 'Invite not found.' });
        }

        if (invite.status !== 'pending') {
            return res.status(400).json({ message: `This invite has already been ${invite.status}.` });
        }

        if (invite.email !== req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'This invite was not sent to your email address.' });
        }

        invite.status = 'declined';
        await invite.save();

        return res.status(200).json({ message: 'Invite declined.' });
    } catch (error) {
        console.error('declineInvite error:', error.message);
        return res.status(500).json({ message: 'Server error declining invite.' });
    }
};

module.exports = { sendInvite, getMyInvites, getInviteByToken, acceptInvite, declineInvite };