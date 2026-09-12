const Task = require('../models/Task');

//POST /api/projects/:projectId/tasks
//Admin only (enforced by requireProjectAdmin in the route).
const createTask = async (req, res) => {
    try {
        const { title, description, assignedTo, priority, deadline } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Title is required.' });
        }

        //If an assignee was provided, make sure they're actually a member
        // of this project before we let the admin assign them.
        if (assignedTo) {
            const isMember = req.project.members.some(
                (m) => m.user.toString() === assignedTo.toString()
            );
            if (!isMember) {
                return res.status(400).json({ message: 'Assignee must be a member of this project.' });
            }
        }

        const task = await Task.create({
            title,
            description,
            project: req.project._id,
            createdBy: req.user._id,
            assignedTo: assignedTo || null,
            priority: priority || 'medium',
            deadline: deadline || null,
        });

        return res.status(201).json({ task });
    } catch (error) {
        console.error('createTask error:', error.message);
        return res.status(500).json({ message: 'Server error creating task.' });
    }
};

// GET /api/projects/:projectId/tasks
// any project member can view the board.
const getProjectTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ project: req.project._id} )
            .populate('assignedTo', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1});

        return res.status(200).json({ tasks });
    } catch (error) {
        console.error('getProjectTasks error:', error.message);
        return res.status(500).json({ message: 'Server error fetching tasks.' });
    }
};

//GET /api/tasks/mine
//Cross-project "Assigned to Me" view. No Project param at all -
// this is intentionally the one task route with no project/task middleware upstream.
const getMyTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ assignedTo: req.user._id })
            .populate('project', 'name')
            .sort({ deadline: 1 });

        return res.status(200).json({ tasks });
    } catch (error) {
        console.error('getMyTasks error:', error.message);
        return res.status(500).json({ message: ' Server error fetching your tasks.' });
    }
};

//GET /api/tasks/:taskId
// Any project member can view a single task.
const getTaskById = async (req, res) => {
    try {
        const task = await req.task.populate([
            { path: 'assignedTo', select: ' firstName lastName' },
            { path: 'createdBy', select: 'firstName lastName' },
        ]);

        return res.status(200).json({ task });
    } catch (error) {
        console.error('getTaskById error:', error.message);
        return res.status(500).json({ message: 'Server error fetching task.'})
    }
}

// PATCH /api/tasks/:taskId
// Admin only (enforced by requireProjectAdmin in the route).
// Handles title/description/assignedTo/priority/deadline edits.
// Does NOT handle status — that's a separate route/controller with its own permission rule.
const updateTask = async (req, res) => {
    try {
        const { title, description, assignedTo, priority, deadline } = req.body;
 
        if (assignedTo) {
            const isMember = req.project.members.some(
                (m) => m.user.toString() === assignedTo.toString()
            );
            if (!isMember) {
                return res.status(400).json({ message: 'Assignee must be a member of this project.' });
            }
        }
 
        if (title !== undefined) req.task.title = title;
        if (description !== undefined) req.task.description = description;
        if (assignedTo !== undefined) req.task.assignedTo = assignedTo || null;
        if (priority !== undefined) req.task.priority = priority;
        if (deadline !== undefined) req.task.deadline = deadline || null;
 
        await req.task.save();
 
        return res.status(200).json({ task: req.task });
    } catch (error) {
        console.error('updateTask error:', error.message);
        return res.status(500).json({ message: 'Server error updating task.' });
    }
};
 
// PATCH /api/tasks/:taskId/status
// Admin OR the assignee (enforced by requireTaskAdminOrAssignee in the route).
const updateTaskStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['todo', 'in-progress', 'done'];
 
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Status must be one of: todo, in-progress, done.' });
        }
 
        req.task.status = status;
        await req.task.save();
 
        return res.status(200).json({ task: req.task });
    } catch (error) {
        console.error('updateTaskStatus error:', error.message);
        return res.status(500).json({ message: 'Server error updating task status.' });
    }
};
 
// DELETE /api/tasks/:taskId
// Admin only (enforced by requireProjectAdmin in the route).
const deleteTask = async (req, res) => {
    try {
        await req.task.deleteOne();
        return res.status(200).json({ message: 'Task deleted successfully.' });
    } catch (error) {
        console.error('deleteTask error:', error.message);
        return res.status(500).json({ message: 'Server error deleting task.' });
    }
};

module.exports = {
    createTask,
    getProjectTasks,
    getMyTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask,
};