-- One-time, transactional reset of the known legacy question/mock schemas.
-- No CASCADE: unexpected dependencies must stop the migration rather than
-- silently remove accounts, attempts, or any unrelated application tables.
DROP TABLE IF EXISTS mock_test_questions;
DROP TABLE IF EXISTS mock_tests;
DROP TABLE IF EXISTS mock_blueprints;
DROP TABLE IF EXISTS question_sets;
DROP TABLE IF EXISTS questions;

CREATE TABLE cgl_syllabus (
  subject TEXT NOT NULL CHECK (subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  topic TEXT NOT NULL CHECK (length(btrim(topic)) > 0),
  sub_topic TEXT NOT NULL CHECK (length(btrim(sub_topic)) > 0),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2','Both')),
  notice_year INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  source_sections TEXT NOT NULL,
  PRIMARY KEY (subject, topic, sub_topic, exam_stage),
  CHECK (subject <> 'Computer_Knowledge' OR exam_stage = 'Tier_2')
);

CREATE FUNCTION cgl_valid_options(value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(value) <> 4 THEN RETURN FALSE; END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(value) AS item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(item->'en') IS DISTINCT FROM 'string'
       OR jsonb_typeof(item->'hi') IS DISTINCT FROM 'string'
       OR (item - 'en' - 'hi') <> '{}'::jsonb
       OR nullif(btrim(item->>'en'), '') IS NULL
       OR nullif(btrim(item->>'hi'), '') IS NULL
  );
END $$;

-- Storage validation only: SVG remains untrusted. Consumers must sanitize
-- markup and apply an appropriate CSP before displaying it.
CREATE FUNCTION cgl_valid_media(value TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT value IS NULL OR (length(value) BETWEEN 1 AND 500000 AND
    (btrim(value) ~* '^https?://[^[:space:]]+$' OR btrim(value) ~* '^<svg([[:space:]>])'))
$$;

CREATE FUNCTION cgl_valid_pyq_meta(value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE date_value DATE;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object'
     OR jsonb_typeof(value->'is_pyq') IS DISTINCT FROM 'boolean' THEN RETURN FALSE; END IF;
  IF value->>'is_pyq' = 'false' THEN
    RETURN (value->>'year' IS NULL AND value->>'tier' IS NULL AND value->>'exam_date' IS NULL AND value->>'shift' IS NULL);
  END IF;
  IF jsonb_typeof(value->'year') IS DISTINCT FROM 'number' OR (value->>'year') !~ '^202[1-5]$'
     OR jsonb_typeof(value->'tier') IS DISTINCT FROM 'string' OR (value->>'tier') NOT IN ('Tier_1','Tier_2')
     OR jsonb_typeof(value->'exam_date') IS DISTINCT FROM 'string' OR (value->>'exam_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR jsonb_typeof(value->'shift') IS DISTINCT FROM 'string' OR (value->>'shift') !~ '^Shift [1-9][0-9]*$'
  THEN RETURN FALSE; END IF;
  BEGIN date_value := (value->>'exam_date')::date;
  EXCEPTION WHEN OTHERS THEN RETURN FALSE; END;
  RETURN to_char(date_value, 'YYYY-MM-DD') = value->>'exam_date';
END $$;

CREATE FUNCTION cgl_valid_ca_meta(value JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'object'
     OR jsonb_typeof(value->'is_ca') IS DISTINCT FROM 'boolean' THEN RETURN FALSE; END IF;
  IF value->>'is_ca' = 'false' THEN
    RETURN (value->>'year' IS NULL AND value->>'month' IS NULL AND value->>'ca_category' IS NULL AND value->>'static_gk_link' IS NULL);
  END IF;
  RETURN COALESCE(
    jsonb_typeof(value->'year') = 'number' AND value->>'year' IN ('2025','2026')
    AND jsonb_typeof(value->'month') = 'number' AND value->>'month' ~ '^([1-9]|1[0-2])$'
    AND jsonb_typeof(value->'ca_category') = 'string' AND value->>'ca_category' IN
      ('Appointments','Awards','Sports','Schemes','Defence','Index_Reports','Budget_Economy','Books_Authors','Important_Days','National_International')
    AND jsonb_typeof(value->'static_gk_link') = 'string' AND length(btrim(value->>'static_gk_link')) > 0,
    FALSE
  );
END $$;

CREATE TABLE cgl_question_sets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_type TEXT NOT NULL CHECK (set_type IN ('Cloze_Test','Reading_Comprehension','Data_Interpretation')),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2','Both')),
  subject TEXT NOT NULL CHECK (subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  passage_text_en TEXT,
  passage_text_hi TEXT,
  media_svg_or_url TEXT CHECK (cgl_valid_media(media_svg_or_url)),
  chart_data JSONB,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (COALESCE((set_type IN ('Cloze_Test','Reading_Comprehension') AND subject = 'English'
          AND nullif(btrim(passage_text_en),'') IS NOT NULL AND nullif(btrim(passage_text_hi),'') IS NOT NULL)
      OR (set_type = 'Data_Interpretation' AND subject = 'Quant'
          AND (nullif(btrim(media_svg_or_url),'') IS NOT NULL OR jsonb_typeof(chart_data) IN ('object','array'))), FALSE))
);

CREATE TABLE cgl_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2','Both')),
  subject TEXT NOT NULL CHECK (subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  topic TEXT NOT NULL,
  sub_topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  question_type TEXT NOT NULL CHECK (question_type IN ('Standard_MCQ','Multi_Statement','Assertion_Reason','Match_The_Column','Passage_Based')),
  passage_set_id BIGINT REFERENCES cgl_question_sets(id) ON DELETE RESTRICT,
  question_text_en TEXT NOT NULL CHECK (length(btrim(question_text_en)) > 0),
  question_text_hi TEXT NOT NULL CHECK (length(btrim(question_text_hi)) > 0),
  media_svg_or_url TEXT CHECK (cgl_valid_media(media_svg_or_url)),
  options JSONB NOT NULL CHECK (cgl_valid_options(options)),
  correct_option_index SMALLINT NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
  pyq_meta JSONB NOT NULL DEFAULT '{"is_pyq":false}'::jsonb CHECK (cgl_valid_pyq_meta(pyq_meta)),
  current_affairs_meta JSONB NOT NULL DEFAULT '{"is_ca":false}'::jsonb CHECK (cgl_valid_ca_meta(current_affairs_meta)),
  solution_basic TEXT NOT NULL CHECK (length(btrim(solution_basic)) > 0),
  solution_basic_hi TEXT,
  solution_trick TEXT NOT NULL CHECK (length(btrim(solution_trick)) > 0),
  solution_trick_hi TEXT,
  ideal_time_seconds INTEGER NOT NULL CHECK (ideal_time_seconds > 0),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  source_url TEXT,
  source_citation TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, subject),
  FOREIGN KEY (subject, topic, sub_topic, exam_stage) REFERENCES cgl_syllabus(subject, topic, sub_topic, exam_stage),
  CHECK (question_type <> 'Passage_Based' OR passage_set_id IS NOT NULL),
  CHECK (pyq_meta->>'is_pyq' <> 'true' OR exam_stage = 'Both' OR exam_stage = pyq_meta->>'tier'),
  CHECK (current_affairs_meta->>'is_ca' <> 'true' OR subject = 'General_Awareness'),
  CHECK (status <> 'Published' OR COALESCE((source_url ~ '^https://' AND nullif(btrim(source_citation),'') IS NOT NULL
        AND nullif(btrim(reviewed_by),'') IS NOT NULL AND reviewed_at IS NOT NULL), FALSE))
);
CREATE INDEX cgl_questions_syllabus_idx ON cgl_questions(exam_stage, subject, topic, sub_topic);
CREATE INDEX cgl_questions_set_idx ON cgl_questions(passage_set_id);
CREATE INDEX cgl_questions_pyq_idx ON cgl_questions USING GIN (pyq_meta);
CREATE INDEX cgl_questions_ca_idx ON cgl_questions USING GIN (current_affairs_meta);

-- Draft sets may be built incrementally. A published set must have 4–5 children;
-- both the set and child writes are checked at commit, allowing atomic publishing.
CREATE FUNCTION cgl_check_question_set() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
    IF n > 5 OR (s.status = 'Published' AND n NOT BETWEEN 4 AND 5) THEN
      RAISE EXCEPTION 'Question set % must have at most 5 children and 4–5 when published', sid USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM cgl_questions q WHERE q.passage_set_id = sid AND
      (q.subject <> s.subject OR (s.exam_stage <> 'Both' AND q.exam_stage <> s.exam_stage)
       OR (q.status = 'Published' AND s.status <> 'Published'))) THEN
      RAISE EXCEPTION 'Question set % has an incompatible subject, stage, or publication state', sid USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cgl_question_set_from_set AFTER INSERT OR UPDATE OR DELETE ON cgl_question_sets
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cgl_check_question_set();
CREATE CONSTRAINT TRIGGER cgl_question_set_from_question AFTER INSERT OR UPDATE OR DELETE ON cgl_questions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cgl_check_question_set();

CREATE TABLE cgl_mock_blueprints (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  category TEXT NOT NULL CHECK (category IN ('Full_Tier1','Full_Tier2','Sectional_Tier1','Sectional_Tier2','Subject_Wise','Chapter_Drill','PYQ_Shift_Paper','CA_Monthly_2025','CA_Monthly_2026','CA_Full_Year_2025','CA_Full_Year_2026')),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  notice_year INTEGER,
  source_url TEXT,
  target_subject TEXT CHECK (target_subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  target_topic TEXT,
  target_sub_topic TEXT,
  ca_year INTEGER,
  ca_month INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, exam_stage),
  CHECK (category NOT IN ('Full_Tier1','Sectional_Tier1') OR exam_stage = 'Tier_1'),
  CHECK (category NOT IN ('Full_Tier2','Sectional_Tier2') OR exam_stage = 'Tier_2'),
  CHECK (category NOT IN ('Subject_Wise','Chapter_Drill') OR target_subject IS NOT NULL),
  CHECK (category <> 'Chapter_Drill' OR nullif(btrim(target_topic),'') IS NOT NULL),
  CHECK (target_topic IS NULL OR (target_subject IS NOT NULL AND length(btrim(target_topic)) > 0)),
  CHECK (target_sub_topic IS NULL OR (target_topic IS NOT NULL AND length(btrim(target_sub_topic)) > 0)),
  CHECK (COALESCE((category IN ('CA_Monthly_2025','CA_Full_Year_2025') AND ca_year = 2025)
      OR (category IN ('CA_Monthly_2026','CA_Full_Year_2026') AND ca_year = 2026)
      OR (category NOT LIKE 'CA_%' AND ca_year IS NULL), FALSE)),
  CHECK (COALESCE((category IN ('CA_Monthly_2025','CA_Monthly_2026') AND ca_month BETWEEN 1 AND 12)
      OR (category NOT IN ('CA_Monthly_2025','CA_Monthly_2026') AND ca_month IS NULL), FALSE))
);

CREATE TABLE cgl_blueprint_sections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blueprint_id BIGINT NOT NULL REFERENCES cgl_mock_blueprints(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL CHECK (length(btrim(section_code)) > 0),
  subject TEXT NOT NULL CHECK (subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  position INTEGER NOT NULL CHECK (position > 0),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  correct_marks NUMERIC(7,2) NOT NULL CHECK (correct_marks > 0),
  wrong_deduction NUMERIC(7,2) NOT NULL CHECK (wrong_deduction >= 0),
  time_limit_seconds INTEGER CHECK (time_limit_seconds > 0),
  counts_for_merit BOOLEAN NOT NULL,
  UNIQUE (id, blueprint_id, subject), UNIQUE (blueprint_id, position), UNIQUE (blueprint_id, subject),
  CHECK (subject <> 'Computer_Knowledge' OR counts_for_merit = FALSE)
);


-- The five-subject model is Paper I only. Marks follow the cited 2026 notice;
-- shorter drills keep their own actual maximum rather than being scaled up.
CREATE FUNCTION cgl_check_blueprint_section() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE stage TEXT;
BEGIN
  SELECT exam_stage INTO stage FROM cgl_mock_blueprints WHERE id=NEW.blueprint_id;
  IF (stage = 'Tier_1' AND (NEW.subject = 'Computer_Knowledge' OR NEW.correct_marks <> 2 OR NEW.wrong_deduction <> 0.5))
     OR (stage = 'Tier_2' AND (NEW.correct_marks <> 3 OR NEW.wrong_deduction <> 1))
     OR (NEW.subject <> 'Computer_Knowledge' AND NOT NEW.counts_for_merit) THEN
    RAISE EXCEPTION 'Section does not match the SSC CGL Paper I scoring scheme' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cgl_blueprint_scoring_guard BEFORE INSERT OR UPDATE ON cgl_blueprint_sections
  FOR EACH ROW EXECUTE FUNCTION cgl_check_blueprint_section();

CREATE TABLE cgl_mock_tests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blueprint_id BIGINT NOT NULL,
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  pyq_meta JSONB NOT NULL DEFAULT '{"is_pyq":false}'::jsonb CHECK (cgl_valid_pyq_meta(pyq_meta)),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, blueprint_id), UNIQUE (id, exam_stage),
  FOREIGN KEY (blueprint_id, exam_stage) REFERENCES cgl_mock_blueprints(id, exam_stage),
  CHECK (pyq_meta->>'is_pyq' <> 'true' OR pyq_meta->>'tier' = exam_stage)
);
CREATE TABLE cgl_mock_test_questions (
  mock_test_id BIGINT NOT NULL,
  blueprint_id BIGINT NOT NULL,
  section_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  subject TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  PRIMARY KEY (mock_test_id, question_id),
  UNIQUE (mock_test_id, position),
  FOREIGN KEY (mock_test_id, blueprint_id) REFERENCES cgl_mock_tests(id, blueprint_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, blueprint_id, subject) REFERENCES cgl_blueprint_sections(id, blueprint_id, subject),
  FOREIGN KEY (question_id, subject) REFERENCES cgl_questions(id, subject)
);

CREATE FUNCTION cgl_check_mock_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE test_stage TEXT; test_status TEXT; q_stage TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT status INTO test_status FROM cgl_mock_tests WHERE id = OLD.mock_test_id FOR UPDATE;
    IF test_status = 'Published' THEN RAISE EXCEPTION 'Published mock questions are immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT exam_stage, status INTO test_stage, test_status FROM cgl_mock_tests WHERE id = NEW.mock_test_id FOR UPDATE;
    IF test_status = 'Published' THEN RAISE EXCEPTION 'Published mock questions are immutable' USING ERRCODE='23514'; END IF;
    SELECT exam_stage INTO q_stage FROM cgl_questions WHERE id = NEW.question_id;
    IF q_stage IS NOT NULL AND q_stage <> 'Both' AND q_stage <> test_stage THEN
      RAISE EXCEPTION 'Question stage does not match the mock' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER cgl_mock_item_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_mock_test_questions
  FOR EACH ROW EXECUTE FUNCTION cgl_check_mock_item();

CREATE FUNCTION cgl_publish_mock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE kind TEXT; allowed_max INTEGER; b cgl_mock_blueprints%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.status = 'Published' THEN
    RAISE EXCEPTION 'Published mocks are immutable; create a new version' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.status = 'Published' THEN
    -- Serialize publication with concurrent edits to blueprint, sections,
    -- question content and shared sets before checking the final snapshot.
    SELECT * INTO b FROM cgl_mock_blueprints WHERE id=NEW.blueprint_id FOR UPDATE;
    PERFORM s.id FROM cgl_blueprint_sections s WHERE s.blueprint_id=NEW.blueprint_id ORDER BY s.id FOR UPDATE;
    PERFORM q.id FROM cgl_questions q JOIN cgl_mock_test_questions mq ON mq.question_id=q.id WHERE mq.mock_test_id=NEW.id ORDER BY q.id FOR UPDATE OF q;
    PERFORM ps.id FROM cgl_question_sets ps WHERE ps.id IN (SELECT q.passage_set_id FROM cgl_questions q JOIN cgl_mock_test_questions mq ON mq.question_id=q.id WHERE mq.mock_test_id=NEW.id AND q.passage_set_id IS NOT NULL) ORDER BY ps.id FOR UPDATE;
    kind := b.category;
    allowed_max := CASE WHEN NEW.exam_stage='Tier_1' THEN 200 ELSE 390 END;
    IF (SELECT COALESCE(SUM(question_count * correct_marks) FILTER (WHERE counts_for_merit),0) FROM cgl_blueprint_sections WHERE blueprint_id=NEW.blueprint_id) > allowed_max THEN
      RAISE EXCEPTION 'Blueprint exceeds the full-stage merit maximum' USING ERRCODE='23514';
    END IF;
    IF (kind = 'Full_Tier1' AND (SELECT COUNT(*) FROM cgl_blueprint_sections WHERE blueprint_id=NEW.blueprint_id AND subject IN ('Quant','Reasoning','English','General_Awareness') AND question_count=25) <> 4)
       OR (kind = 'Full_Tier2' AND (SELECT COUNT(*) FROM cgl_blueprint_sections WHERE blueprint_id=NEW.blueprint_id AND ((subject IN ('Quant','Reasoning') AND question_count=30) OR (subject='English' AND question_count=45) OR (subject='General_Awareness' AND question_count=25) OR (subject='Computer_Knowledge' AND question_count=20))) <> 5) THEN
      RAISE EXCEPTION 'Full mock does not match the SSC CGL Paper I distribution' USING ERRCODE='23514';
    END IF;
    IF (kind = 'Full_Tier1' AND EXISTS (SELECT 1 FROM cgl_blueprint_sections s WHERE s.blueprint_id=b.id AND s.time_limit_seconds IS DISTINCT FROM 900))
       OR (kind = 'Full_Tier2' AND EXISTS (SELECT 1 FROM cgl_blueprint_sections s WHERE s.blueprint_id=b.id AND s.time_limit_seconds IS DISTINCT FROM
         CASE s.subject WHEN 'Quant' THEN 1800 WHEN 'Reasoning' THEN 1800 WHEN 'English' THEN 2400 WHEN 'General_Awareness' THEN 1200 WHEN 'Computer_Knowledge' THEN 900 END)) THEN
      RAISE EXCEPTION 'Full mock timers do not match the 2026 SSC CGL notice' USING ERRCODE='23514';
    END IF;
    IF (b.target_subject IS NOT NULL AND EXISTS (SELECT 1 FROM cgl_blueprint_sections s WHERE s.blueprint_id=b.id AND s.subject<>b.target_subject))
       OR (b.target_topic IS NOT NULL AND EXISTS (SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id WHERE mq.mock_test_id=NEW.id AND (q.topic<>b.target_topic OR (b.target_sub_topic IS NOT NULL AND q.sub_topic<>b.target_sub_topic)))) THEN
      RAISE EXCEPTION 'Mock does not match its subject or chapter target' USING ERRCODE='23514';
    END IF;
    IF kind='PYQ_Shift_Paper' AND (NEW.pyq_meta->>'is_pyq'<>'true' OR EXISTS (
      SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id
      WHERE mq.mock_test_id=NEW.id AND (q.pyq_meta->>'is_pyq'<>'true' OR q.pyq_meta->>'year'<>NEW.pyq_meta->>'year'
        OR q.pyq_meta->>'tier'<>NEW.pyq_meta->>'tier' OR q.pyq_meta->>'exam_date'<>NEW.pyq_meta->>'exam_date' OR q.pyq_meta->>'shift'<>NEW.pyq_meta->>'shift'))) THEN
      RAISE EXCEPTION 'PYQ shift papers require matching verified PYQ metadata' USING ERRCODE='23514';
    END IF;
    IF kind LIKE 'CA_%' AND EXISTS (SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id
      WHERE mq.mock_test_id=NEW.id AND (q.current_affairs_meta->>'is_ca'<>'true'
        OR q.current_affairs_meta->>'year'<>b.ca_year::text OR (b.ca_month IS NOT NULL AND q.current_affairs_meta->>'month'<>b.ca_month::text))) THEN
      RAISE EXCEPTION 'Current-affairs mocks require questions matching their year and month' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id=mq.question_id
      WHERE mq.mock_test_id=NEW.id AND q.passage_set_id IS NOT NULL AND
      (SELECT COUNT(*) FROM cgl_questions child WHERE child.passage_set_id=q.passage_set_id) <>
      (SELECT COUNT(*) FROM cgl_mock_test_questions included JOIN cgl_questions child ON child.id=included.question_id
        WHERE included.mock_test_id=NEW.id AND child.passage_set_id=q.passage_set_id)) THEN
      RAISE EXCEPTION 'A mock must include the complete passage set' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cgl_blueprint_sections WHERE blueprint_id = NEW.blueprint_id)
       OR EXISTS (SELECT 1 FROM cgl_blueprint_sections s WHERE s.blueprint_id = NEW.blueprint_id
            AND (SELECT COUNT(*) FROM cgl_mock_test_questions mq WHERE mq.mock_test_id = NEW.id AND mq.section_id = s.id) <> s.question_count)
       OR EXISTS (SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_questions q ON q.id = mq.question_id
                  WHERE mq.mock_test_id = NEW.id AND (q.status <> 'Published' OR (q.exam_stage <> 'Both' AND q.exam_stage <> NEW.exam_stage))) THEN
      RAISE EXCEPTION 'Published mocks require reviewed questions matching every blueprint section' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cgl_mock_publish_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_mock_tests
  FOR EACH ROW EXECUTE FUNCTION cgl_publish_mock();

