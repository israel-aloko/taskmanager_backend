const Task = require('../models/Task');
const logActivity = require('../utils/logActivity');
const notifyUsers = require('../utils/notifyUsers');

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

        await logActivity({
            project: task.project,
            actor: req.user._id,
            type: 'task_created',
            targetTask: task._id,
            metadata: { taskTitle: task.title },
        });

        //if it was created with an assignee already set, log that as well
        if (task.assignedTo) {
            await logActivity({
                project: task.project,
                actor: req.user._id,
                type: 'task_assigned',
                targetTask: task._id,
                metadata: { taskTitle: task.title, assignedTo: task.assignedTo },
            });
        }

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
            .populate('assignedTo', 'fullname')
            .populate('createdBy', 'fullname')
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
            { path: 'assignedTo', select: ' fullname' },
            { path: 'createdBy', select: 'fullname' },
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

        const previous = {
            title: req.task.title,
            assignedTo: req.task.assignedTo,
            priority: req.task.priority,
            deadline: req.task.deadline,
        };
 
        if (title !== undefined) req.task.title = title;
        if (description !== undefined) req.task.description = description;
        if (assignedTo !== undefined) req.task.assignedTo = assignedTo || null;
        if (priority !== undefined) req.task.priority = priority;
        if (deadline !== undefined) req.task.deadline = deadline || null;
 
        await req.task.save();

        const assigneeChanged = 
            assignedTo !== undefined &&
            String(previous.assignedTo || '') !== String(req.task.assignedTo || '');

        if (assigneeChanged) {
            await logActivity({
                project: req.task.project,
                actor: req.user._id,
                type: 'task_assigned',
                targetTask: req.task._id,
                metadata: {
                    taskTitle: req.task.title,
                    assignedTo: req.task.assignedTo,
                    previousAssignee: previous.assignedTo,
                },
            });

            await notifyUsers({
                recipients: [req.task.assignedTo, previous.assignedTo],
                project: req.task.project,
                actor: req.user._id,
                type: 'task_assigned',
                targetTask: req.task._id,
                metadata: {
                    taskTitle: req.task.title,
                    assignedTo: req.task.assignedTo,
                    previousAssignee: previous.assignedTo,
                },
            });
        }

        //any other field changes get logged as a generic update
        //one entry per changed field so the feed stays specific
        const fieldChecks = [
            ['title', previous.title, req.task.title],
            ['priority', previous.priority, req.task.priority],
            ['deadline', previous.deadline?.toString(), req.task.deadline?.toString()],
        ];

        for (const [field, from, to] of fieldChecks) {
            if (from!== to && to !== undefined) {
                await logActivity({
                    project: req.task.project,
                    actor: req.user._id,
                    type: 'task_updated',
                    targetTask: req.task._id,
                    metadata: { taskTitle: req.task.title, field, from, to },
                })
            }
        }
 
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

        const previousStatus = req.task.status;
 
        req.task.status = status;
        await req.task.save();

        if (previousStatus !== status) {
            await logActivity({
                project: req.task.project,
                actor: req.user._id,
                type: 'task_status_changed',
                targetTask: req.task._id,
                metadata: { taskTitle: req.task.title, from: previousStatus, to: status },
            });

            await notifyUsers({
                recipients: [req.task.createdBy, req.task.assignedTo],
                project: req.task.project,
                actor: req.user._id,
                type: 'task_status_changed',
                targetTask: req.task._id,
                metadata: { taskTitle: req.task.title, from: previousStatus, to: status },
            });
        }
 
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
        const { title, project, _id, assignedTo } = req.task;

        await req.task.deleteOne();

        await logActivity({
            project,
            actor: req.user._id,
            type: 'task_deleted',
            targetTask: null,
            metadata: { taskTitle: title, deletedTaskId: _id },
        });

        if (assignedTo) {
            await notifyUsers({
                recipients: [assignedTo],
                project,
                actor: req.user._id,
                type: 'task_deleted',
                targetTask: null,
                metadata: { taskTitle: title },
            });
        }

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