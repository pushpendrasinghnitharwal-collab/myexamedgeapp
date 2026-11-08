-- Additive exam-player progress; no existing attempts or content are modified.
CREATE TABLE cgl_master_player_progress (
  mock_id BIGINT NOT NULL, position INTEGER NOT NULL,
  visited BOOLEAN NOT NULL DEFAULT FALSE,
  marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(mock_id,position),
  FOREIGN KEY(mock_id,position) REFERENCES cgl_master_items(mock_id,position) ON DELETE CASCADE
);
CREATE TABLE cgl_master_player_time (
  mock_id BIGINT NOT NULL, position INTEGER NOT NULL,
  device_id TEXT NOT NULL CHECK (device_id ~ '^[a-zA-Z0-9-]{16,80}$'),
  elapsed_ms BIGINT NOT NULL CHECK (elapsed_ms BETWEEN 0 AND 604800000),
  response_revision BIGINT NOT NULL DEFAULT 0 CHECK (response_revision BETWEEN 0 AND 2147483647),
  state_hash TEXT CHECK (state_hash IS NULL OR state_hash ~ '^[0-9a-f]{64}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(mock_id,position,device_id),
  FOREIGN KEY(mock_id,position) REFERENCES cgl_master_items(mock_id,position) ON DELETE CASCADE
);
CREATE TABLE cgl_master_early_advances (
  mock_id BIGINT NOT NULL REFERENCES cgl_master_mocks(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL CHECK (section_code IN ('Section_I','Section_II')),
  advanced_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(mock_id,section_code)
);
