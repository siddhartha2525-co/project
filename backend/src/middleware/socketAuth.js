const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { query } = require('../database/connection');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');

    // Verify JWT token
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    
    // Get user details from database
    const result = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return next(new Error('User not found or inactive'));
    }

    const user = result.rows[0];

    // Attach user info to socket
    socket.userId = user.id;
    socket.userRole = user.role;
    socket.userName = user.name;

    logger.info(`Socket authenticated for user: ${user.name} (${user.id})`);
    next();

  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

module.exports = { socketAuth };
