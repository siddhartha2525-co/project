const express = require('express');
const { query } = require('../database/connection');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Generate session report
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

    // Get session details
    const session = await query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );

    if (session.rows.length === 0) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Get participants
    const participants = await query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        su.joined_at,
        su.left_at
      FROM session_users su
      JOIN users u ON su.user_id = u.id
      WHERE su.session_id = $1
      ORDER BY su.joined_at`,
      [sessionId]
    );

    // Get engagement metrics summary
    const engagementSummary = await query(
      `SELECT 
        user_id,
        COUNT(*) as total_metrics,
        AVG(engagement_score) as avg_engagement,
        MIN(engagement_score) as min_engagement,
        MAX(engagement_score) as max_engagement,
        COUNT(CASE WHEN emotion = 'happy' THEN 1 END) as happy_count,
        COUNT(CASE WHEN emotion = 'sad' THEN 1 END) as sad_count,
        COUNT(CASE WHEN emotion = 'neutral' THEN 1 END) as neutral_count,
        COUNT(CASE WHEN emotion = 'angry' THEN 1 END) as angry_count,
        COUNT(CASE WHEN emotion = 'surprised' THEN 1 END) as surprised_count
      FROM engagement_metrics
      WHERE session_id = $1
      GROUP BY user_id`,
      [sessionId]
    );

    // Get time-based engagement data
    const timeData = await query(
      `SELECT 
        DATE_TRUNC('minute', timestamp) as time_bucket,
        AVG(engagement_score) as avg_engagement,
        COUNT(*) as metric_count
      FROM engagement_metrics
      WHERE session_id = $1
      GROUP BY DATE_TRUNC('minute', timestamp)
      ORDER BY time_bucket`,
      [sessionId]
    );

    // Calculate overall statistics
    const overallStats = await query(
      `SELECT 
        COUNT(*) as total_metrics,
        AVG(engagement_score) as overall_engagement,
        COUNT(DISTINCT user_id) as active_participants,
        MIN(timestamp) as session_start,
        MAX(timestamp) as session_end
      FROM engagement_metrics
      WHERE session_id = $1`,
      [sessionId]
    );

    const report = {
      session: session.rows[0],
      participants: participants.rows,
      engagement_summary: engagementSummary.rows,
      time_data: timeData.rows,
      overall_stats: overallStats.rows[0],
      generated_at: new Date().toISOString()
    };

    res.json(report);

  } catch (error) {
    logger.error('Session report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate session report',
      code: 'REPORT_GENERATION_ERROR'
    });
  }
});

// Generate user engagement report
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to view their own reports or teachers to view student reports
    if (req.user.id !== parseInt(userId) && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get user details
    const user = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get user's session participation
    const sessions = await query(
      `SELECT 
        s.id,
        s.title,
        s.created_at,
        s.end_time,
        su.joined_at,
        su.left_at,
        COUNT(em.id) as metrics_count,
        AVG(em.engagement_score) as avg_engagement
      FROM sessions s
      JOIN session_users su ON s.id = su.session_id
      LEFT JOIN engagement_metrics em ON s.id = em.session_id AND em.user_id = su.user_id
      WHERE su.user_id = $1
      GROUP BY s.id, s.title, s.created_at, s.end_time, su.joined_at, su.left_at
      ORDER BY s.created_at DESC`,
      [userId]
    );

    // Get engagement trends over time
    const trends = await query(
      `SELECT 
        DATE_TRUNC('day', timestamp) as date,
        AVG(engagement_score) as avg_engagement,
        COUNT(*) as metrics_count
      FROM engagement_metrics
      WHERE user_id = $1
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
      LIMIT 30`,
      [userId]
    );

    // Get emotion distribution
    const emotions = await query(
      `SELECT 
        emotion,
        COUNT(*) as count,
        AVG(engagement_score) as avg_engagement
      FROM engagement_metrics
      WHERE user_id = $1
      GROUP BY emotion
      ORDER BY count DESC`,
      [userId]
    );

    // Calculate overall statistics
    const overallStats = await query(
      `SELECT 
        COUNT(*) as total_metrics,
        AVG(engagement_score) as overall_engagement,
        COUNT(DISTINCT session_id) as sessions_participated,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM engagement_metrics
      WHERE user_id = $1`,
      [userId]
    );

    const report = {
      user: user.rows[0],
      sessions: sessions.rows,
      trends: trends.rows,
      emotions: emotions.rows,
      overall_stats: overallStats.rows[0],
      generated_at: new Date().toISOString()
    };

    res.json(report);

  } catch (error) {
    logger.error('User report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate user report',
      code: 'USER_REPORT_GENERATION_ERROR'
    });
  }
});

// Generate system-wide analytics report (admin only)
router.get('/system', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND timestamp >= $1';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += startDate ? ' AND timestamp <= $2' : ' AND timestamp <= $1';
      params.push(endDate);
    }

    // System overview
    const systemOverview = await query(
      `SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT em.id) as total_metrics,
        AVG(em.engagement_score) as overall_engagement
      FROM users u
      LEFT JOIN sessions s ON s.created_by = u.id
      LEFT JOIN engagement_metrics em ON em.session_id = s.id
      ${whereClause}`,
      params
    );

    // User activity
    const userActivity = await query(
      `SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_metrics,
        AVG(engagement_score) as avg_engagement
      FROM engagement_metrics em
      ${whereClause}`,
      params
    );

    // Session statistics
    const sessionStats = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (end_time - created_at))/3600) as avg_duration_hours,
        COUNT(CASE WHEN end_time IS NULL THEN 1 END) as active_sessions
      FROM sessions s
      ${whereClause.replace('timestamp', 'created_at')}`,
      params
    );

    const report = {
      system_overview: systemOverview.rows[0],
      user_activity: userActivity.rows[0],
      session_stats: sessionStats.rows[0],
      generated_at: new Date().toISOString()
    };

    res.json(report);

  } catch (error) {
    logger.error('System report generation error:', error);
    res.status(500).json({
      error: 'Failed to generate system report',
      code: 'SYSTEM_REPORT_GENERATION_ERROR'
    });
  }
});

module.exports = router;
