const Activity = require('../models/Activity');

//GET /api/projects/:projectId/activity
//any project member can view (enforced by requireProjectMember in the route).
const getProjectActivity = async (req, res) => {
    try {
        const activities = await Activity.find({ project: req.project._id })
            .populate('actor', 'fullname')
            .sort({ createdAt: -1 })
            .limit(100);

        return res.status(200).json({ activities });
    } catch (error) {
        console.error('getProjectActivity error:', error.message);
        return res.status(500).json({ message: 'Server error fetching activity.' });
    }
};

module.exports = { getProjectActivity };