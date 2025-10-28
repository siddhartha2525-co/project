const express = require('express');
const multer = require('multer');
const { query } = require('../database/connection');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Process video frame for emotion detection
router.post('/process-frame', authenticateToken, upload.single('frame'), async (req, res) => {
  try {
    const { studentId, sessionId } = req.body;
    const frameBuffer = req.file?.buffer;

    if (!frameBuffer) {
      return res.status(400).json({
        error: 'No frame data provided',
        code: 'NO_FRAME_DATA'
      });
    }

    if (!studentId || !sessionId) {
      return res.status(400).json({
        error: 'Missing studentId or sessionId',
        code: 'MISSING_PARAMETERS'
      });
    }

    // TODO: Send frame to ML service for emotion detection
    // For now, simulate emotion detection with mock data
    const mockEmotions = ['attentive', 'confused', 'bored', 'neutral', 'happy'];
    const mockEmotion = mockEmotions[Math.floor(Math.random() * mockEmotions.length)];
    const mockConfidence = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
    const mockEngagementScore = Math.floor(60 + Math.random() * 40); // 60 to 100

    // Store the emotion metric in database
    const result = await query(
      `INSERT INTO engagement_metrics 
       (session_id, user_id, emotion, confidence, engagement_score, timestamp)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id`,
      [sessionId, studentId, mockEmotion, mockConfidence, mockEngagementScore]
    );

    logger.info('Frame processed successfully', {
      metricId: result.rows[0].id,
      sessionId,
      studentId,
      emotion: mockEmotion,
      confidence: mockConfidence,
      engagementScore: mockEngagementScore
    });

    // Return emotion detection results
    res.json({
      success: true,
      emotion: mockEmotion,
      confidence: mockConfidence,
      engagementScore: mockEngagementScore,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Frame processing error:', error);
    res.status(500).json({
      error: 'Failed to process frame',
      code: 'FRAME_PROCESSING_ERROR'
    });
  }
});

// Get class overview metrics
router.get('/class-overview', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    // Get total students in active sessions
    const totalStudentsResult = await query(
      `SELECT COUNT(DISTINCT su.user_id) as total_students
       FROM session_users su
       JOIN sessions s ON su.session_id = s.id
       WHERE s.end_time IS NULL AND su.user_id != s.teacher_id`
    );

    // Get online students (active in last 5 minutes)
    const onlineStudentsResult = await query(
      `SELECT COUNT(DISTINCT em.student_id) as online_students
       FROM engagement_metrics em
       JOIN sessions s ON em.session_id = s.id
       WHERE s.end_time IS NULL 
       AND em.timestamp > NOW() - INTERVAL '5 minutes'`
    );

    // Get average engagement
    const avgEngagementResult = await query(
      `SELECT AVG(em.engagement_score) as avg_engagement
       FROM engagement_metrics em
       JOIN sessions s ON em.session_id = s.id
       WHERE s.end_time IS NULL 
       AND em.timestamp > NOW() - INTERVAL '5 minutes'`
    );

    // Get emotion distribution
    const emotionDistributionResult = await query(
      `SELECT 
         em.emotion,
         COUNT(*) as count
       FROM engagement_metrics em
       JOIN sessions s ON em.session_id = s.id
       WHERE s.end_time IS NULL 
       AND em.timestamp > NOW() - INTERVAL '5 minutes'
       GROUP BY em.emotion`
    );

    // Process emotion distribution
    const emotionDistribution = {
      attentive: 0,
      confused: 0,
      bored: 0,
      neutral: 0,
      happy: 0
    };

    emotionDistributionResult.rows.forEach(row => {
      if (emotionDistribution.hasOwnProperty(row.emotion)) {
        emotionDistribution[row.emotion] = parseInt(row.count);
      }
    });

    // Generate alerts based on metrics
    const alerts = [];
    if (emotionDistribution.confused > 20) {
      alerts.push('High confusion detected. Consider slowing down or providing examples.');
    }
    if (emotionDistribution.bored > 30) {
      alerts.push('Students seem disengaged. Try an interactive activity or poll.');
    }
    if (avgEngagementResult.rows[0].avg_engagement < 60) {
      alerts.push('Overall engagement is low. Consider changing the topic or format.');
    }

    const overview = {
      totalStudents: parseInt(totalStudentsResult.rows[0].total_students) || 0,
      onlineStudents: parseInt(onlineStudentsResult.rows[0].online_students) || 0,
      averageEngagement: Math.round(avgEngagementResult.rows[0].avg_engagement) || 0,
      emotionDistribution,
      alerts
    };

    res.json(overview);

  } catch (error) {
    logger.error('Class overview fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch class overview',
      code: 'CLASS_OVERVIEW_FETCH_ERROR'
    });
  }
});

