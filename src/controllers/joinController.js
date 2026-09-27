const Project = require('../models/Project');
const JoinRequest = require('../models/JoinRequest');
const generateJoinCode = require('../config/generateJoinCode');
const logActivity = require('../utils/logActivity');
const notifyUsers = require('../utils/notifyUsers');

//generates a unique joinCode
async function generateUniqueJoinCode() {
    let code;
    let exists = true;

    while (exists) {
        code = generateJoinCode();
        exists = await Project.exists({ joinCode: code });
    }

    return code;
}

const getAdminIds = (project, excludeUserId) =>
    project.members
        .filter((m) => m.role === 'admin')
        .map((m) => m.user)
        .filter((id) => !excludeUserId || id.toString() !== excludeUserId.toString());

const safeNotify = async (payload) => {
    try {
        await notifyUsers(payload);
    } catch (error) {
        console.error('notification error:', error.message);
    }
};

//GET /api/projects/:id/join-code
//Admin only. Returns the existing code, or generates one on first request.
const getJoinCode = async (req, res) => {
    try {
        const project = req.project;

        if (!project.joinCode) {
            project.joinCode = await generateUniqueJoinCode();
            await project.save();
        }

        return res.status(200).json({ joinCode: project.joinCode });
    } catch (error) {
        console.error('getJoinCode error:', error.message);
        return res.status(500).json({ message: 'Server error fetching join code.' });
    }
};

//POST /api/project/:id/regenerate-code
//Admin only. Always issue a fresh code, invalidating the old one.
const regenerateJoinCode = async (req, res) => {
    try {
        const project = req.project;

        project.joinCode = await generateUniqueJoinCode();
        await project.save();

        return res.status(200).json({ message: 'Join code regenerated.', joinCode: project.joinCode });
    } catch (error) {
        console.error('regenerateJoinCode error:', error.message);
        return res.status(500).json({ message: 'Server error regenerating join code.' });
    }
};

//GET /api/projects/lookup?code=XXX
//any logged-in user. this is a read-only preview before committing to a join request.
const lookupByJoinCode = async (req, res) => {
    try {
        const { code } = req.query;

        if (!code || !code.trim()) {
            return res.status(400).json({ message: 'A join code is required.' });
        }

        const project = await Project.findOne({ joinCode: code.trim().toUpperCase() })
            .select('name description members');

        if (!project) {
            return res.status(404).json({ message: 'Invalid join code.' });
        }

        const alreadyMember = project.members.some(
            (m) => m.user.toString() === req.user._id.toString()
        );

        const existingRequest = await JoinRequest.findOne({
            project: project._id,
            user: req.user._id,
            status: 'pending',
        });

        return res.status(200).json({
            project: {
                _id: project._id,
                name: project.name,
                description: project.description,
                memberCount: project.members.length,
            },
            alreadyMember,
            hasPendingRequest: Boolean(existingRequest),
        });
    } catch (error) {
        console.error('lookupByJoinCode error:', error.message);
        return res.status(500).json({ message: 'Server error looking up join code.' });
    }
};

