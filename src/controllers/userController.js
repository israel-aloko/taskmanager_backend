const User = require('../models/User');

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

module.exports = { lookupByEmail };