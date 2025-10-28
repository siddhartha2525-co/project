const express = require('express');
const { query } = require('../database/connection');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create a new session
router.post('/', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { title, description, max_students, start_time, end_time, settings } = req.body;
    const teacherId = req.user.id;

    // Validate required fields
    if (!title || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Title, start_time, and end_time are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate time logic
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({
        error: 'End time must be after start time',
        code: 'INVALID_TIME_RANGE'
      });
    }

    // Create session
    const sessionResult = await query(
      `INSERT INTO sessions 
       (teacher_id, title, description, max_students, start_time, end_time, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, title, description, max_students, start_time, end_time, status, created_at`,
      [teacherId, title, description || '', max_students || 50, start_time, end_time]
    );

    const session = sessionResult.rows[0];

    // Add teacher to session_users
    await query(
      `INSERT INTO session_users (session_id, user_id, joined_at, role)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 'teacher')`,
      [session.id, teacherId]
    );

    // Store session settings if provided
    if (settings) {
      await query(
        `INSERT INTO session_analytics 
         (session_id, timestamp, total_students, active_students, average_engagement, emotion_distribution, engagement_trend, created_at)
         VALUES ($1, CURRENT_TIMESTAMP, $2, 0, 0.0, $3, $4, CURRENT_TIMESTAMP)`,
        [
          session.id,
          max_students || 50,
          JSON.stringify({}), // Empty emotion distribution initially
          JSON.stringify([])  // Empty engagement trend initially
        ]
      );
    }

    logger.info('Session created successfully', {
      sessionId: session.id,
      teacherId,
      title: session.title,
      startTime: session.start_time
    });

    res.status(201).json({
      message: 'Session created successfully',
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        maxStudents: session.max_students,
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status,
        createdAt: session.created_at,
        settings: settings || {
          emotion_detection: true,
          recording: true,
          chat: true
        }
      }
    });

  } catch (error) {
    logger.error('Session creation error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      code: 'SESSION_CREATION_ERROR'
    });
  }
});

// Get all available sessions for students to join
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const { status = 'active', limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE s.status = $1';
    const params = [status];
    let paramCount = 2;

          const sessionsResult = await query(
        `SELECT 
          s.id,
          s.title,
          s.description,
          s.max_students,
          s.start_time,
          s.end_time,
          s.status,
          s.created_at,
          u.name as teacher_name,
          COUNT(su.user_id) as participant_count
        FROM sessions s
        LEFT JOIN users u ON s.teacher_id = u.id
        LEFT JOIN session_users su ON s.id = su.session_id
        ${whereClause}
        GROUP BY s.id, s.title, s.description, s.max_students, s.start_time, s.end_time, s.status, s.created_at, u.name
        ORDER BY s.start_time ASC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, parseInt(limit), parseInt(offset)]
      );

    const sessions = sessionsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      maxStudents: row.max_students,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      createdAt: row.created_at,
      teacherName: row.teacher_name,
      participantCount: parseInt(row.participant_count),
      canJoin: parseInt(row.participant_count) < row.max_students
    }));

    res.json({
      sessions,
      total: sessions.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Available sessions fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch available sessions',
      code: 'AVAILABLE_SESSIONS_FETCH_ERROR'
    });
  }
});

// Get all sessions for a teacher
router.get('/teacher', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    let whereClause = 'WHERE s.teacher_id = $1';
    const params = [teacherId];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    const sessionsResult = await query(
      `SELECT 
        s.id,
        s.title,
        s.description,
        s.max_students,
        s.start_time,
        s.end_time,
        s.status,
        s.created_at,
        s.updated_at,
        COUNT(su.user_id) as participant_count,
        sa.total_students,
        sa.average_engagement
      FROM sessions s
      LEFT JOIN session_users su ON s.id = su.session_id
      LEFT JOIN session_analytics sa ON s.id = sa.session_id
      ${whereClause}
      GROUP BY s.id, s.title, s.description, s.max_students, s.start_time, s.end_time, s.status, s.created_at, s.updated_at, sa.total_students, sa.average_engagement
      ORDER BY s.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const sessions = sessionsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      maxStudents: row.max_students,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      participantCount: parseInt(row.participant_count),
      settings: {
        totalStudents: row.total_students,
        averageEngagement: row.average_engagement
      }
    }));

    res.json({
      sessions,
      total: sessions.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('Teacher sessions fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch teacher sessions',
      code: 'TEACHER_SESSIONS_FETCH_ERROR'
    });
  }
});

