const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const User = require('./models/User');

let io;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: ['http://localhost:5173'],
            credentials: true,
        },
    });

    io.use(async (socket, next) => {
        try {
            const rawCookie = socket.handshake.headers.cookie;
            if (!rawCookie) {
                return next(new Error('Not authenticated'));
            }

            const parsedCookies = cookie.parseCookie(rawCookie);
            const token = parsedCookies.token;

            if (!token) {
                return next(new Error('Not authenticated'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user) {
                return next(new Error('User not found'));
            }

            socket.userId = user._id.toString();
            next();
        } catch (error) {
            console.error('Scoket auth error:', error.message);
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        socket.join(socket.userId);
        console.log(`Socket connected: user ${socket.userId}`);

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: user ${socket.userId}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initSocket first.');
    }
    return io;
};

module.exports = { initSocket, getIO };