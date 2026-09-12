require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const registerRoutes = require('./routes/registerRoutes');
const projectRoutes = require('./routes/projectRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const projectTaskRoutes = require('./routes/projectTaskRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ['http://localhost:5173',
        //add in the port for local hosting
    //     eg: 'http://192.168.1.6:5173',
    // 'https://izzyroots.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

app.use('/auth', authRoutes);
app.use('/api', registerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects/:projectId/tasks', projectTaskRoutes);

app.get('/', (req, res) => {
    res.send('TaskManager backend is alive!');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});