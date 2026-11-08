-- Additive per-learner master assembler. No questions, mocks or exposures seeded.
-- Retain the original constraints for English sets while permitting the
-- two-question DI sets needed by the explicitly editorial Tier-I profile.
CREATE OR REPLACE FUNCTION cgl_check_question_set() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE sid BIGINT; new_id BIGINT; old_id BIGINT; s cgl_question_sets%ROWTYPE; n INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'cgl_question_sets' THEN
    IF TG_OP <> 'DELETE' THEN new_id := NEW.id; END IF;
    IF TG_OP <> 'INSERT' THEN old_id := OLD.id; END IF;
  ELSE
    IF TG_OP <> 'DELETE' THEN new_id := NEW.passage_set_id; END IF;
    IF TG_OP <> 'INSERT' THEN old_id := OLD.passage_set_id; END IF;
  END IF;
  FOR sid IN SELECT DISTINCT x FROM unnest(ARRAY[new_id, old_id]) AS x WHERE x IS NOT NULL LOOP
    SELECT * INTO s FROM cgl_question_sets WHERE id = sid;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT COUNT(*)::int INTO n FROM cgl_questions WHERE passage_set_id = sid;
    IF n > 5 OR (s.status='Published' AND ((s.set_type='Data_Interpretation' AND n NOT BETWEEN 2 AND 5)
      OR (s.set_type<>'Data_Interpretation' AND n NOT BETWEEN 4 AND 5))) THEN
      RAISE EXCEPTION 'Published DI sets require 2–5 children; English sets require 4–5' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM cgl_questions q WHERE q.passage_set_id=sid AND
      (q.subject<>s.subject OR (s.exam_stage<>'Both' AND q.exam_stage<>s.exam_stage)
       OR (q.status='Published' AND s.status<>'Published'))) THEN
      RAISE EXCEPTION 'Question set % has an incompatible subject, stage, or publication state', sid USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE TABLE cgl_master_mocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Full_Tier1','Full_Tier2','Sectional_Tier1','Sectional_Tier2','Micro','PYQ_Shift','PYQ_Topic','CA_Monthly','CA_Annual')),
  exam_stage TEXT CHECK (exam_stage IN ('Tier_1','Tier_2')),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  specification JSONB NOT NULL CHECK (jsonb_typeof(specification)='object'),
  modules JSONB NOT NULL CHECK (jsonb_typeof(modules)='array' AND jsonb_array_length(modules)>0),
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 300),
  selection JSONB NOT NULL CHECK (jsonb_typeof(selection)='object'),
  status TEXT NOT NULL DEFAULT 'Building' CHECK (status IN ('Building','Prepared','Active','Submitted','Cancelled','Invalidated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  summary JSONB CHECK (summary IS NULL OR jsonb_typeof(summary)='object'),
  CHECK ((status IN ('Building','Prepared') AND started_at IS NULL AND submitted_at IS NULL AND summary IS NULL)
    OR (status='Active' AND started_at IS NOT NULL AND submitted_at IS NULL AND summary IS NULL)
    OR (status='Submitted' AND started_at IS NOT NULL AND submitted_at IS NOT NULL AND summary IS NOT NULL)
    OR (status IN ('Cancelled','Invalidated') AND submitted_at IS NULL AND summary IS NULL))
);
CREATE INDEX cgl_master_mocks_user_idx ON cgl_master_mocks(user_id,created_at DESC,id DESC);
CREATE INDEX cgl_master_mocks_reservation_idx ON cgl_master_mocks(user_id,status,expires_at);

CREATE TABLE cgl_master_items (
  mock_id BIGINT NOT NULL REFERENCES cgl_master_mocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 300),
  module_code TEXT NOT NULL CHECK (length(btrim(module_code)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('Bank','AI','PYQ','CA')),
  source_id BIGINT NOT NULL CHECK (source_id>0),
  source_part INTEGER NOT NULL DEFAULT 0 CHECK (source_part BETWEEN 0 AND 300),
  group_key TEXT,
  subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 120),
  topic TEXT,sub_topic TEXT,difficulty TEXT CHECK (difficulty IN ('Easy','Medium','Hard')),
  label_snapshot JSONB CHECK (label_snapshot IS NULL OR jsonb_typeof(label_snapshot)='object'),
  correct_marks NUMERIC(7,2) NOT NULL CHECK (correct_marks>0),
  wrong_deduction NUMERIC(7,2) NOT NULL CHECK (wrong_deduction>=0),
  counts_for_merit BOOLEAN NOT NULL,
  delivered_at TIMESTAMPTZ,was_seen_before BOOLEAN,
  PRIMARY KEY(mock_id,position),UNIQUE(mock_id,source_kind,source_id,source_part),
  CHECK ((source_kind='AI' AND source_part>0) OR (source_kind<>'AI' AND source_part=0)),
  CHECK ((delivered_at IS NULL AND was_seen_before IS NULL) OR (delivered_at IS NOT NULL AND was_seen_before IS NOT NULL))
);
CREATE INDEX cgl_master_item_source_idx ON cgl_master_items(source_kind,source_id,source_part);
CREATE TABLE cgl_master_responses (
  mock_id BIGINT NOT NULL,position INTEGER NOT NULL,
  selected_option_index SMALLINT CHECK (selected_option_index BETWEEN 0 AND 3),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(mock_id,position),
  FOREIGN KEY(mock_id,position) REFERENCES cgl_master_items(mock_id,position) ON DELETE CASCADE
);
CREATE TABLE cgl_master_seen (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('Bank','AI','PYQ','CA')),
  source_id BIGINT NOT NULL CHECK (source_id>0),source_part INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_seen INTEGER NOT NULL DEFAULT 1 CHECK (times_seen>0),
  PRIMARY KEY(user_id,source_kind,source_id,source_part),
  CHECK ((source_kind='AI' AND source_part BETWEEN 1 AND 300) OR (source_kind<>'AI' AND source_part=0))
);
CREATE TABLE cgl_master_question_labels (
  source_kind TEXT NOT NULL CHECK (source_kind IN ('Bank','AI','CA')),
  source_id BIGINT NOT NULL CHECK (source_id>0),source_part INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  mains_level BOOLEAN NOT NULL,
  reviewer TEXT NOT NULL CHECK (length(btrim(reviewer))>0),
  notes TEXT NOT NULL CHECK (length(btrim(notes))>=10),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(source_kind,source_id,source_part),
  CHECK ((source_kind='AI' AND source_part BETWEEN 1 AND 300) OR (source_kind<>'AI' AND source_part=0))
);
CREATE TABLE cgl_master_label_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_kind TEXT NOT NULL,source_id BIGINT NOT NULL,source_part INTEGER NOT NULL,
  difficulty TEXT NOT NULL,mains_level BOOLEAN NOT NULL,reviewer TEXT NOT NULL,notes TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item composition is sealed when a mock leaves Building. Only a one-time