CREATE FUNCTION cgl_protect_published_content() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'cgl_questions' THEN
    -- Lock the parent set to serialize membership changes and publication.
    IF TG_OP <> 'DELETE' AND NEW.passage_set_id IS NOT NULL THEN
      PERFORM id FROM cgl_question_sets WHERE id=NEW.passage_set_id FOR UPDATE;
    END IF;
    IF TG_OP <> 'INSERT' AND EXISTS (
      SELECT 1 FROM cgl_mock_test_questions mq JOIN cgl_mock_tests m ON m.id=mq.mock_test_id
      WHERE mq.question_id=OLD.id AND m.status='Published') THEN
      RAISE EXCEPTION 'Questions in published mocks are immutable; create a new version' USING ERRCODE='23514';
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.passage_set_id IS NOT NULL AND
       (TG_OP = 'INSERT' OR NEW.passage_set_id IS DISTINCT FROM OLD.passage_set_id) AND EXISTS (
        SELECT 1 FROM cgl_questions q JOIN cgl_mock_test_questions mq ON mq.question_id=q.id
        JOIN cgl_mock_tests m ON m.id=mq.mock_test_id WHERE q.passage_set_id=NEW.passage_set_id AND m.status='Published') THEN
      RAISE EXCEPTION 'Passage sets used by published mocks cannot gain children' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'cgl_question_sets' AND EXISTS (
    SELECT 1 FROM cgl_questions q JOIN cgl_mock_test_questions mq ON mq.question_id=q.id
      JOIN cgl_mock_tests m ON m.id=mq.mock_test_id WHERE q.passage_set_id=OLD.id AND m.status='Published') THEN
    RAISE EXCEPTION 'Question sets in published mocks are immutable' USING ERRCODE='23514';
  ELSIF TG_TABLE_NAME = 'cgl_blueprint_sections' THEN
    IF TG_OP <> 'INSERT' THEN PERFORM id FROM cgl_mock_blueprints WHERE id=OLD.blueprint_id FOR UPDATE; END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM id FROM cgl_mock_blueprints WHERE id=NEW.blueprint_id FOR UPDATE; END IF;
    IF (TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM cgl_mock_tests m WHERE m.blueprint_id=OLD.blueprint_id AND m.status='Published'))
       OR (TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM cgl_mock_tests m WHERE m.blueprint_id=NEW.blueprint_id AND m.status='Published')) THEN
      RAISE EXCEPTION 'Blueprint sections used by published mocks are immutable' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'cgl_mock_blueprints' AND EXISTS (
    SELECT 1 FROM cgl_mock_tests m WHERE m.blueprint_id=OLD.id AND m.status='Published') THEN
    RAISE EXCEPTION 'Blueprints used by published mocks are immutable' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_question_published_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_questions FOR EACH ROW EXECUTE FUNCTION cgl_protect_published_content();
