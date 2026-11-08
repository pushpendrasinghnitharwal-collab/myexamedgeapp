import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

// Idle PostgreSQL connections can drop when a provider sleeps or restarts.
// Without a listener pg emits an uncaught error and health checks cannot respond.
pool.on('error', (error) => console.error('Idle database connection failed:', error.message))

export const query = (text, params) => pool.query(text, params)

export async function initSchema(run = query) {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      target_exam TEXT,
      lang TEXT DEFAULT 'en',
      plan TEXT DEFAULT 'free',
      xp INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 40,
      streak_count INTEGER DEFAULT 0,
      streak_last DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      exam_id TEXT NOT NULL,
      test_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      total INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      wrong INTEGER NOT NULL,
      skipped INTEGER NOT NULL,
      score NUMERIC NOT NULL,
      max_score NUMERIC NOT NULL,
      accuracy NUMERIC NOT NULL,
      time_taken INTEGER NOT NULL,
      answers JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id, score DESC);
  `)
}
