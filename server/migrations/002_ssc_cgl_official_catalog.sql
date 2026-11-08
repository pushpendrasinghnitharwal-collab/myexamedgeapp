-- Additive catalogue only: leaves accounts, attempts, questions and mocks intact.
CREATE TABLE cgl_official_blueprints (
  blueprint_key TEXT PRIMARY KEY,
  blueprint_id BIGINT NOT NULL UNIQUE REFERENCES cgl_mock_blueprints(id) ON DELETE RESTRICT,
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  notice_year INTEGER NOT NULL,
  source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
  details JSONB NOT NULL CHECK (jsonb_typeof(details) = 'object'),
  FOREIGN KEY (blueprint_id, exam_stage) REFERENCES cgl_mock_blueprints(id, exam_stage)
);

CREATE TABLE cgl_catalog_subjects (
  subject TEXT PRIMARY KEY CHECK (subject IN ('Quant','Reasoning','English','General_Awareness','Computer_Knowledge')),
  label TEXT NOT NULL CHECK (length(btrim(label)) > 0),
  position INTEGER NOT NULL UNIQUE
);
CREATE TABLE cgl_catalog_topics (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL REFERENCES cgl_catalog_subjects(subject),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  provenance TEXT NOT NULL CHECK (provenance IN ('notice_mapped','editorial_detail')),
  UNIQUE (id, subject), UNIQUE (subject, name, provenance)
);
CREATE TABLE cgl_catalog_subtopics (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  UNIQUE (id, subject), UNIQUE (topic_id, name),
  FOREIGN KEY (topic_id, subject) REFERENCES cgl_catalog_topics(id, subject) ON DELETE RESTRICT
);
CREATE TABLE cgl_catalog_subtopic_stages (
  subtopic_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  canonical_topic TEXT NOT NULL,
  canonical_sub_topic TEXT NOT NULL,
  PRIMARY KEY (subtopic_id, exam_stage),
  FOREIGN KEY (subtopic_id, subject) REFERENCES cgl_catalog_subtopics(id, subject) ON DELETE RESTRICT,
  FOREIGN KEY (subject, canonical_topic, canonical_sub_topic, exam_stage)
    REFERENCES cgl_syllabus(subject, topic, sub_topic, exam_stage) ON DELETE RESTRICT
);
CREATE INDEX cgl_catalog_subject_stage_idx ON cgl_catalog_subtopic_stages(subject, exam_stage);

-- Official templates must not diverge from the rule data after they are linked.
-- Editors can create separate custom blueprints rather than mutate a template.
CREATE FUNCTION cgl_guard_official_blueprint() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE old_id BIGINT; new_id BIGINT;
BEGIN
  IF TG_TABLE_NAME='cgl_mock_blueprints' THEN
    old_id := OLD.id;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_id := OLD.blueprint_id; END IF;
    IF TG_OP <> 'DELETE' THEN new_id := NEW.blueprint_id; END IF;
    IF old_id IS NOT NULL THEN PERFORM id FROM cgl_mock_blueprints WHERE id=old_id FOR UPDATE; END IF;
    IF new_id IS NOT NULL THEN PERFORM id FROM cgl_mock_blueprints WHERE id=new_id FOR UPDATE; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM cgl_official_blueprints WHERE blueprint_id=old_id OR blueprint_id=new_id) THEN
    RAISE EXCEPTION 'Official blueprint templates are immutable; create a custom blueprint instead' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_official_blueprint_guard BEFORE UPDATE OR DELETE ON cgl_mock_blueprints
  FOR EACH ROW EXECUTE FUNCTION cgl_guard_official_blueprint();
CREATE TRIGGER cgl_official_section_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_blueprint_sections
  FOR EACH ROW EXECUTE FUNCTION cgl_guard_official_blueprint();

CREATE TABLE cgl_catalog_seed_versions (
  seed_key TEXT PRIMARY KEY,
  data_checksum TEXT NOT NULL,
  expected_counts JSONB NOT NULL CHECK (jsonb_typeof(expected_counts) = 'object'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE FUNCTION cgl_guard_official_catalog_row() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Official rule snapshots are immutable; add a new version' USING ERRCODE='23514';
END $$;
CREATE TRIGGER cgl_official_catalog_row_guard BEFORE UPDATE OR DELETE ON cgl_official_blueprints
  FOR EACH ROW EXECUTE FUNCTION cgl_guard_official_catalog_row();