// Get students list with current emotions
router.get('/students', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const studentsResult = await query(
      `SELECT DISTINCT ON (u.id)
         u.id,
         u.name,
         u.email,
         em.emotion as current_emotion,
         em.engagement_score,
         em.timestamp as last_seen,
         CASE 
           WHEN em.timestamp > NOW() - INTERVAL '5 minutes' THEN true 
           ELSE false 
         END as is_online
       FROM users u
       JOIN session_users su ON u.id = su.user_id
       JOIN sessions s ON su.session_id = s.id
                LEFT JOIN LATERAL (
           SELECT emotion, engagement_score, timestamp
           FROM engagement_metrics em2
           WHERE em2.student_id = u.id AND em2.session_id = s.id
           ORDER BY timestamp DESC
           LIMIT 1
         ) em ON true
               WHERE s.end_time IS NULL 
        AND u.role = 'student'
        AND u.id != s.teacher_id
       ORDER BY u.id, em.timestamp DESC`
    );

    const students = studentsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      currentEmotion: row.current_emotion || 'neutral',
      engagementScore: Math.round(row.engagement_score) || 0,
      lastSeen: row.last_seen || new Date().toISOString(),
      isOnline: row.is_online
    }));

    res.json({ students });

  } catch (error) {
    logger.error('Students fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch students',
      code: 'STUDENTS_FETCH_ERROR'
    });
  }
});

// Get engagement metrics for a session
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this session
    const sessionCheck = await query(
      'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Access denied to this session',
        code: 'SESSION_ACCESS_DENIED'
      });
    }

    // Get engagement metrics for the session
    const metrics = await query(
      `SELECT 
        em.id,
        em.user_id,
        em.session_id,
        em.emotion,
        em.confidence,
        em.engagement_score,
        em.timestamp,
        u.name as user_name
      FROM engagement_metrics em
      JOIN users u ON em.user_id = u.id
      WHERE em.session_id = $1
      ORDER BY em.timestamp DESC`,
      [sessionId]
    );

    // Get session summary
    const sessionSummary = await query(
      `SELECT 
        s.id,
        s.title,
        s.teacher_id,
        s.created_at,
        s.end_time,
        COUNT(DISTINCT su.user_id) as participant_count,
        AVG(em.engagement_score) as avg_engagement,
        COUNT(em.id) as total_metrics
      FROM sessions s
      LEFT JOIN session_users su ON s.id = su.session_id
      LEFT JOIN engagement_metrics em ON s.id = em.session_id
      WHERE s.id = $1
      GROUP BY s.id, s.title, s.teacher_id, s.created_at, s.end_time`,
      [sessionId]
    );

    res.json({
      session: sessionSummary.rows[0] || null,
      metrics: metrics.rows,
      total_metrics: metrics.rows.length
    });

  } catch (error) {
    logger.error('Metrics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      code: 'METRICS_FETCH_ERROR'
    });
  }
});

// Get user's engagement metrics across all sessions
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to view their own metrics or teachers to view student metrics
    if (req.user.id !== parseInt(userId) && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const metrics = await query(
      `SELECT 
        em.id,
        em.session_id,
        em.emotion,
        em.confidence,
        em.engagement_score,
        em.timestamp,
        s.title as session_title
      FROM engagement_metrics em
      JOIN sessions s ON em.session_id = s.id
      WHERE em.user_id = $1
      ORDER BY em.timestamp DESC
      LIMIT 100`,
      [userId]
    );

    // Calculate summary statistics
    const summary = await query(
      `SELECT 
        COUNT(*) as total_metrics,
        AVG(engagement_score) as avg_engagement,
        COUNT(DISTINCT session_id) as sessions_participated,
        MIN(timestamp) as first_metric,
        MAX(timestamp) as last_metric
      FROM engagement_metrics
      WHERE user_id = $1`,
      [userId]
    );

    res.json({
      metrics: metrics.rows,
      summary: summary.rows[0],
      total_metrics: metrics.rows.length
    });

  } catch (error) {
    logger.error('User metrics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch user metrics',
      code: 'USER_METRICS_FETCH_ERROR'
    });
  }
});

// Get overall analytics (admin/teacher only)
router.get('/analytics', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { startDate, endDate, sessionId } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (startDate) {
      whereClause += ` AND em.timestamp >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereClause += ` AND em.timestamp <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (sessionId) {
      whereClause += ` AND em.session_id = $${paramCount}`;
      params.push(sessionId);
      paramCount++;
    }

    // Get overall engagement statistics
    const overallStats = await query(
      `SELECT 
        COUNT(*) as total_metrics,
        AVG(engagement_score) as avg_engagement,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as unique_sessions,
        MIN(timestamp) as date_range_start,
        MAX(timestamp) as date_range_end
      FROM engagement_metrics em
      ${whereClause}`,
      params
    );

    // Get emotion distribution
    const emotionStats = await query(
      `SELECT 
        emotion,
        COUNT(*) as count,
        AVG(engagement_score) as avg_engagement
      FROM engagement_metrics em
      ${whereClause}
      GROUP BY emotion
      ORDER BY count DESC`,
      params
    );

    // Get top sessions by engagement
    const topSessions = await query(
      `SELECT 
        s.id,
        s.title,
        s.created_at,
        COUNT(em.id) as metric_count,
        AVG(em.engagement_score) as avg_engagement,
        COUNT(DISTINCT em.user_id) as participant_count
      FROM sessions s
      LEFT JOIN engagement_metrics em ON s.id = em.session_id
      ${whereClause.replace('em.', '')}
      GROUP BY s.id, s.title, s.created_at
      ORDER BY avg_engagement DESC
      LIMIT 10`,
      params
    );

    res.json({
      overall: overallStats.rows[0],
      emotions: emotionStats.rows,
      top_sessions: topSessions.rows
    });

  } catch (error) {
    logger.error('Analytics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      code: 'ANALYTICS_FETCH_ERROR'
    });
  }
});

module.exports = router;
