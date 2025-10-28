const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { logger } = require('./utils/logger');
const { connectDB } = require('./database/connection');
const { connectRedis } = require('./database/redis');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const userRoutes = require('./routes/users');
const metricsRoutes = require('./routes/metrics');
const reportRoutes = require('./routes/reports');
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { socketAuth } = require('./middleware/socketAuth');
const { sessionManager } = require('./services/sessionManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Emotion Engagement Backend'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/sessions', authenticateToken, sessionRoutes);
app.use('/api/metrics', authenticateToken, metricsRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

// Socket.io connection handling
io.use(socketAuth);

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.userId}`);
  
  // Join session room
  socket.on('join_session', (sessionId) => {
    socket.join(`session_${sessionId}`);
    logger.info(`User ${socket.userId} joined session ${sessionId}`);
  });

  // Leave session room
  socket.on('leave_session', (sessionId) => {
    socket.leave(`session_${sessionId}`);
    logger.info(`User ${socket.userId} left session ${sessionId}`);
  });

  // Handle engagement metrics
  socket.on('engagement_update', (data) => {
    const { sessionId, studentId, emotion, confidence, engagementScore } = data;
    
    // Broadcast to session room
    socket.to(`session_${sessionId}`).emit('engagement_update', {
      studentId,
      emotion,
      confidence,
      engagementScore,
      timestamp: new Date().toISOString()
    });
    
    // Store in database
    sessionManager.storeEngagementMetric(sessionId, studentId, emotion, confidence, engagementScore);
  });

  // Handle student status changes
  socket.on('student_status_change', (data) => {
    const { sessionId, studentId, status } = data;
    
    socket.to(`session_${sessionId}`).emit('student_status_change', {
      studentId,
      status,
      timestamp: new Date().toISOString()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.userId}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 5002;

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');
    
    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected successfully');
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();