// Join a session
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if session exists and is active
    const sessionCheck = await query(
      'SELECT * FROM sessions WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found or not active',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const session = sessionCheck.rows[0];

    // Check if user is already in the session
    const existingUser = await query(
      'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'User is already in this session',
        code: 'USER_ALREADY_IN_SESSION'
      });
    }

    // Check if session is full
    const participantCount = await query(
      'SELECT COUNT(*) FROM session_users WHERE session_id = $1',
      [id]
    );

    if (parseInt(participantCount.rows[0].count) >= session.max_students) {
      return res.status(400).json({
        error: 'Session is full',
        code: 'SESSION_FULL'
      });
    }

    // Add user to session
    await query(
      `INSERT INTO session_users (session_id, user_id, joined_at, role)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
      [id, userId, userRole]
    );

    logger.info('User joined session successfully', {
      sessionId: id,
      userId,
      userRole
    });

    res.json({
      message: 'Successfully joined session',
      session: {
        id: session.id,
        title: session.title,
        startTime: session.start_time,
        endTime: session.end_time
      }
    });

  } catch (error) {
    logger.error('Session join error:', error);
    res.status(500).json({
      error: 'Failed to join session',
      code: 'SESSION_JOIN_ERROR'
    });
  }
});

// Get session by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user has access to this session
    const accessCheck = await query(
      'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Access denied to this session',
        code: 'SESSION_ACCESS_DENIED'
      });
    }

    // Get session details
    const sessionResult = await query(
      `SELECT 
        s.id,
        s.title,
        s.description,
        s.max_students,
        s.start_time,
        s.end_time,
        s.status,
        s.created_at,
        s.updated_at,
        u.name as teacher_name,
        u.email as teacher_email,
        sa.total_students,
        sa.average_engagement
      FROM sessions s
      JOIN users u ON s.teacher_id = u.id
      LEFT JOIN session_analytics sa ON s.id = sa.session_id
      WHERE s.id = $1`,
      [id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    const session = sessionResult.rows[0];

    // Get participants
    const participantsResult = await query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        su.joined_at,
        su.role as session_role
      FROM session_users su
      JOIN users u ON su.user_id = u.id
      WHERE su.session_id = $1
      ORDER BY su.joined_at ASC`,
      [id]
    );

    const participants = participantsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      joinedAt: row.joined_at,
      sessionRole: row.session_role
    }));

    res.json({
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        maxStudents: session.max_students,
        startTime: session.start_time,
        endTime: session.end_time,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        teacher: {
          name: session.teacher_name,
          email: session.teacher_email
        },
        settings: {
          totalStudents: session.total_students,
          averageEngagement: session.average_engagement
        }
      },
      participants
    });

  } catch (error) {
    logger.error('Session fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      code: 'SESSION_FETCH_ERROR'
    });
  }
});

// Update session
router.put('/:id', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, max_students, start_time, end_time, status, settings } = req.body;
    const userId = req.user.id;

    // Check if user is the teacher of this session
    const sessionCheck = await query(
      'SELECT teacher_id FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (sessionCheck.rows[0].teacher_id !== userId) {
      return res.status(403).json({
        error: 'Only the session teacher can update this session',
        code: 'UPDATE_PERMISSION_DENIED'
      });
    }

    // Update session
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount}`);
      updateValues.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(description);
      paramCount++;
    }

    if (max_students !== undefined) {
      updateFields.push(`max_students = $${paramCount}`);
      updateValues.push(max_students);
      paramCount++;
    }

    if (start_time !== undefined) {
      updateFields.push(`start_time = $${paramCount}`);
      updateValues.push(start_time);
      paramCount++;
    }

    if (end_time !== undefined) {
      updateFields.push(`end_time = $${paramCount}`);
      updateValues.push(end_time);
      paramCount++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);

    const updateResult = await query(
      `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      updateValues
    );

    // Update settings if provided
    if (settings) {
      await query(
        `INSERT INTO session_analytics 
         (session_id, timestamp, total_students, active_students, average_engagement, emotion_distribution, engagement_trend, created_at)
         VALUES ($1, CURRENT_TIMESTAMP, $2, 0, 0.0, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (session_id) 
         DO UPDATE SET 
           timestamp = EXCLUDED.timestamp,
           total_students = EXCLUDED.total_students,
           active_students = EXCLUDED.active_students,
           average_engagement = EXCLUDED.average_engagement,
           emotion_distribution = EXCLUDED.emotion_distribution,
           engagement_trend = EXCLUDED.engagement_trend,
           created_at = EXCLUDED.created_at`,
        [
          id,
          settings.max_students || 50,
          JSON.stringify({}), // Empty emotion distribution initially
          JSON.stringify([])  // Empty engagement trend initially
        ]
      );
    }

    const updatedSession = updateResult.rows[0];

    logger.info('Session updated successfully', {
      sessionId: id,
      teacherId: userId,
      updatedFields: updateFields
    });

    res.json({
      message: 'Session updated successfully',
      session: {
        id: updatedSession.id,
        title: updatedSession.title,
        description: updatedSession.description,
        maxStudents: updatedSession.max_students,
        startTime: updatedSession.start_time,
        endTime: updatedSession.end_time,
        status: updatedSession.status,
        updatedAt: updatedSession.updated_at
      }
    });

  } catch (error) {
    logger.error('Session update error:', error);
    res.status(500).json({
      error: 'Failed to update session',
      code: 'SESSION_UPDATE_ERROR'
    });
  }
});

