const Project = require('../models/Project');

//verifies the logged-in user is a member of the project in the URL (:id or :projectId).
//attaches the project doc to the req.project and the caller's membership entry to req.membership.
//must run after isAuthenticated.
const requireProjectMember = async (req, res, next) => {
    try {
        const projectId = req.params.id || req.params.projectId;

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({ message: 'Project not found.'});
        }

        const membership = project.members.find(
            (m) => m.user.toString() === req.user._id.toString()
        );

        if (!membership) {
            return res.status(403).json({ message: 'You are not a member of this project.'});
        }
        
        req.project = project;
        req.membership = membership;
        next();
    } catch (error) {
        console.error('requiredProjectMember middleware error:', error.message);
        return res.status(500).json({ message: 'Server error checking project memebership.'});
    }
};

//verifies the logged-in user is an admin of the project.
// must run AFTER requireProjectMember (relies on req.project / req.membership).

const requireProjectAdmin = (req, res, next) => {
    if (!req.membership) {
        return res.status(500).json({
            message: 'requiredProjectAdmin used without requireProjectMember running first.',
        });
    }

    if (req.membership.role !== 'admin') {
        return res.status(403).json({ message: 'Only project admins can perform this action.'});
    }

    next();
};

module.exports = { requireProjectMember, requireProjectAdmin };