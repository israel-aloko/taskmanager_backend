const Task = require('../models/Task');
const Project = require('../models/Project');

// Loads the task from :taskId, finds its parent project, and verifies the
// logged-in user is a member of that project.
// Attaches req.task, req.project, and req.membership (same shape as
// requireProjectMember in projectAuth.js, so requireProjectAdmin can be reused).
// Must run after isAuthenticated.
const requireTaskProjectMember = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.taskId);

        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        const project = await Project.findById(task.project);

        if (!project) {
            return res.status(404).json({ message: 'Project not found.' });
        }

        const membership = project.members.find(
            (m) => m.user.toString() === req.user._id.toString()
        );

        if (!membership) {
            return res.status(403).json({ message: 'You are not a member of this project.' });
        }

        req.task = task;
        req.project = project;
        req.membership = membership;
        next();
    } catch (error) {
        console.error('requireTaskProjectMember middleware error:', error.message);
        return res.status(500).json({ message: 'Server error checking task/project membership.' });
    }
};

// Verifies the logged-in user is either a project admin OR the member this
// task is assigned to. Used for the status-update route, where both roles
// are allowed to act, unlike every other task route (admin-only).
// Must run after requireTaskProjectMember (relies on req.task, req.membership).
const requireTaskStatusPermission = (req, res, next) => {
    if (!req.task || !req.membership) {
        return res.status(500).json({
            message: 'requireTaskStatusPermission used without requireTaskProjectMember running first.',
        });
    }

    const isAssignee = req.task.assignedTo && req.task.assignedTo.toString() === req.user._id.toString();
    const isAdmin = req.membership.role === 'admin';
    const isUnassigned = !req.task.assignedTo;

    const allowed = isAssignee || (isUnassigned && isAdmin);

    if (!allowed) {
        return res.status(403).json({ message: 'Only the assigned member can update this tasks status'});
    }

    next();
}
// const requireTaskAdminOrAssignee = (req, res, next) => {
//     if (!req.task || !req.membership) {
//         return res.status(500).json({
//             message: 'requireTaskAdminOrAssignee used without requireTaskProjectMember running first.',
//         });
//     }

//     const isAdmin = req.membership.role === 'admin';
//     const isAssignee = req.task.assignedTo && req.task.assignedTo.toString() === req.user._id.toString();

//     if (!isAdmin && !isAssignee) {
//         return res.status(403).json({ message: 'Only the project admin or the assigned member can update status.' });
//     }

//     next();
// };

module.exports = { requireTaskProjectMember, requireTaskStatusPermission };
// module.exports = { requireTaskProjectMember, requireTaskAdminOrAssignee };