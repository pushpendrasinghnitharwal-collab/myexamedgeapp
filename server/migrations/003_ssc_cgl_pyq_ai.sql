-- Additive vault and AI draft tables. No legacy reset or seed data is run here.
-- Paper evidence lives outside the database; only URLs, digests and attestations
-- are stored. An operator must review source, rights and final key before release.
CREATE FUNCTION cgl_pyq_options_valid(value JSONB) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(value) <> 4 THEN RETURN FALSE; END IF;
  RETURN NOT EXISTS (SELECT 1 FROM jsonb_array_elements(value) AS item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(item->'en') IS DISTINCT FROM 'string'
       OR nullif(btrim(item->>'en'),'') IS NULL
       OR ((item ? 'hi') AND jsonb_typeof(item->'hi') NOT IN ('string','null'))
       OR (item - 'en' - 'hi') <> '{}'::jsonb);
END $$;

CREATE FUNCTION cgl_pyq_answer_valid(answer_status TEXT, indices JSONB, void_policy TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n INTEGER;
BEGIN
  IF jsonb_typeof(indices) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  n := jsonb_array_length(indices);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(indices) v WHERE jsonb_typeof(v)<>'number' OR v::text NOT IN ('0','1','2','3'))
    OR (SELECT COUNT(DISTINCT v::text) FROM jsonb_array_elements(indices) v) <> n THEN RETURN FALSE; END IF;
  RETURN COALESCE((answer_status='Single' AND n=1 AND void_policy IS NULL)
    OR (answer_status='Multiple' AND n BETWEEN 2 AND 4 AND void_policy IS NULL)
    OR (answer_status='Void' AND n=0 AND void_policy IN ('Excluded','All_Awarded')), FALSE);
END $$;

CREATE TABLE cgl_pyq_papers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_year INTEGER NOT NULL CHECK (cycle_year BETWEEN 2021 AND 2025),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  paper_code TEXT NOT NULL CHECK (length(btrim(paper_code)) BETWEEN 1 AND 100),
  exam_date DATE NOT NULL,
  shift_label TEXT NOT NULL CHECK (length(btrim(shift_label)) BETWEEN 1 AND 100),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  expected_questions INTEGER NOT NULL CHECK (expected_questions BETWEEN 1 AND 300),
  paper_url TEXT NOT NULL CHECK (paper_url ~ '^https://[^[:space:]]+$'),
  final_key_url TEXT NOT NULL CHECK (final_key_url ~ '^https://[^[:space:]]+$'),
  final_key_type TEXT NOT NULL CHECK (final_key_type='Final'),
  paper_sha256 TEXT NOT NULL CHECK (paper_sha256 ~ '^[0-9a-f]{64}$'),
  final_key_sha256 TEXT NOT NULL CHECK (final_key_sha256 ~ '^[0-9a-f]{64}$'),
  rights_sha256 TEXT NOT NULL CHECK (rights_sha256 ~ '^[0-9a-f]{64}$'),
  rights_reference TEXT NOT NULL CHECK (length(btrim(rights_reference)) BETWEEN 1 AND 1000),
  source_description TEXT NOT NULL CHECK (length(btrim(source_description)) BETWEEN 1 AND 1000),
  allow_derivatives BOOLEAN NOT NULL DEFAULT FALSE,
  allow_external_processing BOOLEAN NOT NULL DEFAULT FALSE,
  import_sha256 TEXT NOT NULL UNIQUE CHECK (import_sha256 ~ '^[0-9a-f]{64}$'),
  import_manifest JSONB NOT NULL CHECK (jsonb_typeof(import_manifest)='object'),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Withdrawn')),
  reviewed_by TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  withdrawn_by TEXT,
  withdrawal_notes TEXT,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status = 'Draft' OR (nullif(btrim(reviewed_by),'') IS NOT NULL AND nullif(btrim(review_notes),'') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status <> 'Withdrawn' OR (nullif(btrim(withdrawn_by),'') IS NOT NULL AND nullif(btrim(withdrawal_notes),'') IS NOT NULL AND withdrawn_at IS NOT NULL))
);
CREATE UNIQUE INDEX cgl_pyq_active_identity ON cgl_pyq_papers(cycle_year,exam_stage,exam_date,shift_label,paper_code) WHERE status IN ('Draft','Published');
CREATE INDEX cgl_pyq_papers_search_idx ON cgl_pyq_papers(status,cycle_year,exam_stage,exam_date);

