const Project = require('../models/Project');
const logActivity = require('../utils/logActivity');

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

//I WANT TO ASSIGN/CHANGE ROLES

module.exports = {
    createProject, 
    getMyProjects,
    getProjectById,
    updateProject,
    deleteProject,
    removeMember,
};


