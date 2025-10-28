const { query } = require('../database/connection');
const { logger } = require('../utils/logger');

class SessionManager {
  // Store engagement metric
  async storeEngagementMetric(sessionId, studentId, emotion, confidence, engagementScore) {
    try {
      const result = await query(
        `INSERT INTO engagement_metrics 
         (session_id, user_id, emotion, confidence, engagement_score, timestamp)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id`,
        [sessionId, studentId, emotion, confidence, engagementScore]
      );

      logger.info('Engagement metric stored:', {
        metricId: result.rows[0].id,
        sessionId,
        studentId,
        emotion,
        engagementScore
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to store engagement metric:', error);
      throw error;
    }
  }

  // Get session participants
  async getSessionParticipants(sessionId) {
    try {
      const result = await query(
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

      return result.rows;
    } catch (error) {
      logger.error('Failed to get session participants:', error);
      throw error;
    }
  }

  // Update user status in session
  async updateUserStatus(sessionId, userId, status) {
    try {
      if (status === 'left') {
        await query(
          'UPDATE session_users SET left_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );
      } else if (status === 'joined') {
        await query(
          'UPDATE session_users SET joined_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );
      }

      logger.info('User status updated:', { sessionId, userId, status });
    } catch (error) {
      logger.error('Failed to update user status:', error);
      throw error;
    }
  }

  // Get session engagement summary
  async getSessionEngagementSummary(sessionId) {
    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_metrics,
          AVG(engagement_score) as avg_engagement,
          COUNT(DISTINCT user_id) as active_participants,
          MIN(timestamp) as session_start,
          MAX(timestamp) as session_end
        FROM engagement_metrics
        WHERE session_id = $1`,
        [sessionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get session engagement summary:', error);
      throw error;
    }
  }

  // Get real-time engagement data
  async getRealTimeEngagement(sessionId, limit = 50) {
    try {
      const result = await query(
        `SELECT 
          em.id,
          em.user_id,
          em.emotion,
          em.confidence,
          em.engagement_score,
          em.timestamp,
          u.name as user_name
        FROM engagement_metrics em
        JOIN users u ON em.user_id = u.id
        WHERE em.session_id = $1
        ORDER BY em.timestamp DESC
        LIMIT $2`,
        [sessionId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get real-time engagement:', error);
      throw error;
    }
  }

  // End session
  async endSession(sessionId, endedBy) {
    try {
      await query(
        'UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE id = $1',
        [sessionId]
      );

      logger.info('Session ended:', { sessionId, endedBy });
    } catch (error) {
      logger.error('Failed to end session:', error);
      throw error;
    }
  }

  // Check if user is in session
  async isUserInSession(sessionId, userId) {
    try {
      const result = await query(
        'SELECT * FROM session_users WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check user session membership:', error);
      throw error;
    }
  }
}

const sessionManager = new SessionManager();
module.exports = { sessionManager };