CREATE TABLE cgl_pyq_import_history (
  import_sha256 TEXT PRIMARY KEY CHECK (import_sha256 ~ '^[0-9a-f]{64}$'),
  paper_id BIGINT NOT NULL REFERENCES cgl_pyq_papers(id),
  import_manifest JSONB NOT NULL CHECK (jsonb_typeof(import_manifest)='object'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cgl_pyq_sections (
  paper_id BIGINT NOT NULL REFERENCES cgl_pyq_papers(id),
  section_code TEXT NOT NULL CHECK (length(btrim(section_code)) BETWEEN 1 AND 100),
  label TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  position INTEGER NOT NULL CHECK (position > 0),
  expected_questions INTEGER NOT NULL CHECK (expected_questions BETWEEN 1 AND 300),
  correct_marks NUMERIC(7,2) NOT NULL CHECK (correct_marks > 0),
  wrong_deduction NUMERIC(7,2) NOT NULL CHECK (wrong_deduction >= 0),
  PRIMARY KEY(paper_id,section_code), UNIQUE(paper_id,position)
);
CREATE TABLE cgl_pyq_passages (
  paper_id BIGINT NOT NULL REFERENCES cgl_pyq_papers(id),
  passage_ref TEXT NOT NULL CHECK (length(btrim(passage_ref)) BETWEEN 1 AND 120),
  text_en TEXT NOT NULL CHECK (length(btrim(text_en)) BETWEEN 1 AND 20000),
  text_hi TEXT,
  translation_note TEXT,
  PRIMARY KEY(paper_id,passage_ref)
);
CREATE TABLE cgl_pyq_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paper_id BIGINT NOT NULL REFERENCES cgl_pyq_papers(id),
  section_code TEXT NOT NULL,
  source_question_ref TEXT NOT NULL CHECK (length(btrim(source_question_ref)) BETWEEN 1 AND 120),
  position INTEGER NOT NULL CHECK (position > 0),
  subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 120),
  chapter TEXT NOT NULL CHECK (length(btrim(chapter)) BETWEEN 1 AND 200),
  sub_chapter TEXT,
  canonical_subject TEXT,
  canonical_topic TEXT,
  canonical_sub_topic TEXT,
  canonical_stage TEXT,
  passage_ref TEXT,
  question_text_en TEXT NOT NULL CHECK (length(btrim(question_text_en)) BETWEEN 1 AND 10000),
  question_text_hi TEXT,
  translation_note TEXT,
  media_url TEXT CHECK (media_url IS NULL OR media_url ~ '^https://[^[:space:]]+$'),
  options JSONB NOT NULL CHECK (cgl_pyq_options_valid(options)),
  answer_status TEXT NOT NULL CHECK (answer_status IN ('Single','Multiple','Void')),
  correct_option_indices JSONB NOT NULL,
  void_policy TEXT,
  solution_basic TEXT,
  solution_trick TEXT,
  UNIQUE(paper_id,source_question_ref), UNIQUE(paper_id,position),
  CHECK (cgl_pyq_answer_valid(answer_status,correct_option_indices,void_policy)),
  FOREIGN KEY(paper_id,section_code) REFERENCES cgl_pyq_sections(paper_id,section_code),
  FOREIGN KEY(paper_id,passage_ref) REFERENCES cgl_pyq_passages(paper_id,passage_ref),
  FOREIGN KEY(canonical_subject,canonical_topic,canonical_sub_topic,canonical_stage)
    REFERENCES cgl_syllabus(subject,topic,sub_topic,exam_stage),
  CHECK ((canonical_subject IS NULL AND canonical_topic IS NULL AND canonical_sub_topic IS NULL AND canonical_stage IS NULL)
      OR (canonical_subject IS NOT NULL AND canonical_topic IS NOT NULL AND canonical_sub_topic IS NOT NULL AND canonical_stage IS NOT NULL))
);
CREATE INDEX cgl_pyq_chapters_idx ON cgl_pyq_questions(subject,chapter,paper_id);

