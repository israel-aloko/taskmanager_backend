const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Task = require("../models/Task");
const Project = require("../models/Project");
const logActivity = require("../utils/logActivity");
const Notification = require('../models/Notification');
const notifyUsers = require("../utils/notifyUsers");

const createComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { content, parentComment, mentions } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Comment content is required."});
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: "Task not found." });
        }

        let parent = null;
        

        //if replying, confirm the parent exists and belongs to the same task
        //prevents cross-task parentComment references.
        if (parentComment) {
            if (!mongoose.Types.ObjectId.isValid(parentComment)) {
                return res.status(400).json({ message: "Invalid parentComment id."});
            }
            parent = await Comment.findOne({ _id: parentComment, task: taskId });
            if (!parent) {
                return res
                  .status(400)
                  .json({ message: "Parent comment not found on this task." });
            }
        }

        //validate mentions against project membership - never notify/leak
        //task existence to a user outside the project.
        let validMentions = [];
        if (Array.isArray(mentions) && mentions.length > 0) {
            const project = await Project.findById(task.project).select("members.user");
            const memberIds = new Set(
                project.members.map((m) => m.user.toString())
            );
            validMentions = mentions.filter((id) => memberIds.has(id.toString()));
        }

        const comment = await Comment.create({
            task: taskId,
            author: req.user._id,
            content: content.trim(),
            parentComment: parentComment || null,
            mentions: validMentions,
        });

        await logActivity({
            project: task.project,
            actor: req.user._id,
            type: 'comment_added',
            targetTask: task._id,
            metadata: { taskTitle: task.title },
        });

        const excerpt = content.trim().slice(0, 140);

        //track who's already been notified about this comment, so the task create notification never duplicates a mention/reply one.

        const alreadyNotified = new Set();

        //@mentions
        if (validMentions.length > 0) {
            await notifyUsers({
                recipients: validMentions,
                project: task.project,
                actor: req.user._id,
                type: 'comment_mention',
                targetTask: task._id,
                metadata: { taskTitle: task.title, excerpt },
            });
            validMentions.forEach((id) => alreadyNotified.add(id.toString()));
        }

        //reply to a parent comment's author
        if (parent && !alreadyNotified.has(parent.author.toString())) {
            await notifyUsers({
                recipients: [parent.author],
                project: task.project,
                actor: req.user._id,
                type: 'comment_reply',
                targetTask: task._id,
                metadata: { taskTitle: task.title, excerpt },
            });
            alreadyNotified.add(parent.author.toString());
        }
        

        //task creator, general comment - only if not already notified via
        //mention/reply above, and not if they're commenting on their own task.

        if (
            task.createdBy &&
            !alreadyNotified.has(task.createdBy.toString())
        ) {
            await notifyUsers({
                recipients: [task.createdBy],
                project: task.project,
                actor: req.user._id,
                type: 'comment_added',
                targetTask: task._id,
                metadata: { taskTitle: task.title, excerpt },
            });
        }

        // //One notification per valid mention. Fire-and-forget-style loop
        // //a failed notification shouldn't fail the comment create, so 
        // //errors are caught per-item rather than propagated.
        // await Promise.all(
        //     validMentions.map((userId) =>
        //         Notification.create({
        //             recipient: userId,
        //             project: task.project,
        //             actor: req.user._id,
        //             type: 'comment_mention',
        //             targetTask: task._id,
        //             metadata: { taskTitle: task.title, excerpt: content.trim().slice(0, 140)},
        //         }).catch((err) => console.error('comment_mention notification error:', err.message))
        //     )
        // );

        // //notify the parent comment's author on a reply - unless they're also being @mentioned in this same comment
        // if (parent && !validMentions.some((id) => id.toString() === parent.author.toString())) {
        //     const isSelfReply = parent.author.toString() === req.user._id.toString();
        //     if (!isSelfReply) {
        //         await Notification.create({
        //             recipient: parent.author,
        //             project: task.project,
        //             actor: req.user._id,
        //             type: 'comment_reply',
        //             targetTask: task._id,
        //             metadata: { taskTitle: task.title, excerpt: content.trim().slice(0, 140)},
        //         }).catch((err) => console.error('comment_reply notification error:', err.message));
        //     }
        // }

        const populated = await comment.populate([
            { path: 'author', select: 'fullname' },
            { path: 'mentions', select: 'fullname' },
        ]);

        return res.status(201).json({ comment: populated });
    } catch (error) {
        console.error('createComment error:', error.message);
        return res.status(500).json({ message: 'Server error creating comment.' });
    }
};

//GET /api/tasks/:taskId/comments
//returns the flat list for the task, oldest first. Client builds the nested tree from parentComment
//-avoids N+1 recursive queries here.
const getComments = async (req, res) => {
    try {
        const { taskId } = req.params;

        const comments = await Comment.find({ task: taskId })
            .sort({ createdAt: 1 })
            .populate('author', 'fullname')
            .populate('mentions', 'fullname');

            //soft-deleted comments are still returned (so their replies stay attached in the tree) but with content masked.
            const shaped = comments.map((c) => {
                const obj = c.toObject();
                if (obj.isDeleted) {
                    obj.content = '[deleted]';
                    obj.mentions = [];
                }
                return obj;
            });

            return res.status(200).json({ comments: shaped });
    } catch (error) {
        console.error('getComments error:', error.message);
        return res.status(500).json({ message: 'Server error fetching comments.' });
    }
};

//PATCH /api/comments/:commentId
//author-only edit.
const editComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Comment content is required.'});
        }

        const comment = await Comment.findById(commentId);
        if (!comment || comment.isDeleted) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        if (comment.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author can edit this comment.' });
        }

        comment.content = content.trim();
        comment.edited = true;
        comment.editedAt = new Date();
        await comment.save();

        const populated = await comment.populate([
            { path: 'author', select: 'fullname' },
            { path: 'mentions', select: 'fullname' },
        ]);

        return res.status(200).json({ comment: populated });
    } catch (error) {
        console.error('editComment error:', error.message);
        return res.status(500).json({ message: 'Server error editing comment.'});
    }
};

//DELETE /api/comments/:commentId
//Author-only soft delete - content is blanked, document (and its replies) are preserved so the thread doesn't break.
const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
 
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }
 
        if (comment.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the author can delete this comment.' });
        }
 
        // Every descendant lives on the same task, so one query for the
        // task's full flat comment list is enough to walk the whole
        // subtree in memory - no recursive DB round trips needed.
        const allTaskComments = await Comment.find({ task: comment.task }).select('_id parentComment');
 
        const idsToDelete = [comment._id.toString()];
        // Repeatedly sweep for children of anything already marked for
        // deletion, until a pass finds nothing new - this catches
        // descendants at any depth (replies to replies to replies...).
        let foundMore = true;
        while (foundMore) {
            foundMore = false;
            for (const c of allTaskComments) {
                const idStr = c._id.toString();
                const parentStr = c.parentComment?.toString();
                if (parentStr && idsToDelete.includes(parentStr) && !idsToDelete.includes(idStr)) {
                    idsToDelete.push(idStr);
                    foundMore = true;
                }
            }
        }
 
        await Comment.deleteMany({ _id: { $in: idsToDelete } });
 
        return res.status(200).json({ message: 'Comment deleted successfully.', deletedIds: idsToDelete });
    } catch (error) {
        console.error('deleteComment error:', error.message);
        return res.status(500).json({ message: 'Server error deleting comment.' });
    }
};

module.exports = {
    createComment,
    getComments,
    editComment,
    deleteComment,
};