-- delivery marker may be added while Active. Cascading account deletion is
-- allowed when the parent mock is already gone.
CREATE FUNCTION cgl_guard_master_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE current_status TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN
    SELECT status INTO current_status FROM cgl_master_mocks WHERE id=OLD.mock_id FOR UPDATE;
    IF current_status IS NOT NULL AND current_status<>'Building' THEN
      IF TG_OP='UPDATE' AND current_status='Active' AND OLD.delivered_at IS NULL AND NEW.delivered_at IS NOT NULL AND
        (to_jsonb(NEW)-ARRAY['delivered_at','was_seen_before'])=(to_jsonb(OLD)-ARRAY['delivered_at','was_seen_before']) THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Prepared master mock composition is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT status INTO current_status FROM cgl_master_mocks WHERE id=NEW.mock_id FOR UPDATE;
    IF current_status IS DISTINCT FROM 'Building' THEN RAISE EXCEPTION 'Master items require a building mock' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_master_item_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_master_items FOR EACH ROW EXECUTE FUNCTION cgl_guard_master_item();

CREATE FUNCTION cgl_guard_master_mock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.status<>'Building' THEN RAISE EXCEPTION 'Master mocks start as building' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['status','started_at','submitted_at','expires_at','summary','selection']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','started_at','submitted_at','expires_at','summary','selection']) THEN
      RAISE EXCEPTION 'Master mock specification is immutable' USING ERRCODE='23514';
    END IF;
    IF NOT ((OLD.status='Building' AND NEW.status='Prepared') OR
      (OLD.status='Prepared' AND NEW.status IN ('Active','Cancelled','Invalidated')) OR
      (OLD.status='Active' AND NEW.status IN ('Submitted','Cancelled','Invalidated'))) THEN
      RAISE EXCEPTION 'Invalid master mock state transition' USING ERRCODE='23514';
    END IF;
    IF NEW.status='Prepared' AND ((SELECT COUNT(*) FROM cgl_master_items WHERE mock_id=NEW.id)<>NEW.question_count
      OR (SELECT MAX(position) FROM cgl_master_items WHERE mock_id=NEW.id)<>NEW.question_count) THEN
      RAISE EXCEPTION 'Prepared master mock requires an exact, contiguous item count' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_master_mock_guard BEFORE INSERT OR UPDATE ON cgl_master_mocks FOR EACH ROW EXECUTE FUNCTION cgl_guard_master_mock();