-- Serialize edits with publication. Published papers and all their source items
-- remain immutable, so keys cannot change underneath saved learner attempts.
CREATE FUNCTION cgl_guard_pyq_content() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE pid BIGINT; p cgl_pyq_papers%ROWTYPE; n INTEGER;
BEGIN
  IF TG_TABLE_NAME='cgl_pyq_papers' THEN
    IF TG_OP <> 'INSERT' AND OLD.status IN ('Published','Withdrawn') THEN
      IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Withdrawn' AND
         (to_jsonb(NEW)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) =
         (to_jsonb(OLD)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Published or withdrawn PYQ papers are immutable; withdraw and import a new version' USING ERRCODE='23514';
    END IF;
    IF TG_OP='INSERT' AND NEW.status<>'Draft' THEN
      RAISE EXCEPTION 'PYQ papers must be imported as drafts and reviewed' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' AND OLD.status='Draft' AND NEW.status NOT IN ('Draft','Published') THEN
      RAISE EXCEPTION 'Only a published PYQ paper may be withdrawn' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' AND NEW.status='Published' THEN
      IF (SELECT COALESCE(SUM(expected_questions),0) FROM cgl_pyq_sections WHERE paper_id=NEW.id) <> NEW.expected_questions
        OR (SELECT COUNT(*) FROM cgl_pyq_questions WHERE paper_id=NEW.id) <> NEW.expected_questions
        OR EXISTS (SELECT 1 FROM cgl_pyq_questions q WHERE q.paper_id=NEW.id AND q.position>NEW.expected_questions)
        OR (SELECT MIN(position) FROM cgl_pyq_sections WHERE paper_id=NEW.id) <> 1
        OR (SELECT MAX(position) FROM cgl_pyq_sections WHERE paper_id=NEW.id) <> (SELECT COUNT(*) FROM cgl_pyq_sections WHERE paper_id=NEW.id)
        OR EXISTS (SELECT 1 FROM cgl_pyq_sections s WHERE s.paper_id=NEW.id AND
          (SELECT COUNT(*) FROM cgl_pyq_questions q WHERE q.paper_id=s.paper_id AND q.section_code=s.section_code) <> s.expected_questions)
        OR EXISTS (SELECT 1 FROM cgl_pyq_questions q WHERE q.paper_id=NEW.id AND q.canonical_stage NOT IN (NEW.exam_stage,'Both')) THEN
        RAISE EXCEPTION 'A full PYQ paper requires its complete, stage-compatible reviewed sections' USING ERRCODE='23514';
      END IF;
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      SELECT * INTO p FROM cgl_pyq_papers WHERE id=OLD.paper_id FOR UPDATE;
      IF p.status IN ('Published','Withdrawn') THEN RAISE EXCEPTION 'Published PYQ content is immutable' USING ERRCODE='23514'; END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      SELECT * INTO p FROM cgl_pyq_papers WHERE id=NEW.paper_id FOR UPDATE;
      IF p.status IN ('Published','Withdrawn') THEN RAISE EXCEPTION 'Published PYQ content is immutable' USING ERRCODE='23514'; END IF;
      IF TG_TABLE_NAME='cgl_pyq_questions' THEN
        IF NEW.canonical_stage IS NOT NULL AND NEW.canonical_stage NOT IN (p.exam_stage,'Both') THEN
          RAISE EXCEPTION 'Canonical question mapping does not match the historical paper stage' USING ERRCODE='23514';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_pyq_paper_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_pyq_papers FOR EACH ROW EXECUTE FUNCTION cgl_guard_pyq_content();
CREATE TRIGGER cgl_pyq_section_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_pyq_sections FOR EACH ROW EXECUTE FUNCTION cgl_guard_pyq_content();
CREATE TRIGGER cgl_pyq_passage_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_pyq_passages FOR EACH ROW EXECUTE FUNCTION cgl_guard_pyq_content();
CREATE TRIGGER cgl_pyq_question_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_pyq_questions FOR EACH ROW EXECUTE FUNCTION cgl_guard_pyq_content();

CREATE TABLE cgl_pyq_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('Paper','Chapter')),
  paper_id BIGINT REFERENCES cgl_pyq_papers(id),
  score NUMERIC(9,2) NOT NULL,
  max_score NUMERIC(9,2) NOT NULL CHECK (max_score >= 0),
  results JSONB NOT NULL CHECK (jsonb_typeof(results)='array'),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((mode='Paper' AND paper_id IS NOT NULL) OR (mode='Chapter' AND paper_id IS NULL))
);
CREATE INDEX cgl_pyq_attempt_user_idx ON cgl_pyq_attempts(user_id,submitted_at DESC);