// End session
router.post('/:id/end', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is the teacher of this session
    const sessionCheck = await query(
      'SELECT teacher_id, status FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (sessionCheck.rows[0].teacher_id !== userId) {
      return res.status(403).json({
        error: 'Only the session teacher can end this session',
        code: 'END_PERMISSION_DENIED'
      });
    }

    if (sessionCheck.rows[0].status === 'ended') {
      return res.status(400).json({
        error: 'Session is already ended',
        code: 'SESSION_ALREADY_ENDED'
      });
    }

    // End session
    await query(
      'UPDATE sessions SET status = $1, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['ended', id]
    );

    logger.info('Session ended successfully', {
      sessionId: id,
      teacherId: userId
    });

    res.json({
      message: 'Session ended successfully',
      sessionId: id
    });

  } catch (error) {
    logger.error('Session end error:', error);
    res.status(500).json({
      error: 'Failed to end session',
      code: 'SESSION_END_ERROR'
    });
  }
});

// Join session
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if session exists and is active
    const sessionCheck = await query(
      'SELECT id, status, max_students FROM sessions WHERE id = $1',
      [id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    if (sessionCheck.rows[0].status !== 'active') {
      return res.status(400).json({
        error: 'Session is not active',
        code: 'SESSION_NOT_ACTIVE'
      });
    }

    // Check if user is already in session
    const existingUser = await query(
      'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'User is already in this session',
        code: 'USER_ALREADY_IN_SESSION'
      });
    }

    // Check if session is full
    const participantCount = await query(
      'SELECT COUNT(*) FROM session_users WHERE session_id = $1',
      [id]
    );

    if (parseInt(participantCount.rows[0].count) >= sessionCheck.rows[0].max_students) {
      return res.status(400).json({
        error: 'Session is full',
        code: 'SESSION_FULL'
      });
    }

    // Join session
    await query(
      `INSERT INTO session_users (session_id, user_id, joined_at, role)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
      [id, userId, req.user.role]
    );

    logger.info('User joined session successfully', {
      sessionId: id,
      userId,
      userRole: req.user.role
    });

    res.json({
      message: 'Successfully joined session',
      sessionId: id
    });

  } catch (error) {
    logger.error('Session join error:', error);
    res.status(500).json({
      error: 'Failed to join session',
      code: 'SESSION_JOIN_ERROR'
    });
  }
});

// Leave session
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is in session
    const userCheck = await query(
      'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'User is not in this session',
        code: 'USER_NOT_IN_SESSION'
      });
    }

    // Leave session
    await query(
      'UPDATE session_users SET left_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND user_id = $2',
      [id, userId]
    );

    logger.info('User left session successfully', {
      sessionId: id,
      userId
    });

    res.json({
      message: 'Successfully left session',
      sessionId: id
    });

  } catch (error) {
    logger.error('Session leave error:', error);
    res.status(500).json({
      error: 'Failed to leave session',
      code: 'SESSION_LEAVE_ERROR'
    });
  }
});

module.exports = router;
