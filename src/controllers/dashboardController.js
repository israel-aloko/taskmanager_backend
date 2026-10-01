// const Project = require('../models/Project');
// const Task = require('../models/Task');

// //GET /api/dashboard
// //Global dashboard for the logged-in user: task stats, overdue tasks,
// // and per-project progress across every project they belong to.
// const getDashboard = async (req, res) => {
//     try {
//         const userId = req.user._id;

//         //1. all projects this user is a member of
//         const projects = await Project.find({ 'members.user': userId }).select('name');
//         const projectIds = projects.map((p) => p._id);

//         //2. this user's tasks across those projects
//         const myTasks = await Task.find({
//             assignedTo: userId,
//             project: { $in: projectIds }, 
//         }).select('status deadline project');

//         //3. Task statiistics (by status)
//         const taskStats = {
//             total: myTasks.length,
//             todo: 0,
//             'in-progress': 0,
//             done: 0,
//         };
//         myTasks.forEach((t) => {
//             taskStats[t.status]++;
//         });

//         //4. overdue tasks (deadline passed, not done)
//         const now = new Date();
//         const overdueTasks = myTasks.filter(
//             (t) => t.deadline && t.deadline < now && t.status !== 'done'
//         );

//         //5. Project progress - all tasks per project (not just mine),
//         //since "progress" describes the project, not the viewer
//         const allProjectTasks = await Task.find({
//             project: { $in: projectIds },
//         }).select('project status');

//         const projectProgress = projects.map((project) => {
//             const tasksInProject = allProjectTasks.filter(
//                 (t) => t.project.toString() === project._id.toString()
//             );
//             const totalTasks = tasksInProject.length;
//             const completedTasks = tasksInProject.filter((t) => t.status === 'done').length;
//             const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

//             return {
//                 projectId: project._id,
//                 name: project.name,
//                 totalTasks,
//                 completedTasks,
//                 percent,
//             };
//         });

//         return res.status(200).json({
//             taskStats,
//             overdueCount: overdueTasks.length,
//             overdueTasks,
//             activeProjectsCount: projects.length,
//             projectProgress,
//         });
//     } catch (error) {
//         console.error('getDashboard error:', error.message);
//         return res.status(500).json({ message: 'Server error fetching dashboard.' });
//     }
// };

// module.exports = { getDashboard };

const Project = require('../models/Project');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns a function that turns a Date into 'YYYY-MM-DD' in the user's timezone,
// so a task finished at 11pm local time lands on the right day.
const makeDayKeyFormatter = (timeZone) => {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', { ...options, timeZone });
        return (date) => fmt.format(date);
    } catch {
        // invalid timezone string stored on the user, fall back to UTC
        const fmt = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
        return (date) => fmt.format(date);
    }
};

