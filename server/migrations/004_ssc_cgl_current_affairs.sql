-- Additive CA events, AI drafts, assembled mocks and attempts. No news or
-- questions are seeded. Editorial weights are not official SSC/TCS statistics.
CREATE TABLE cgl_ca_imports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  manifest_sha256 TEXT NOT NULL UNIQUE CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  import_manifest JSONB NOT NULL CHECK (jsonb_typeof(import_manifest)='object'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE cgl_ca_sources (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_id BIGINT NOT NULL REFERENCES cgl_ca_imports(id),
  source_ref TEXT NOT NULL CHECK (length(btrim(source_ref)) BETWEEN 1 AND 120),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://[^[:space:]]+$'),
  evidence_sha256 TEXT NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  rights_sha256 TEXT NOT NULL CHECK (rights_sha256 ~ '^[0-9a-f]{64}$'),
  rights_reference TEXT NOT NULL CHECK (length(btrim(rights_reference)) BETWEEN 1 AND 1000),
  allow_republication BOOLEAN NOT NULL,
  allow_derivatives BOOLEAN NOT NULL,
  allow_external_processing BOOLEAN NOT NULL,
  UNIQUE(import_id,source_ref), UNIQUE(import_id,id)
);

CREATE TABLE cgl_ca_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  import_id BIGINT NOT NULL REFERENCES cgl_ca_imports(id),
  event_key TEXT NOT NULL CHECK (event_key ~ '^[a-z0-9][a-z0-9._-]{0,119}$'),
  event_date DATE NOT NULL CHECK (event_date BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'),
  category TEXT NOT NULL CHECK (category IN ('Schemes','Sports','Awards','Appointments','Military_Exercises','Rankings_Indexes','Budget_Economy','Science_Space')),
  award_group TEXT CHECK (award_group IN ('Padma','National','International','Other')),
  editorial_priority INTEGER NOT NULL CHECK (editorial_priority BETWEEN 1 AND 5),
  title_en TEXT NOT NULL CHECK (length(btrim(title_en)) BETWEEN 1 AND 300),
  fact_en TEXT NOT NULL CHECK (length(btrim(fact_en)) BETWEEN 1 AND 10000),
  event_source_id BIGINT NOT NULL,
  static_source_id BIGINT NOT NULL,
  static_title_en TEXT NOT NULL CHECK (length(btrim(static_title_en)) BETWEEN 1 AND 300),
  static_title_hi TEXT NOT NULL CHECK (length(btrim(static_title_hi)) BETWEEN 1 AND 300),
  static_fact_en TEXT NOT NULL CHECK (length(btrim(static_fact_en)) BETWEEN 1 AND 3000),
  static_fact_hi TEXT NOT NULL CHECK (length(btrim(static_fact_hi)) BETWEEN 1 AND 3000),
  static_link_en TEXT NOT NULL CHECK (length(btrim(static_link_en)) BETWEEN 1 AND 1000),
  static_link_hi TEXT NOT NULL CHECK (length(btrim(static_link_hi)) BETWEEN 1 AND 1000),
  static_translation_note TEXT NOT NULL CHECK (length(btrim(static_translation_note)) BETWEEN 1 AND 1000),
  static_as_of DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Withdrawn','Rejected')),
  reviewed_by TEXT,review_notes TEXT,reviewed_at TIMESTAMPTZ,
  withdrawn_by TEXT,withdrawal_notes TEXT,withdrawn_at TIMESTAMPTZ,
  rejected_by TEXT,rejection_notes TEXT,rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(import_id,event_source_id) REFERENCES cgl_ca_sources(import_id,id),
  FOREIGN KEY(import_id,static_source_id) REFERENCES cgl_ca_sources(import_id,id),
  CHECK ((category='Awards' AND award_group IS NOT NULL) OR (category<>'Awards' AND award_group IS NULL)),
  CHECK (status IN ('Draft','Rejected') OR (nullif(btrim(reviewed_by),'') IS NOT NULL AND nullif(btrim(review_notes),'') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status<>'Withdrawn' OR (nullif(btrim(withdrawn_by),'') IS NOT NULL AND nullif(btrim(withdrawal_notes),'') IS NOT NULL AND withdrawn_at IS NOT NULL)),
  CHECK (status<>'Rejected' OR (nullif(btrim(rejected_by),'') IS NOT NULL AND nullif(btrim(rejection_notes),'') IS NOT NULL AND rejected_at IS NOT NULL))
);
CREATE UNIQUE INDEX cgl_ca_active_event_key ON cgl_ca_events(event_key) WHERE status IN ('Draft','Published');
CREATE INDEX cgl_ca_events_period_idx ON cgl_ca_events(status,event_date,category);

-- Published data can only be withdrawn, not silently corrected underneath an attempt.
CREATE FUNCTION cgl_guard_ca_source() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Imported CA evidence records are immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER cgl_ca_import_guard BEFORE UPDATE OR DELETE ON cgl_ca_imports FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_source();
CREATE TRIGGER cgl_ca_source_guard BEFORE UPDATE OR DELETE ON cgl_ca_sources FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_source();
CREATE FUNCTION cgl_guard_ca_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE permitted BOOLEAN; today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF TG_OP='INSERT' AND NEW.status<>'Draft' THEN RAISE EXCEPTION 'CA events must begin as drafts' USING ERRCODE='23514'; END IF;
  IF TG_OP<>'INSERT' AND OLD.status IN ('Published','Withdrawn','Rejected') THEN
    IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Withdrawn' AND
       (to_jsonb(NEW)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) =
       (to_jsonb(OLD)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Published or withdrawn CA events are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='Draft' AND NEW.status='Rejected' AND
     (to_jsonb(NEW)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) =
     (to_jsonb(OLD)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='Draft' AND NEW.status NOT IN ('Draft','Published') THEN
    RAISE EXCEPTION 'Invalid CA event status transition' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='Published' THEN
    IF (to_jsonb(NEW)-ARRAY['status','reviewed_by','review_notes','reviewed_at']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','reviewed_by','review_notes','reviewed_at']) THEN
      RAISE EXCEPTION 'CA event provenance cannot change during approval' USING ERRCODE='23514';
    END IF;
    SELECT a.allow_republication AND b.allow_republication INTO permitted FROM cgl_ca_sources a,cgl_ca_sources b
      WHERE a.id=NEW.event_source_id AND b.id=NEW.static_source_id;
    IF permitted IS DISTINCT FROM TRUE OR NEW.event_date>today_ist OR NEW.static_as_of>today_ist THEN
      RAISE EXCEPTION 'Event and static facts require permitted, non-future sources' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_ca_event_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_ca_events FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_event();

CREATE TABLE cgl_ca_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES cgl_ca_events(id),
  generator_model TEXT NOT NULL,solver_model TEXT NOT NULL,auditor_model TEXT NOT NULL,
  content JSONB NOT NULL CHECK (jsonb_typeof(content)='object'),
  verification JSONB NOT NULL CHECK (jsonb_typeof(verification)='object'),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  verification_sha256 TEXT NOT NULL CHECK (verification_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'Verified_Draft' CHECK (status IN ('Verified_Draft','Published','Withdrawn','Rejected')),
  reviewed_by TEXT,review_notes TEXT,reviewed_at TIMESTAMPTZ,
  withdrawn_by TEXT,withdrawal_notes TEXT,withdrawn_at TIMESTAMPTZ,
  rejected_by TEXT,rejection_notes TEXT,rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id,event_id),
  CHECK (status IN ('Verified_Draft','Rejected') OR (nullif(btrim(reviewed_by),'') IS NOT NULL AND nullif(btrim(review_notes),'') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status<>'Withdrawn' OR (nullif(btrim(withdrawn_by),'') IS NOT NULL AND nullif(btrim(withdrawal_notes),'') IS NOT NULL AND withdrawn_at IS NOT NULL)),
  CHECK (status<>'Rejected' OR (nullif(btrim(rejected_by),'') IS NOT NULL AND nullif(btrim(rejection_notes),'') IS NOT NULL AND rejected_at IS NOT NULL))
);
CREATE UNIQUE INDEX cgl_ca_active_question_event ON cgl_ca_questions(event_id) WHERE status IN ('Verified_Draft','Published');
CREATE INDEX cgl_ca_questions_public_idx ON cgl_ca_questions(status,event_id);
CREATE FUNCTION cgl_guard_ca_question() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE usable BOOLEAN;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'Verified_Draft' THEN RAISE EXCEPTION 'CA AI questions require review after automated checks' USING ERRCODE='23514'; END IF;
    SELECT (e.status='Published' AND s.allow_republication AND s.allow_derivatives AND s.allow_external_processing
      AND t.allow_republication AND t.allow_derivatives AND t.allow_external_processing) INTO usable
      FROM cgl_ca_events e JOIN cgl_ca_sources s ON s.id=e.event_source_id JOIN cgl_ca_sources t ON t.id=e.static_source_id WHERE e.id=NEW.event_id;
    IF usable IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'CA source or static source lacks publication and processing permissions' USING ERRCODE='23514'; END IF;
    IF NEW.verification->>'source_grounded_solver' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Independent source-grounded verification is required' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP<>'INSERT' AND OLD.status IN ('Published','Withdrawn','Rejected') THEN
    IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Withdrawn' AND
      (to_jsonb(NEW)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) =
      (to_jsonb(OLD)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Published or withdrawn CA questions are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='Verified_Draft' AND NEW.status='Rejected' AND
     (to_jsonb(NEW)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) =
     (to_jsonb(OLD)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='Verified_Draft' AND NEW.status NOT IN ('Verified_Draft','Published') THEN
    RAISE EXCEPTION 'Invalid CA question status transition' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='Published' AND
    ((to_jsonb(NEW)-ARRAY['status','reviewed_by','review_notes','reviewed_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','reviewed_by','review_notes','reviewed_at'])
      OR NOT EXISTS (SELECT 1 FROM cgl_ca_events e WHERE e.id=NEW.event_id AND e.status='Published')) THEN
    RAISE EXCEPTION 'CA verified content and active source cannot change while approving' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_ca_question_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_ca_questions FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_question();

CREATE TABLE cgl_ca_mocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  active_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('Monthly','Weekly','Annual','Category')),
  exam_stage TEXT NOT NULL CHECK (exam_stage IN ('Tier_1','Tier_2')),
  year INTEGER NOT NULL CHECK (year IN (2025,2026)),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  week INTEGER CHECK (week BETWEEN 1 AND 5),
  category TEXT CHECK (category IN ('Schemes','Sports','Awards','Appointments','Military_Exercises','Rankings_Indexes','Budget_Economy','Science_Space')),
  award_group TEXT CHECK (award_group IN ('Padma','National','International','Other')),
  period_start DATE NOT NULL,period_end DATE NOT NULL,as_of_date DATE NOT NULL,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  target_count INTEGER NOT NULL,
  correct_marks NUMERIC(7,2) NOT NULL,wrong_deduction NUMERIC(7,2) NOT NULL,
  selection_policy JSONB NOT NULL CHECK (jsonb_typeof(selection_policy)='object'),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Withdrawn','Rejected')),
  reviewed_by TEXT,review_notes TEXT,reviewed_at TIMESTAMPTZ,
  withdrawn_by TEXT,withdrawal_notes TEXT,withdrawn_at TIMESTAMPTZ,
  rejected_by TEXT,rejection_notes TEXT,rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_start<=period_end AND period_end<=as_of_date),
  CHECK (award_group IS NULL OR (kind='Category' AND category='Awards')),
  CHECK (CASE
    WHEN kind='Annual' THEN period_start=make_date(year,1,1) AND period_end=make_date(year,12,31)
    WHEN kind='Monthly' THEN period_start=make_date(year,month,1) AND period_end=(make_date(year,month,1)+INTERVAL '1 month - 1 day')::date
    WHEN kind='Weekly' THEN period_start=make_date(year,month,1)+(week-1)*7 AND EXTRACT(MONTH FROM period_start)=month
      AND period_end=LEAST(period_start+6,(make_date(year,month,1)+INTERVAL '1 month - 1 day')::date)
    WHEN kind='Category' AND month IS NULL THEN period_start=make_date(year,1,1) AND period_end=LEAST(as_of_date,make_date(year,12,31))
    WHEN kind='Category' THEN period_start=make_date(year,month,1) AND period_end=LEAST(as_of_date,(make_date(year,month,1)+INTERVAL '1 month - 1 day')::date)
    ELSE FALSE END),
  CHECK ((exam_stage='Tier_1' AND correct_marks=2 AND wrong_deduction=0.5) OR (exam_stage='Tier_2' AND correct_marks=3 AND wrong_deduction=1)),
  CHECK ((kind='Monthly' AND month IS NOT NULL AND week IS NULL AND category IS NULL AND target_count=50)
      OR (kind='Weekly' AND month IS NOT NULL AND week IS NOT NULL AND category IS NULL AND target_count=20)
      OR (kind='Annual' AND month IS NULL AND week IS NULL AND category IS NULL AND target_count=100)
      OR (kind='Category' AND week IS NULL AND category IS NOT NULL AND target_count=20)),
  CHECK (status IN ('Draft','Rejected') OR (nullif(btrim(reviewed_by),'') IS NOT NULL AND nullif(btrim(review_notes),'') IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status<>'Withdrawn' OR (nullif(btrim(withdrawn_by),'') IS NOT NULL AND nullif(btrim(withdrawal_notes),'') IS NOT NULL AND withdrawn_at IS NOT NULL)),
  CHECK (status<>'Rejected' OR (nullif(btrim(rejected_by),'') IS NOT NULL AND nullif(btrim(rejection_notes),'') IS NOT NULL AND rejected_at IS NOT NULL))
);
CREATE UNIQUE INDEX cgl_ca_active_mock ON cgl_ca_mocks(active_key) WHERE status IN ('Draft','Published');
CREATE INDEX cgl_ca_mock_search_idx ON cgl_ca_mocks(status,kind,year,month,category);
CREATE TABLE cgl_ca_mock_items (
  mock_id BIGINT NOT NULL REFERENCES cgl_ca_mocks(id),
  question_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  position INTEGER NOT NULL CHECK (position>0),
  PRIMARY KEY(mock_id,question_id),UNIQUE(mock_id,event_id),UNIQUE(mock_id,position),
  FOREIGN KEY(question_id,event_id) REFERENCES cgl_ca_questions(id,event_id)
);
CREATE FUNCTION cgl_guard_ca_mock_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE mock_status TEXT;
BEGIN
  IF TG_OP<>'INSERT' THEN
    SELECT status INTO mock_status FROM cgl_ca_mocks WHERE id=OLD.mock_id FOR UPDATE;
    IF mock_status IN ('Published','Withdrawn','Rejected') THEN RAISE EXCEPTION 'Published CA mock items are immutable' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT status INTO mock_status FROM cgl_ca_mocks WHERE id=NEW.mock_id FOR UPDATE;
    IF mock_status IN ('Published','Withdrawn','Rejected') THEN RAISE EXCEPTION 'Published CA mock items are immutable' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_ca_mock_item_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_ca_mock_items FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_mock_item();
CREATE FUNCTION cgl_guard_ca_mock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF TG_OP='INSERT' AND NEW.status<>'Draft' THEN RAISE EXCEPTION 'CA mocks must start as drafts' USING ERRCODE='23514'; END IF;
  IF TG_OP<>'INSERT' AND OLD.status IN ('Published','Withdrawn','Rejected') THEN
    IF TG_OP='UPDATE' AND OLD.status='Published' AND NEW.status='Withdrawn' AND
      (to_jsonb(NEW)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) =
      (to_jsonb(OLD)-ARRAY['status','withdrawn_by','withdrawal_notes','withdrawn_at']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Published or withdrawn CA mocks are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='Draft' AND NEW.status='Rejected' AND
     (to_jsonb(NEW)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) =
     (to_jsonb(OLD)-ARRAY['status','rejected_by','rejection_notes','rejected_at']) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='Draft' AND NEW.status NOT IN ('Draft','Published') THEN
    RAISE EXCEPTION 'Invalid CA mock status transition' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='Published' THEN
    IF (to_jsonb(NEW)-ARRAY['status','reviewed_by','review_notes','reviewed_at']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['status','reviewed_by','review_notes','reviewed_at']) THEN
      RAISE EXCEPTION 'CA mock rules cannot change during approval' USING ERRCODE='23514';
    END IF;
    -- Serialize publication with source and question withdrawal.
    PERFORM q.id FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id
      JOIN cgl_ca_events e ON e.id=i.event_id WHERE i.mock_id=NEW.id ORDER BY q.id FOR SHARE OF q,e;
    IF NEW.as_of_date>today_ist OR (NEW.kind IN ('Monthly','Weekly','Annual') AND NEW.period_end>=today_ist)
      OR (SELECT COUNT(*) FROM cgl_ca_mock_items WHERE mock_id=NEW.id)<>NEW.target_count
      OR EXISTS (SELECT 1 FROM cgl_ca_mock_items i WHERE i.mock_id=NEW.id AND i.position>NEW.target_count)
      OR EXISTS (SELECT 1 FROM cgl_ca_mock_items i JOIN cgl_ca_questions q ON q.id=i.question_id JOIN cgl_ca_events e ON e.id=i.event_id
        WHERE i.mock_id=NEW.id AND (q.status<>'Published' OR e.status<>'Published' OR e.event_date NOT BETWEEN NEW.period_start AND NEW.period_end
          OR (NEW.category IS NOT NULL AND e.category<>NEW.category) OR (NEW.award_group IS NOT NULL AND e.award_group<>NEW.award_group))) THEN
      RAISE EXCEPTION 'CA mock requires a completed period and the exact number of active reviewed, matching questions' USING ERRCODE='23514';
    END IF;
    IF NEW.kind='Annual' AND (SELECT COUNT(DISTINCT EXTRACT(MONTH FROM e.event_date)) FROM cgl_ca_mock_items i JOIN cgl_ca_events e ON e.id=i.event_id WHERE i.mock_id=NEW.id)<>12 THEN
      RAISE EXCEPTION 'Annual mock requires coverage from all twelve months' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER cgl_ca_mock_guard BEFORE INSERT OR UPDATE OR DELETE ON cgl_ca_mocks FOR EACH ROW EXECUTE FUNCTION cgl_guard_ca_mock();

CREATE TABLE cgl_ca_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_id BIGINT NOT NULL REFERENCES cgl_ca_mocks(id),
  score NUMERIC(9,2) NOT NULL,max_score NUMERIC(9,2) NOT NULL CHECK (max_score>=0),
  results JSONB NOT NULL CHECK (jsonb_typeof(results)='array'),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX cgl_ca_attempts_user_idx ON cgl_ca_attempts(user_id,submitted_at DESC);