CREATE TABLE cgl_ai_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_question_id BIGINT NOT NULL REFERENCES cgl_pyq_questions(id),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  format TEXT NOT NULL CHECK (format IN ('single_concept','multi_statement','match_column','reasoning_puzzle','mains_multi_step','statistics_probability','reading_triple')),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  sub_topic TEXT NOT NULL,
  generator_model TEXT NOT NULL,
  solver_model TEXT NOT NULL,
  auditor_model TEXT NOT NULL,
  content JSONB NOT NULL CHECK (jsonb_typeof(content)='object'),
  verification JSONB NOT NULL CHECK (jsonb_typeof(verification)='object'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  verification_sha256 TEXT NOT NULL CHECK (verification_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'Verified_Draft' CHECK (status IN ('Verified_Draft','Published','Withdrawn')),
  reviewed_by TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  withdrawn_by TEXT,
  withdrawal_notes TEXT,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(subject,topic,sub_topic,exam_stage) REFERENCES cgl_syllabus(subject,topic,sub_topic,exam_stage),
  CHECK (status = 'Verified_Draft' OR (nullif(btrim(reviewed_by),'') IS NOT NULL AND nullif(btrim(review_notes),'') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status <> 'Withdrawn' OR (nullif(btrim(withdrawn_by),'') IS NOT NULL AND nullif(btrim(withdrawal_notes),'') IS NOT NULL AND withdrawn_at IS NOT NULL))
);
CREATE INDEX cgl_ai_batches_public_idx ON cgl_ai_batches(status,exam_stage,subject,created_at);
CREATE FUNCTION cgl_guard_ai_batch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE source_ok BOOLEAN;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'Verified_Draft' THEN RAISE EXCEPTION 'AI batches must be reviewed after automated checks' USING ERRCODE='23514'; END IF;
    SELECT (p.status='Published' AND p.allow_derivatives AND p.allow_external_processing)
      INTO source_ok FROM cgl_pyq_questions q JOIN cgl_pyq_papers p ON p.id=q.paper_id WHERE q.id=NEW.source_question_id;
    IF source_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'AI source lacks publication or processing permissions' USING ERRCODE='23514'; END IF;
    IF NEW.verification->>'blind_solver' IS DISTINCT FROM 'true' OR jsonb_typeof(NEW.verification->'checks') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.content->'questions') IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.verification->'checks') <> jsonb_array_length(NEW.content->'questions')
      OR jsonb_array_length(NEW.content->'questions')=0 THEN
      RAISE EXCEPTION 'AI batches require independent verification evidence' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.status IN ('Published','Withdrawn') THEN
    IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Withdrawn' AND
       (to_jsonb(NEW)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) =
       (to_jsonb(OLD)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Published or withdrawn AI batches are immutable; generate a new version' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='Verified_Draft' AND NEW.status NOT IN ('Verified_Draft','Published') THEN
    RAISE EXCEPTION 'Only a published AI batch may be withdrawn' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='Published' AND
     (NEW.content IS DISTINCT FROM OLD.content OR NEW.verification IS DISTINCT FROM OLD.verification OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256 OR NEW.verification_sha256 IS DISTINCT FROM OLD.verification_sha256
      OR ROW(NEW.source_question_id,NEW.exam_stage,NEW.format,NEW.subject,NEW.topic,NEW.sub_topic,NEW.generator_model,NEW.solver_model,NEW.auditor_model)
         IS DISTINCT FROM ROW(OLD.source_question_id,OLD.exam_stage,OLD.format,OLD.subject,OLD.topic,OLD.sub_topic,OLD.generator_model,OLD.solver_model,OLD.auditor_model)) THEN
    RAISE EXCEPTION 'AI content and provenance cannot change while it is approved' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_ai_batch_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_ai_batches FOR EACH ROW EXECUTE FUNCTION cgl_guard_ai_batch();

CREATE TABLE cgl_ai_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES cgl_ai_batches(id),
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  results JSONB NOT NULL CHECK (jsonb_typeof(results)='array'),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (correct_count <= question_count)
);
CREATE INDEX cgl_ai_attempt_user_idx ON cgl_ai_attempts(user_id,submitted_at DESC);
