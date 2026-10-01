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
// Only the member this task is assigned to can change its status.
// Admins have no exception: an unassigned task must be assigned first.
// Must run after requireTaskProjectMember (relies on req.task).
const requireTaskStatusPermission = (req, res, next) => {
    if (!req.task) {
        return res.status(500).json({
            message: 'requireTaskStatusPermission used without requireTaskProjectMember running first.',
        });
    }

    const isAssignee =
        req.task.assignedTo &&
        req.task.assignedTo.toString() === req.user._id.toString();

    if (!isAssignee) {
        return res.status(403).json({ message: "Only the assigned member can update this task's status." });
    }

    next();
};
module.exports = { requireTaskProjectMember, requireTaskStatusPermission };
// module.exports = { requireTaskProjectMember, requireTaskAdminOrAssignee };