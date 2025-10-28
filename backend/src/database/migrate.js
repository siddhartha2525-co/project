require('dotenv').config();
const { connectDB, query } = require('./connection');
const { logger } = require('../utils/logger');

const createTables = async () => {
  try {
    logger.info('Starting database migration...');

    // Connect to database first
    await connectDB();

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Users table created/verified');

    // Create sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
        max_students INTEGER DEFAULT 50,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Sessions table created/verified');

    // Create session_users table (many-to-many relationship)
    await query(`
      CREATE TABLE IF NOT EXISTS session_users (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'student')),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        UNIQUE(session_id, user_id)
      )
    `);
    logger.info('Session users table created/verified');

    // Create engagement_metrics table
    await query(`
      CREATE TABLE IF NOT EXISTS engagement_metrics (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        emotion VARCHAR(50) NOT NULL,
        confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        engagement_score DECIMAL(3,2) NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 1),
        face_detected BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Engagement metrics table created/verified');

    // Create session_analytics table (aggregated data)
    await query(`
      CREATE TABLE IF NOT EXISTS session_analytics (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        total_students INTEGER NOT NULL,
        active_students INTEGER NOT NULL,
        average_engagement DECIMAL(3,2) NOT NULL,
        emotion_distribution JSONB NOT NULL,
        engagement_trend JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('Session analytics table created/verified');

    // Create indexes for better performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON sessions(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_session_users_session_id ON session_users(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_users_user_id ON session_users(user_id);
      CREATE INDEX IF NOT EXISTS idx_engagement_metrics_session_id ON engagement_metrics(session_id);
      CREATE INDEX IF NOT EXISTS idx_engagement_metrics_student_id ON engagement_metrics(student_id);
      CREATE INDEX IF NOT EXISTS idx_engagement_metrics_timestamp ON engagement_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_session_analytics_session_id ON session_analytics(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_analytics_timestamp ON session_analytics(timestamp);
    `);
    logger.info('Database indexes created/verified');

    // Create updated_at trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    logger.info('Updated at trigger function created/verified');

    // Create triggers for updated_at
    await query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
      CREATE TRIGGER update_sessions_updated_at
        BEFORE UPDATE ON sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    logger.info('Updated at triggers created/verified');

    logger.info('Database migration completed successfully!');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

const dropTables = async () => {
  try {
    logger.info('Dropping all tables...');
    
    await query(`
      DROP TABLE IF EXISTS session_analytics CASCADE;
      DROP TABLE IF EXISTS engagement_metrics CASCADE;
      DROP TABLE IF EXISTS session_users CASCADE;
      DROP TABLE IF EXISTS sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    
    logger.info('All tables dropped successfully!');
  } catch (error) {
    logger.error('Failed to drop tables:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'drop') {
    dropTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    createTables()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = {
  createTables,
  dropTables
};
