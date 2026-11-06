import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

export const query = (text, params) => pool.query(text, params)

export async function initSchema() {
  await query(`
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

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      subject TEXT NOT NULL,
      diff TEXT NOT NULL,
      exams JSONB NOT NULL,
      q_en TEXT NOT NULL,
      q_hi TEXT NOT NULL,
      o_en JSONB NOT NULL,
      o_hi JSONB NOT NULL,
      a INTEGER NOT NULL,
      exp_en TEXT NOT NULL,
      exp_hi TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions USING GIN (exams);
  `)
}
