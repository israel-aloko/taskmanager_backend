const Project = require('../models/Project');
const Task = require('../models/Task');

//GET /api/dashboard
//Global dashboard for the logged-in user: task stats, overdue tasks,
// and per-project progress across every project they belong to.
const getDashboard = async (req, res) => {
    try {
        const userId = req.user._id;

        //1. all projects this user is a member of
        const projects = await Project.find({ 'members.user': userId }).select('name');
        const projectIds = projects.map((p) => p._id);

        //2. this user's tasks across those projects
        const myTasks = await Task.find({
            assignedTo: userId,
            project: { $in: projectIds }, 
        }).select('status deadline project');

        //3. Task statiistics (by status)
        const taskStats = {
            total: myTasks.length,
            todo: 0,
            'in-progress': 0,
            done: 0,
        };
        myTasks.forEach((t) => {
            taskStats[t.status]++;
        });

        //4. overdue tasks (deadline passed, not done)
        const now = new Date();
        const overdueTasks = myTasks.filter(
            (t) => t.deadline && t.deadline < now && t.status !== 'done'
        );

        //5. Project progress - all tasks per project (not just mine),
        //since "progress" describes the project, not the viewer
        const allProjectTasks = await Task.find({
            project: { $in: projectIds },
        }).select('project status');

        const projectProgress = projects.map((project) => {
            const tasksInProject = allProjectTasks.filter(
                (t) => t.project.toString() === project._id.toString()
            );
            const totalTasks = tasksInProject.length;
            const completedTasks = tasksInProject.filter((t) => t.status === 'done').length;
            const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

            return {
                projectId: project._id,
                name: project.name,
                totalTasks,
                completedTasks,
                percent,
            };
        });

        return res.status(200).json({
            taskStats,
            overdueCount: overdueTasks.length,
            overdueTasks,
            activeProjectsCount: projects.length,
            projectProgress,
        });
    } catch (error) {
        console.error('getDashboard error:', error.message);
        return res.status(500).json({ message: 'Server error fetching dashboard.' });
    }
};

module.exports = { getDashboard };