// GET /api/dashboard
// Global dashboard for the logged-in user, scoped to their own tasks and
// every project they belong to.
const getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();

        // 1. every project the user is a member of (populate scoped to display fields only)
        const projects = await Project.find({ 'members.user': userId })
            .select('name deadline status members')
            .populate('members.user', 'fullname profilePicture')
            .lean();
        const projectIds = projects.map((p) => p._id);

        const trendStart = new Date(now.getTime() - 15 * DAY_MS);

        // 2. independent queries run in parallel
        const [user, myTasks, recentCompleted, progressRows, recentActivity] = await Promise.all([
            User.findById(userId).select('fullname timezone').lean(),

            Task.find({ assignedTo: userId, project: { $in: projectIds } })
                .select('title status priority deadline project')
                .populate('project', 'name')
                .lean(),

            Task.find({
                completedBy: userId,
                completedAt: { $gte: trendStart },
                project: { $in: projectIds },
            })
                .select('completedAt')
                .lean(),

            // per-project totals grouped in MongoDB instead of loading every task into memory
            Task.aggregate([
                { $match: { project: { $in: projectIds } } },
                {
                    $group: {
                        _id: '$project',
                        total: { $sum: 1 },
                        completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                        overdue: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ['$status', 'done'] },
                                            { $gt: ['$deadline', null] },
                                            { $lt: ['$deadline', now] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),

            Activity.find({ project: { $in: projectIds } })
                .sort({ createdAt: -1 })
                .limit(8)
                .populate('actor', 'fullname profilePicture')
                .populate('project', 'name')
                .lean(),
        ]);

        // 3. completion trend: last 14 days, zero-filled, in the user's timezone
        const toDayKey = makeDayKeyFormatter(user?.timezone || 'UTC');
        const completionTrend = [];
        for (let i = 13; i >= 0; i--) {
            completionTrend.push({ date: toDayKey(new Date(now.getTime() - i * DAY_MS)), count: 0 });
        }
        const trendIndex = new Map(completionTrend.map((d, i) => [d.date, i]));
        recentCompleted.forEach((t) => {
            const idx = trendIndex.get(toDayKey(t.completedAt));
            if (idx !== undefined) completionTrend[idx].count++;
        });
        const completedLast7 = completionTrend.slice(7).reduce((sum, d) => sum + d.count, 0);
        const completedPrev7 = completionTrend.slice(0, 7).reduce((sum, d) => sum + d.count, 0);

        // 4. stats, priority breakdown, overdue, due soon
        const taskStats = { total: myTasks.length, todo: 0, 'in-progress': 0, done: 0 };
        const priorityBreakdown = { low: 0, medium: 0, high: 0 };
        const overdue = [];
        const dueSoon = [];
        const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

        myTasks.forEach((t) => {
            taskStats[t.status]++;
            if (t.status === 'done') return;

            if (priorityBreakdown[t.priority] !== undefined) priorityBreakdown[t.priority]++;

            if (!t.deadline) return;
            const deadline = new Date(t.deadline);
            if (deadline < now) {
                overdue.push({ ...t, daysLate: Math.max(1, Math.ceil((now - deadline) / DAY_MS)) });
            } else if (deadline <= weekAhead) {
                dueSoon.push(t);
            }
        });
        const byDeadline = (a, b) => new Date(a.deadline) - new Date(b.deadline);
        overdue.sort(byDeadline);
        dueSoon.sort(byDeadline);

        // 5. project progress
        const progressMap = new Map(progressRows.map((r) => [String(r._id), r]));
        const projectProgress = projects
            .map((project) => {
                const row = progressMap.get(String(project._id));
                const totalTasks = row?.total ?? 0;
                const completedTasks = row?.completed ?? 0;
                const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
                const isBehind =
                    project.status === 'active' &&
                    !!project.deadline &&
                    new Date(project.deadline) < now &&
                    percent < 100;

                return {
                    projectId: project._id,
                    name: project.name,
                    status: project.status,
                    deadline: project.deadline,
                    totalTasks,
                    completedTasks,
                    percent,
                    overdueCount: row?.overdue ?? 0,
                    isBehind,
                    memberCount: project.members.length,
                    members: project.members.slice(0, 4).map((m) => m.user).filter(Boolean),
                };
            })
            .sort((a, b) => {
                if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
                return Number(b.isBehind) - Number(a.isBehind);
            })
            .slice(0, 6);

        return res.status(200).json({
            user: { fullname: user?.fullname ?? '' },
            taskStats,
            completedLast7,
            completedPrev7,
            completionTrend,
            priorityBreakdown,
            overdueCount: overdue.length,
            overdueTasks: overdue.slice(0, 5),
            dueThisWeekCount: dueSoon.length,
            dueSoon: dueSoon.slice(0, 5),
            activeProjectsCount: projects.filter((p) => p.status === 'active').length,
            projectProgress,
            recentActivity,
        });
    } catch (error) {
        console.error('getDashboard error:', error.message);
        return res.status(500).json({ message: 'Server error fetching dashboard.' });
    }
};

module.exports = { getDashboard };