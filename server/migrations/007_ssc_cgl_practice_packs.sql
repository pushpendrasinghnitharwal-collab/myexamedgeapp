-- Additive provenance ledger for original practice packs. No content is seeded.
-- Existing questions, sets, learner attempts and published content are untouched.
CREATE TABLE cgl_practice_packs (
  pack_key TEXT PRIMARY KEY,
  pack_version INTEGER NOT NULL CHECK (pack_version > 0),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  exam TEXT NOT NULL CHECK (exam = 'SSC CGL'),
  exam_stage TEXT NOT NULL CHECK (exam_stage = 'Tier_1'),
  review_status TEXT NOT NULL CHECK (review_status IN
    ('draft', 'automated_verified_pending_human_review', 'preview_not_human_reviewed', 'human_reviewed')),
  reviewer TEXT,
  reviewed_at TIMESTAMPTZ,
  imported_by TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  notes TEXT,
  CHECK (review_status <> 'human_reviewed'
    OR (nullif(btrim(reviewer), '') IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE cgl_practice_pack_items (
  pack_key TEXT NOT NULL REFERENCES cgl_practice_packs(pack_key) ON DELETE CASCADE,
  qid TEXT NOT NULL CHECK (qid ~ '^[a-z0-9-]{3,80}$'),
  question_id BIGINT NOT NULL REFERENCES cgl_questions(id) ON DELETE RESTRICT,
  set_ref TEXT CHECK (set_ref IS NULL OR set_ref ~ '^[a-z0-9-]{3,80}$'),
  set_id BIGINT REFERENCES cgl_question_sets(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 300),
  PRIMARY KEY (pack_key, qid),
  UNIQUE (pack_key, question_id),
  UNIQUE (pack_key, position),
  CHECK ((set_ref IS NULL) = (set_id IS NULL))
);

CREATE INDEX cgl_practice_pack_items_question_idx ON cgl_practice_pack_items(question_id);
CREATE INDEX cgl_practice_pack_items_set_idx ON cgl_practice_pack_items(pack_key, set_ref);
