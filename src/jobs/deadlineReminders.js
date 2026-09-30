const cron = require('node-cron');
const Task = require('../models/Task');
const Project = require('../models/Project');
const notifyUsers = require('../utils/notifyUsers');

const dayRange = (offset) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { $gte: start, $lt: end };
};

const remindTasks = async (offset, type, flag) => {
    const tasks = await Task.find({
        deadline: dayRange(offset),
        status: { $ne: 'done' },
        assignedTo: { $ne: null },
        [`reminders.${flag}`]: { $ne: true },
    }).populate('project', 'name status');

    for (const task of tasks) {
        if (!task.project || task.project.status === 'completed') continue;
        await notifyUsers({
            recipients: [task.assignedTo], project: task.project._id, actor: null, 
            type, targetTask: task._id,
            metadata: { taskTitle: task.title, projectName: task.project.name },
        });
        await Task.updateOne({ _id: task._id }, { $set: { [`reminders.${flag}`]: true } });
    }
};

const remindTaskIfDue = async (taskId) => {
    const task = await Task.findById(taskId).populate('project', 'name status');
    if (!task || !task.deadline || !task.assignedTo || task.status === 'done') return;
    if (!task.project || task.project.status === 'completed') return;

    const today = dayRange(0);
    const tomorrow = dayRange(1);
    const d = task.deadline;

    let type, flag;
    if (d >= today.$gte && d < today.$lt) {
        type = 'task_due_today'; flag = 'dueToday';
    } else if (d >= tomorrow.$gte && d < tomorrow.$lt) {
        type = 'task_deadline_approaching'; flag = 'dayBefore';
    } else return;

    if (task.reminders?.[flag]) return;

    await notifyUsers({
        recipients: [task.assignedTo], project: task.project._id, actor: null,
        type, targetTask: task._id,
        metadata: { taskTitle: task.title, projectName: task.project.name },
    });
    await Task.updateOne({ _id: task._id}, {$set: { [`reminders.${flag}`]: true } });
};

const remindProjects = async (offset, type, flag) => {
    const projects = await Project.find({
        status: 'active',
        deadline: dayRange(offset),
        [`reminders.${flag}`]: { $ne: true},
    });

    for (const project of projects) {
        await notifyUsers({
            recipients: project.members.map((m) => m.user), project: project._id, actor: null,
            type, metadata: { projectName: project.name },
        });
        await Project.updateOne({ _id: project._id }, { $set: { [`reminders.${flag}`]: true } });
    }
};

const remindProjectIfDue = async (projectId, actor = null) => {
    const project = await Project.findById(projectId);
    if (!project || !project.deadline || project.status !== 'active') return;

    const today = dayRange(0);
    const tomorrow = dayRange(1);
    const d = project.deadline;

    let type, flag;
    if (d >= today.$gte && d < today.$lt) {
        type = 'project_due_today'; flag = 'dueToday';
    } else if (d >= tomrrow.$gte && d < tomorrow.$lt) {
        type = 'project_deadline_approaching'; flag = 'dayBefore';
    } else return;

    if (project.reminders?.[flag]) return;

    await notifyUsers({
        recipients: project.members.map((m) => m.user),
        project: project._id,
        actor,
        type,
        metadata: { projectName: project.name },
    });
    await Project.updateOne({ _id: project._id }, { $set: {[ `reminders.${flag}`]: true } });
};

const runAll = async () => {
    try {
        await remindTasks(1, 'task_deadline_approaching', 'dayBefore');
        await remindTasks(0, 'task_due_today', 'dueToday');
        await remindProjects(1, 'project_deadline_approaching', 'dayBefore');
        await remindProjects(0, 'project_due_today', 'dueToday');
    } catch (err) {
        console.error('Deadline reminder job failed:', err.message);
    }
};

const startDeadlineReminders = () => {
    cron.schedule('0 8 * * *', runAll, { timezone: 'Africa/Lagos' });
    runAll(); 
};

module.exports = { startDeadlineReminders, remindTaskIfDue, remindProjectIfDue };