-- Questions and set membership cannot silently change underneath a prepared,
-- live or graded master test. Published -> Draft is a withdrawal, not an edit.
CREATE FUNCTION cgl_guard_master_bank_content() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE referenced BOOLEAN := FALSE;
BEGIN
  IF TG_TABLE_NAME='cgl_questions' THEN
    -- Serialize newly attached children with an in-flight master assembly.
    -- The membership check must run AFTER this lock, so it can see a mock
    -- committed while the writer was waiting for the parent set.
    IF TG_OP<>'DELETE' AND NEW.passage_set_id IS NOT NULL THEN
      PERFORM id FROM cgl_question_sets WHERE id=NEW.passage_set_id FOR UPDATE;
    END IF;
    IF TG_OP<>'INSERT' THEN
      SELECT EXISTS (SELECT 1 FROM cgl_master_items i JOIN cgl_master_mocks m ON m.id=i.mock_id
        WHERE i.source_kind='Bank' AND i.source_id=OLD.id AND
        (m.status IN ('Active','Submitted','Invalidated') OR (m.status='Prepared' AND m.expires_at>NOW()))) INTO referenced;
      IF referenced THEN
        IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Draft' AND
          (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
        RAISE EXCEPTION 'Bank questions used by master tests are immutable; withdraw and create a new version' USING ERRCODE='23514';
      END IF;
    END IF;
    IF TG_OP<>'DELETE' AND NEW.passage_set_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.passage_set_id IS DISTINCT FROM OLD.passage_set_id)
      AND EXISTS (SELECT 1 FROM cgl_questions q JOIN cgl_master_items i ON i.source_kind='Bank' AND i.source_id=q.id
        JOIN cgl_master_mocks m ON m.id=i.mock_id WHERE q.passage_set_id=NEW.passage_set_id AND
        (m.status IN ('Active','Submitted','Invalidated') OR (m.status='Prepared' AND m.expires_at>NOW()))) THEN
      RAISE EXCEPTION 'A master-test passage set cannot gain children' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT EXISTS (SELECT 1 FROM cgl_questions q JOIN cgl_master_items i ON i.source_kind='Bank' AND i.source_id=q.id
      JOIN cgl_master_mocks m ON m.id=i.mock_id WHERE q.passage_set_id=OLD.id AND
      (m.status IN ('Active','Submitted','Invalidated') OR (m.status='Prepared' AND m.expires_at>NOW()))) INTO referenced;
    IF referenced THEN
      IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Draft' AND
        (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Passage sets used by master tests are immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_master_bank_question_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_questions FOR EACH ROW EXECUTE FUNCTION cgl_guard_master_bank_content();
CREATE TRIGGER cgl_master_bank_set_guard BEFORE UPDATE OR DELETE ON cgl_question_sets FOR EACH ROW EXECUTE FUNCTION cgl_guard_master_bank_content();