CREATE TRIGGER cgl_set_published_guard BEFORE UPDATE OR DELETE ON cgl_question_sets FOR EACH ROW EXECUTE FUNCTION cgl_protect_published_content();
CREATE TRIGGER cgl_section_published_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_blueprint_sections FOR EACH ROW EXECUTE FUNCTION cgl_protect_published_content();
CREATE TRIGGER cgl_blueprint_published_guard BEFORE UPDATE OR DELETE ON cgl_mock_blueprints FOR EACH ROW EXECUTE FUNCTION cgl_protect_published_content();

CREATE TABLE cgl_user_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id BIGINT NOT NULL,
  blueprint_id BIGINT NOT NULL,
  exam_stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('In_Progress','Submitted')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  merit_score NUMERIC(8,2),
  merit_out_of INTEGER NOT NULL CHECK ((exam_stage = 'Tier_1' AND merit_out_of = 200) OR (exam_stage = 'Tier_2' AND merit_out_of = 390)),
  actual_max_merit_score NUMERIC(8,2) NOT NULL CHECK (actual_max_merit_score >= 0 AND actual_max_merit_score <= merit_out_of),
  computer_score NUMERIC(8,2),
  computer_max_score NUMERIC(8,2) CHECK (computer_max_score >= 0),
  computer_qualifying_status TEXT NOT NULL CHECK (computer_qualifying_status IN ('Not_Applicable','Pending','Qualified','Not_Qualified')),
  UNIQUE (id, mock_test_id), UNIQUE (id, mock_test_id, blueprint_id),
  FOREIGN KEY (mock_test_id, exam_stage) REFERENCES cgl_mock_tests(id, exam_stage),
  FOREIGN KEY (mock_test_id, blueprint_id) REFERENCES cgl_mock_tests(id, blueprint_id),
  CHECK ((status = 'Submitted' AND submitted_at IS NOT NULL AND merit_score IS NOT NULL) OR (status = 'In_Progress' AND submitted_at IS NULL AND merit_score IS NULL)),
  CHECK (merit_score IS NULL OR merit_score <= actual_max_merit_score),
  CHECK ((computer_qualifying_status = 'Not_Applicable' AND computer_score IS NULL AND computer_max_score IS NULL)
      OR (computer_qualifying_status <> 'Not_Applicable' AND exam_stage = 'Tier_2' AND computer_score IS NOT NULL AND computer_max_score IS NOT NULL))
);
CREATE INDEX cgl_attempt_user_idx ON cgl_user_attempts(user_id, started_at DESC);

