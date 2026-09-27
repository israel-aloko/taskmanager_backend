const Project = require('../models/Project');
const logActivity = require('../utils/logActivity');
const Task = require('../models/Task');

//returnd true if userId is the only admin left on this project
const isLastAdmin = (project, userId) => {
    const member = project.members.find((m) => m.user.toString() === userId.toString());
    if (!member || member.role !== 'admin') return false;
    const adminCount = project.members.filter((m) => m.role === 'admin').length;
    return adminCount === 1;
}

//POST /api/projects
//Creates a project. Creator becomes owner and is auto-added as admin member.
const createProject = async(req, res) => {
    try {
        const { name, description, deadline } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Project name is required.'});
        }

        const project = await Project.create({
            name: name.trim(),
            description: description?.trim() || '',
            deadline: deadline || undefined,
            owner: req.user._id,
            members: [{ user: req.user._id, role: 'admin' }],
        });

        await logActivity({
            project: project._id,
            actor: req.user._id,
            type: 'project_created',
            metadata: { projectName: project.name },
        })

        return res.status(201).json({ message: 'Project created successfully.', project});
    } catch (error) {
        console.error('createProject error:', error.message);
        return res.status(500).json({ message: 'Server error creating project.'});
    }
};

//GET /api/projects
//Lists all projects the logged-in user is a member of.
const getMyProjects = async (req, res) => {
    try {
        const projects = await Project.find({ 'members.user': req.user._id })
            .select('name description deadline owner members createdAt')
            .sort({ createdAt: -1 });

        return res.status(200).json({ projects });
    } catch (error) {
        console.error('getMyProjects error:', error.message);
        return res.status(500).json({ message: 'Server error fetching projects.'});
    }
};

//GET /api/projects/:id
//Any member can view. requireProjectMember has already attached req.project.
const getProjectById = async (req, res) => {
    try {
        const project = await req.project.populate(
            'members.user',
            'fullname email'
        );

        return res.status(200).json({ project });
    } catch (error) {
        console.error('getProjectById error:', error.message);
        return res.status(500).json({ message: 'Server error fetching project.' });
    }
};

//PATCH /api/projects/:id
//Admin only (enforced by requireProjectAdmin). Only name/description/deadline are editable here.
const updateProject = async (req, res) => {
    try {
        const { name, description, deadline } = req.body;
        const project = req.project;

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ message: 'Project name cannot be empty.'});
            }
            project.name = name.trim();
        }
        
        if (description !== undefined) {
            project.description = description.trim();
        }

        if (deadline !== undefined) {
            project.deadline = deadline || null;
        }

        await project.save();

        return res.status(200).json({ message: 'Project updated successfully.', project})

    } catch (error) {
        console.error('updatedProject error:', error.message);
        return res.status(500).json({ message: 'Server error updating project.' });
    }
};

//DELETE /api/projects/:id
//Admin only (enforced by requireProjectAdmin).
const deleteProject = async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.project._id);

        return res.status(200).json({ message: 'Project deleted successfully.'});
    } catch (error) {
        console.error('deleteProject error:', error.message);
        return res.status(500).json({ message: 'Server error deleting project.'});
    }
};

//DELETE /api/projects/:id/members/:userId
// Admin only. Prevents removing the project owner.
const removeMember = async (req, res) => {
    try {
        const project = req.project;
        const { userId } = req.params;

        if (project.owner.toString() === userId) {
            return res.status(400).json({ message: 'The project owner cannot be removed.' });
        }

        const memberExists = project.members.some((m) => m.user.toString() === userId);

        if (!memberExists) {
            return res.status(404).json({ message: 'This user is not a member of the project.'});
        }

        project.members = project.members.filter((m) => m.user.toString() !== userId);
        await project.save();

        return res.status(200).json({ message: 'Member removed successfully.', project});
    } catch (error) {
        console.error('removeMember error:', error.message);
        return res.status(500).json({ message: 'Server error removing member.'});
    }
};

const updateMemberRole = async (req, res) => {
    try {
        const project = req.project;
        const { userId } = req.params;
        const { role } = req.body;

        if (!['admin', 'member'].includes(role)) {
            return res.status(400).json({ message: 'Role must be "admin" or "member".'});
        }

        if (project.owner.toString() === userId) {
            return res.status(400).json({ message: "The project owner's role cannot be changed." });
        }

        const member = project.members.find((m) => m.user.toString() === userId);

        if (!member) {
            return res.status(404).json({ message: 'This user is not a memer of the project.' });
        }

        if (member.role === role) {
            return res.status(200).json({ message: 'No change made.', project });
        }

        //Guard: which wouldnt allow the last admin to be demoted
        // if (member.role === 'admin' && role === 'member') {
        //     const adminCount = project.members.filter((m) => m.role === 'admin').length;
        //     if (adminCount === 1) {
        //         return res.status(400).json({
        //             message: 'This is the only admin. Promote another member to admin first.',
        //         });
        //     }
        // }
        if (member.role === 'admin' && role === 'member' && isLastAdmin(project, userId)) {
            return res.status(400).json({
                message: 'This is the only admin. Promote another member to admin first.',
            });
        }

        member.role = role;
        await project.save();

        await logActivity({
            project: project._id,
            actor: req.user._id,
            type: 'member_role_changed',
            metadata: { targetUser: userId, newRole: role },
        });

        return res.status(200).json({ message: 'Member role updated successfully.', project });
    } catch (error) {
        console.error('updateMemberRole error:', error.message);
        return res.status(500).json({ message: 'Server error updating member role.' });
    }
};

//POST /api/projects/:id/leave
//any member can leave, except the last remaining admin.
const leaveProject = async (req, res) => {
    try {
        const project = req.project;
        const userId = req.user._id;

        if (project.owner.toString() === userId.toString()) {
            return res.status(400).json({
                message: 'The project owner cannot leave. Delete the project instead, or transfer owenership first.',
            });
        }
        
        const member = project.members.find((m) => m.user.toString() === userId.toString());

        if (!member) {
            return res.status(404).json({ message: 'You are not a member of this project.' });
        }

        if (isLastAdmin(project, userId)) {
            return res.status(400).json({
                message: 'You are the only admin. Promote another member to admin first, or delete the project.',
            });
        }

        project.members = project.members.filter((m) => m.user.toString() !== userId.toString());
        await project.save();

        await Task.updateMany(
            { project: project._id, assignedTo: userId },
            { $set: {assignedTo: null }}
        );

        await logActivity({
            project: project._id,
            actor: userId,
            type: 'member_left',
            metadata: {},
        });

        return res.status(200).json({ message: 'You have left the project.' });
    } catch (error) {
        console.error('leaveProject error:', error.message);
        return res.status(500).json({ message: 'Server error leaving project.' });
    }
}

module.exports = {
    createProject, 
    getMyProjects,
    getProjectById,
    updateProject,
    deleteProject,
    removeMember,
    updateMemberRole,
    leaveProject,
};


