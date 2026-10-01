const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

//GET /api/users/lookup?email=someone@example.com
//returns whether a registered user exists for this email, and their name if so.
//used by the frontend's "invite-in-app" tab to show a live confirmation as the admin types.
const lookupByEmail = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'An email address is required.'});
        }

        const user = await User.findOne({ email: email.trim().toLowerCase()}).select('fullname email');

        if (!user) {
            return res.status(200).json({ exists: false });
        }
        
        return res.status(200).json({ exists: true, fullname: user.fullname});
    } catch (error) {
        console.error('lookupByEmail error:', error.message);
        return res.status(500).json({ message: 'Server error looking up user.'});
    }
};

const SAFE_FIELDS = 'fullname email profilePicture jobTitle bio timezone provider createdAt';

const isValidTimezone = (tz) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

//GET /api/users/me
const getMe = (req, res) => {
    const { _id, fullname, email, role, profilePicture, jobTitle, bio, timezone, provider, createdAt } = req.user;
    return res.status(200).json({
        user: { _id, fullname, email, role, profilePicture, jobTitle, bio, timezone, provider, createdAt },
    });
};

// PATCH /api/users/me
// Only the four whitelisted fields can ever be changed here.
const updateMe = async (req, res) => {
    try {
        const { fullname, jobTitle, bio, timezone } = req.body;
        const updates = {};

        if (fullname !== undefined) {
            if (typeof fullname !== 'string' || !fullname.trim()) {
                return res.status(400).json({ message: 'Full name cannot be empty.' });
            }
            updates.fullname = fullname.trim();
        }
        if (jobTitle !== undefined) {
            if (typeof jobTitle !== 'string') {
                return res.status(400).json({ message: 'Invalid job title.' });
            }
            updates.jobTitle = jobTitle.trim();
        }
        if (bio !== undefined) {
            if (typeof bio !== 'string') {
                return res.status(400).json({ message: 'Invalid bio.' });
            }
            updates.bio = bio.trim();
        }
        if (timezone !== undefined) {
            if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
                return res.status(400).json({ message: 'Invalid timezone.' });
            }
            updates.timezone = timezone;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update.' });
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true, // enforces the maxlength limits from the schema
        }).select(SAFE_FIELDS);

        return res.status(200).json({ user });
    } catch (error) {
        console.error('updateMe error:', error.message);
        return res.status(500).json({ message: 'Server error updating profile.' });
    }
};

// POST /api/users/me/avatar  (multipart form, field name: "avatar")
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please choose an image.' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'taskmanager/avatars',
                    transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
                },
                (err, uploaded) => (err ? reject(err) : resolve(uploaded))
            );
            stream.end(req.file.buffer);
        });

        const oldPublicId = user.avatarPublicId;

        user.profilePicture = result.secure_url;
        user.avatarPublicId = result.public_id;
        await user.save();

        if (oldPublicId) {
            cloudinary.uploader.destroy(oldPublicId).catch((e) =>
                console.error('Old avatar cleanup failed:', e.message)
            );
        }

        return res.status(200).json({ profilePicture: user.profilePicture });
    } catch (error) {
        console.error('updateAvatar error:', error.message);
        return res.status(500).json({ message: 'Server error uploading avatar.' });
    }
};

// PATCH /api/users/me/password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required.' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters.' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (!user.password) {
            return res.status(400).json({
                message: 'This account has no password yet. Use "Forgot password" to set one.',
            });
        }

        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different from the current one.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({ message: 'Password updated.' });
    } catch (error) {
        console.error('changePassword error:', error.message);
        return res.status(500).json({ message: 'Server error changing password.' });
    }
};

module.exports = { lookupByEmail, getMe, updateMe, updateAvatar, changePassword };