CREATE TABLE cgl_attempt_sections (
  attempt_id BIGINT NOT NULL,
  mock_test_id BIGINT NOT NULL,
  blueprint_id BIGINT NOT NULL,
  section_id BIGINT NOT NULL,
  subject TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count >= 0),
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  wrong_count INTEGER NOT NULL CHECK (wrong_count >= 0),
  skipped_count INTEGER NOT NULL CHECK (skipped_count >= 0),
  score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL CHECK (max_score >= 0),
  PRIMARY KEY (attempt_id, section_id),
  FOREIGN KEY (attempt_id, mock_test_id, blueprint_id) REFERENCES cgl_user_attempts(id, mock_test_id, blueprint_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, blueprint_id, subject) REFERENCES cgl_blueprint_sections(id, blueprint_id, subject),
  CHECK (correct_count + wrong_count + skipped_count = question_count)
);
CREATE TABLE cgl_attempt_answers (
  attempt_id BIGINT NOT NULL,
  mock_test_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_option_index SMALLINT CHECK (selected_option_index BETWEEN 0 AND 3),
  option_state TEXT NOT NULL CHECK (option_state IN ('Not_Visited','Not_Answered','Answered','Marked_For_Review','Answered_And_Marked')),
  time_spent_seconds INTEGER NOT NULL CHECK (time_spent_seconds >= 0),
  is_correct BOOLEAN,
  awarded_marks NUMERIC(7,2),
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id, mock_test_id) REFERENCES cgl_user_attempts(id, mock_test_id) ON DELETE CASCADE,
  FOREIGN KEY (mock_test_id, question_id) REFERENCES cgl_mock_test_questions(mock_test_id, question_id),
  CHECK ((option_state IN ('Answered','Answered_And_Marked') AND selected_option_index IS NOT NULL)
      OR (option_state IN ('Not_Visited','Not_Answered','Marked_For_Review') AND selected_option_index IS NULL)),
  CHECK (selected_option_index IS NOT NULL OR is_correct IS NULL)
);