//POST /api/projects/join
//Any logged-in user. Body: { joinCode }
const requestToJoin = async (req, res) => {
    try {
        const { joinCode } = req.body;

        if (!joinCode || !joinCode.trim()) {
            return res.status(400).json({ message: 'A join code is required.' });
        }

        const project = await Project.findOne({ joinCode: joinCode.trim().toUpperCase() });

        if (!project) {
            return res.status(404).json({ message: 'Invalid join code.' });
        }

        const alreadyMember = project.members.some(
            (m) => m.user.toString() === req.user._id.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({ message: 'You are already a member of this project.' });
        }

        const existingRequest = await JoinRequest.findOne({
            project: project._id,
            user: req.user._id,
            status: 'pending',
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending request to join this project.' });
        }

        const joinRequest = await JoinRequest.create({
            project: project._id,
            user: req.user._id,
        });

        await safeNotify({
            recipients: getAdminIds(project),
            project: project._id,
            actor: req.user.id,
            type: 'join_request_received',
            metadata: { joinRequestId: joinRequest._id, projectName: project.name, via: 'join_code' }
        });

        return res.status(201).json({
            message: 'Join request submitted. Waiting for admin approval.',
            joinRequest,
            projectName: project.name,
        });
    } catch (error) {
        console.error('requestToJoin error:', error.message);
        return res.status(500).json({ message: 'Server error submitting join request.' });
    }
};

//GET /api/project/:id/join-requests
//Admin only. Lists pending requests for this project.
const getJoinRequests = async (req, res) => {
    try {
        const joinRequests = await JoinRequest.find({
            project: req.project._id,
            status: 'pending',
        })
            .populate('user', 'fullname email')
            .sort({ createdAt: -1 });

        return res.status(200).json({ joinRequests });
    } catch (error) {
        console.error('getJoinRequests error:', error.message);
        return res.status(500).json({ message: 'Server error fetching join requests.' });
    }
};

//POST /api/projects/:id/join-requests/:reqId/approve
//Admin only.
const approveJoinRequest = async (req, res) => {
    try {
        const { reqId } = req.params;
        const project = req.project;

        const joinRequest = await JoinRequest.findOne({ _id: reqId, project: project._id });

        if (!joinRequest) {
            return res.status(404).json({ message: 'Join request not found.' });
        }

        if (joinRequest.status !== 'pending') {
            return res.status(400).json({ message: `This request has already been ${joinRequest.status}.` });
        }

        const alreadyMember = project.members.some(
            (m) => m.user.toString() === joinRequest.user.toString()
        );

        if (!alreadyMember) {
            project.members.push({ user: joinRequest.user, role: 'member' });
            await project.save();

            // await logActivity({
            //     project: project._id,
            //     actor: joinRequest.user,
            //     type: 'member_joined',
            //     metadata: { via: 'join_code' },
            // });

            // const adminIds = project.members
            //     .filter((m) => m.role === 'admin')
            //     .map((m) => m.user);

            // await notifyUsers({
            //     recipients: adminIds,
            //     project: project._id,
            //     actor: joinRequest.user,
            //     type: 'member_joined',
            //     metadata: { via: 'join_code' },
            // });

        }

        joinRequest.status = 'approved';
        await joinRequest.save();

        try {
            if (!alreadyMember) {
                await logActivity({
                    project: project._id,
                    actor: joinRequest.user,
                    type: 'member_joined',
                    metadata: { via: 'join_code' },
                });

                const otherAdminIds = project.members
                    .filter((m) => m.role === 'admin' && m.user.toString() !== req.user._id.toString())
                    .map((m) => m.user);

                // Tell the OTHER admins (not the one who just approved)
                await notifyUsers({
                    recipients: otherAdminIds,
                    project: project._id,
                    actor: joinRequest.user,
                    type: 'member_joined',
                    metadata: { projectName: project.name, via: 'join_code' },
                });
            }

            // Tell the requester they're in
            await notifyUsers({
                recipients: [joinRequest.user],
                project: project._id,
                actor: req.user._id,
                type: 'join_request_approved',
                metadata: { projectName: project.name },
            });
        } catch (sideEffectError) {
            console.error('approveJoinRequest side-effect error:', sideEffectError.message);
        }

        return res.status(200).json({ message: 'Join request approved.', project });
    } catch (error) {
        console.error('approveJoinRequest error:', error.message);
        return res.status(500).json({ message: 'Server error approving join request.' });
    }
};

// POST /api/projects/:id/join-requests/:reqId/reject
// Admin only.
const rejectJoinRequest = async (req, res) => {
    try {
        const { reqId } = req.params;
        const project = req.project;

        const joinRequest = await JoinRequest.findOne({ _id: reqId, project: project._id });

        if (!joinRequest) {
            return res.status(404).json({ message: 'Join request not found.' });
        }

        if (joinRequest.status !== 'pending') {
            return res.status(400).json({ message: `This request has already been ${joinRequest.status}.` });
        }

        joinRequest.status = 'rejected';
        await joinRequest.save();

        await safeNotify({
            recipients: [joinRequest.user],
            project: project._id,
            actor: req.user._id,
            type: 'join_request_rejected',
            metadata: { projectName: project.name },
        });

        return res.status(200).json({ message: 'Join request rejected.' });
    } catch (error) {
        console.error('rejectJoinRequest error:', error.message);
        return res.status(500).json({ message: 'Server error rejecting join request.' });
    }
};

module.exports = {
    getJoinCode,
    regenerateJoinCode,
    requestToJoin,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    lookupByJoinCode,
};