const Task = require('../models/Task');


const DAY = 24 * 60 * 60 * 1000;



//GET /api/projects/:id/analytics
//admin only (enforced by requireProjectAdmin in the route).
const getProjectAnalytics = async (req, res) => {
    try {
        const project = await req.project.populate('members.user', 'fullname');

        const tasks = await Task.find({ project: project._id })
            .select('title status priority deadline assignedTo completedAt completedBy')
            .lean();

        const now = new Date();
        const soon = new Date(now.getTime() + 7 * DAY);

        //one row per current member, so people with zero tasks still show up
        const memberStats = new Map(
            project.members.map((m) => [
                m.user._id.toString(),
                {
                    userId: m.user._id,
                    fullname: m.user.fullname,
                    role: m.role,
                    open: 0,
                    inProgress: 0,
                    done: 0,
                    overdue: 0,
                },
            ])
        );

        const summary = { total: tasks.length, todo: 0, inProgress: 0, done: 0, overdue: 0 };
        const priority = { high: 0, medium: 0, low: 0 };
        const unassigned = { open: 0, overdue: 0 };
        let formerMembersDone = 0;
        let doneWithDeadline = 0;
        let doneOnTime = 0;
        const attention = [];

        const completions = [];
        const cutoff = new Date(now.getTime() - 56 * DAY);

        for (const t of tasks) {
            const isOverdue = t.status !== 'done' && t.deadline && new Date(t.deadline) < now;

            if (t.status === 'todo') summary.todo++;
            else if (t.status === 'in-progress') summary.inProgress++;
            else summary.done++;
            if (isOverdue) summary.overdue++;

            if (t.status !== 'done') {
                priority[t.priority]++;

                // Open work is credited to whoever it is assigned to right now
                const owner = t.assignedTo && memberStats.get(t.assignedTo.toString());
                if (owner) {
                    owner.open++;
                    if (t.status === 'in-progress') owner.inProgress++;
                    if (isOverdue) owner.overdue++;
                } else {
                    unassigned.open++;
                    if (isOverdue) unassigned.overdue++;
                }

                if (isOverdue || (t.deadline && new Date(t.deadline) <= soon)) {
                    attention.push({
                        _id: t._id,
                        title: t.title,
                        priority: t.priority,
                        status: t.status,
                        deadline: t.deadline,
                        assigneeName: owner ? owner.fullname : null,
                        isOverdue: Boolean(isOverdue),
                    });
                }
            } else {
                // Finished work is credited to whoever completed it, even if they have since left
                if (t.completedBy) {
                    const doer = memberStats.get(t.completedBy.toString());
                    if (doer) doer.done++;
                    else formerMembersDone++;
                }

                if (t.completedAt) {
                    if (t.deadline) {
                        doneWithDeadline++;
                        if (new Date(t.completedAt) <= new Date(t.deadline)) doneOnTime++;
                    }
                    if (new Date(t.completedAt) >= cutoff) completions.push(t.completedAt);
                }
            }
        }

        summary.completionRate = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
        summary.onTimeRate = doneWithDeadline ? Math.round((doneOnTime / doneWithDeadline) * 100) : null;

        attention.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        const workload = [...memberStats.values()].sort((a, b) => b.open - a.open);

        return res.status(200).json({
            analytics: {
                summary,
                priority,
                workload,
                unassigned,
                formerMembersDone,
                completions,
                attention: attention.slice(0, 10),
            },
        });
    } catch (error) {
        console.error('getProjectAnalytics error:', error.message);
        return res.status(500).json({ message: 'Server error fetching analytics.' });
    }
};

module.exports = { getProjectAnalytics };