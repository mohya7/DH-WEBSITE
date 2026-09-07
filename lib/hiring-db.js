'use strict';

const crypto = require('crypto');
const sql = require('mssql');

let pool = null;

function requireSqlServerEnv() {
  const host = process.env.SQLSERVER_HOST;
  const database = process.env.SQLSERVER_DATABASE;
  const user = process.env.SQLSERVER_USER;
  const password = process.env.SQLSERVER_PASSWORD;
  const missing = [];
  if (!host) missing.push('SQLSERVER_HOST');
  if (!database) missing.push('SQLSERVER_DATABASE');
  if (!user) missing.push('SQLSERVER_USER');
  if (!password) missing.push('SQLSERVER_PASSWORD');
  if (missing.length) {
    console.error(`[fatal] SQL Server hiring store requires: ${missing.join(', ')}. Set them in the environment before starting the server.`);
    process.exit(1);
  }
  return { host, database, user, password };
}

async function openHiringDb() {
  if (pool) return pool;
  const { host, database, user, password } = requireSqlServerEnv();
  pool = await sql.connect({
    server: host,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });
  return pool;
}

function getHiringDb() {
  if (!pool) {
    throw new Error('Hiring SQL Server pool is not open. Call openHiringDb() at startup first.');
  }
  return pool;
}

/* Inbox event types — application list, not a SQL CHECK. Later sections add here. */
const NOTIFICATION_EVENT_TYPES = new Set([
  'application_submitted',
  'pipeline_started',
  'phone_decided',
  'task_needs_review',
  'task_decided',
  'interviewer_assigned',
  'booking_sent',
  'booking_booked',
  'booking_expired',
  'join_link_needed',
  'interview_upcoming',
  'feedback_due',
  'feedback_recorded',
  'feedback_amended',
  'offer_changed',
  'onboarding_returned',
  'onboarding_created',
  'booking_rescheduled',
  'booking_reschedule_limit',
  'hr_round_scheduled',
  'hr_round_rescheduled',
  'round_cancelled',
  'interviewer_stranded',
  'recurring_stopped',
  'recurring_extend_failed',
  'recurring_horizon_short',
  'contact_submitted',
]);

const NOTIFICATION_UNREAD_DAYS = 90;
const NOTIFICATION_READ_DAYS = 30;

async function ensureHiringSchema(database = getHiringDb()) {
  // Idempotent: IF OBJECT_ID / IF NOT EXISTS index guards — safe every startup.
  await database.request().query(`
    IF OBJECT_ID(N'dbo.applications', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.applications (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        reference NVARCHAR(64) NOT NULL,
        role NVARCHAR(256) NOT NULL,
        role_slug NVARCHAR(256) NOT NULL CONSTRAINT DF_applications_role_slug DEFAULT (N''),
        full_name NVARCHAR(256) NOT NULL,
        phone NVARCHAR(64) NOT NULL,
        email NVARCHAR(320) NOT NULL,
        current_salary NVARCHAR(64) NOT NULL CONSTRAINT DF_applications_current_salary DEFAULT (N''),
        years_experience NVARCHAR(64) NOT NULL CONSTRAINT DF_applications_years_experience DEFAULT (N''),
        expected_salary NVARCHAR(64) NOT NULL CONSTRAINT DF_applications_expected_salary DEFAULT (N''),
        notice_period_weeks INT NOT NULL CONSTRAINT DF_applications_notice_period_weeks DEFAULT (0),
        linkedin NVARCHAR(2048) NOT NULL CONSTRAINT DF_applications_linkedin DEFAULT (N''),
        resume_name NVARCHAR(512) NOT NULL CONSTRAINT DF_applications_resume_name DEFAULT (N''),
        resume_file NVARCHAR(512) NOT NULL CONSTRAINT DF_applications_resume_file DEFAULT (N''),
        resume_pending INT NOT NULL CONSTRAINT DF_applications_resume_pending DEFAULT (0),
        status NVARCHAR(32) NOT NULL CONSTRAINT DF_applications_status DEFAULT (N'new'),
        pipeline NVARCHAR(MAX) NULL,
        task_reviewed_by NVARCHAR(120) NOT NULL CONSTRAINT DF_applications_task_reviewed_by DEFAULT (N''),
        task_reviewed_by_user_id NVARCHAR(80) NOT NULL CONSTRAINT DF_applications_task_reviewed_by_user_id DEFAULT (N''),
        task_score DECIMAL(4,1) NULL,
        first_contacted_at NVARCHAR(40) NULL,
        submitted_at NVARCHAR(40) NOT NULL,
        updated_at NVARCHAR(40) NOT NULL
      );
    END;

    IF OBJECT_ID(N'dbo.onboarding_requests', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.onboarding_requests (
        id NVARCHAR(64) NOT NULL PRIMARY KEY,
        application_id NVARCHAR(64) NOT NULL,
        reference NVARCHAR(64) NOT NULL CONSTRAINT DF_onboarding_reference DEFAULT (N''),
        full_name NVARCHAR(256) NOT NULL CONSTRAINT DF_onboarding_full_name DEFAULT (N''),
        job_title NVARCHAR(256) NOT NULL CONSTRAINT DF_onboarding_job_title DEFAULT (N''),
        email NVARCHAR(320) NOT NULL CONSTRAINT DF_onboarding_email DEFAULT (N''),
        mobile NVARCHAR(64) NOT NULL CONSTRAINT DF_onboarding_mobile DEFAULT (N''),
        linkedin NVARCHAR(2048) NOT NULL CONSTRAINT DF_onboarding_linkedin DEFAULT (N''),
        id_number NVARCHAR(64) NOT NULL CONSTRAINT DF_onboarding_id_number DEFAULT (N''),
        status NVARCHAR(32) NOT NULL CONSTRAINT DF_onboarding_status DEFAULT (N'draft'),
        assets NVARCHAR(MAX) NOT NULL CONSTRAINT DF_onboarding_assets DEFAULT (N'{}'),
        notes_hr NVARCHAR(MAX) NOT NULL CONSTRAINT DF_onboarding_notes_hr DEFAULT (N''),
        notes_marketing NVARCHAR(MAX) NOT NULL CONSTRAINT DF_onboarding_notes_marketing DEFAULT (N''),
        created_by NVARCHAR(128) NOT NULL CONSTRAINT DF_onboarding_created_by DEFAULT (N''),
        sent_at NVARCHAR(40) NULL,
        returned_at NVARCHAR(40) NULL,
        completed_at NVARCHAR(40) NULL,
        created_at NVARCHAR(40) NOT NULL,
        updated_at NVARCHAR(40) NOT NULL,
        CONSTRAINT FK_onboarding_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID(N'dbo.deletion_log', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.deletion_log (
        id INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        entity_type NVARCHAR(64) NOT NULL,
        entity_id NVARCHAR(64) NOT NULL,
        deleted_at NVARCHAR(40) NOT NULL,
        deleted_by NVARCHAR(128) NOT NULL
      );
    END;

    IF OBJECT_ID(N'dbo.admin_users', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.admin_users (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        username NVARCHAR(40) NOT NULL,
        name NVARCHAR(100) NOT NULL CONSTRAINT DF_admin_users_name DEFAULT (N''),
        email NVARCHAR(160) NOT NULL CONSTRAINT DF_admin_users_email DEFAULT (N''),
        job_title NVARCHAR(120) NOT NULL CONSTRAINT DF_admin_users_job_title DEFAULT (N''),
        photo NVARCHAR(300) NOT NULL CONSTRAINT DF_admin_users_photo DEFAULT (N''),
        role NVARCHAR(32) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_admin_users_active DEFAULT (1),
        password_hash NVARCHAR(200) NULL,
        must_set_password BIT NOT NULL CONSTRAINT DF_admin_users_must_set_password DEFAULT (0),
        invite_token_hash NVARCHAR(64) NULL,
        invite_expires_at NVARCHAR(40) NULL,
        created_at NVARCHAR(40) NOT NULL,
        updated_at NVARCHAR(40) NOT NULL,
        last_login_at NVARCHAR(40) NULL
      );
    END;

    IF OBJECT_ID(N'dbo.application_resumes', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.application_resumes (
        application_id NVARCHAR(64) NOT NULL PRIMARY KEY,
        file_name NVARCHAR(512) NOT NULL,
        content_type NVARCHAR(128) NOT NULL,
        byte_size BIGINT NOT NULL,
        content VARBINARY(MAX) NOT NULL,
        CONSTRAINT FK_application_resumes_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID(N'dbo.interviewers', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.interviewers (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        title NVARCHAR(120) NOT NULL CONSTRAINT DF_interviewers_title DEFAULT (N''),
        email NVARCHAR(160) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_interviewers_active DEFAULT (1),
        created_at NVARCHAR(40) NOT NULL,
        updated_at NVARCHAR(40) NOT NULL
      );
    END;

    IF COL_LENGTH(N'dbo.interviewers', N'title') IS NULL
      ALTER TABLE dbo.interviewers ADD title NVARCHAR(120) NOT NULL
        CONSTRAINT DF_interviewers_title DEFAULT (N'');

    /* NULL / empty JSON array = all interview stages. Same MAX width as other JSON columns. */
    IF COL_LENGTH(N'dbo.admin_users', N'interview_stages') IS NULL
      ALTER TABLE dbo.admin_users ADD interview_stages NVARCHAR(MAX) NULL;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_admin_users_username' AND object_id = OBJECT_ID(N'dbo.admin_users')
    )
      CREATE UNIQUE INDEX UQ_admin_users_username ON dbo.admin_users(username);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_applications_role_slug' AND object_id = OBJECT_ID(N'dbo.applications')
    )
      CREATE INDEX idx_applications_role_slug ON dbo.applications(role_slug);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_applications_status' AND object_id = OBJECT_ID(N'dbo.applications')
    )
      CREATE INDEX idx_applications_status ON dbo.applications(status);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_onboarding_application_id' AND object_id = OBJECT_ID(N'dbo.onboarding_requests')
    )
      CREATE INDEX idx_onboarding_application_id ON dbo.onboarding_requests(application_id);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_onboarding_status' AND object_id = OBJECT_ID(N'dbo.onboarding_requests')
    )
      CREATE INDEX idx_onboarding_status ON dbo.onboarding_requests(status);

    IF COL_LENGTH(N'dbo.applications', N'task_reviewed_by') IS NULL
      ALTER TABLE dbo.applications ADD task_reviewed_by NVARCHAR(120) NOT NULL
        CONSTRAINT DF_applications_task_reviewed_by DEFAULT (N'');

    IF COL_LENGTH(N'dbo.applications', N'task_reviewed_by_user_id') IS NULL
      ALTER TABLE dbo.applications ADD task_reviewed_by_user_id NVARCHAR(80) NOT NULL
        CONSTRAINT DF_applications_task_reviewed_by_user_id DEFAULT (N'');

    IF COL_LENGTH(N'dbo.applications', N'task_score') IS NULL
      ALTER TABLE dbo.applications ADD task_score DECIMAL(4,1) NULL;

    IF COL_LENGTH(N'dbo.applications', N'first_contacted_at') IS NULL
      ALTER TABLE dbo.applications ADD first_contacted_at NVARCHAR(40) NULL;

    IF OBJECT_ID(N'dbo.stage_events', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.stage_events (
        id INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        application_id NVARCHAR(64) NOT NULL,
        from_stage NVARCHAR(64) NULL,
        to_stage NVARCHAR(64) NOT NULL,
        occurred_at NVARCHAR(40) NOT NULL,
        actor NVARCHAR(128) NOT NULL,
        CONSTRAINT FK_stage_events_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE CASCADE
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_stage_events_application_id' AND object_id = OBJECT_ID(N'dbo.stage_events')
    )
      CREATE INDEX idx_stage_events_application_id ON dbo.stage_events(application_id);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_stage_events_to_stage' AND object_id = OBJECT_ID(N'dbo.stage_events')
    )
      CREATE INDEX idx_stage_events_to_stage ON dbo.stage_events(to_stage);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_interviewers_email' AND object_id = OBJECT_ID(N'dbo.interviewers')
    )
      CREATE UNIQUE INDEX UQ_interviewers_email ON dbo.interviewers(email);

    IF OBJECT_ID(N'dbo.interviewer_slots', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.interviewer_slots (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        user_id NVARCHAR(80) NOT NULL,
        starts_at DATETIME2 NOT NULL,
        ends_at DATETIME2 NOT NULL,
        from_recurring BIT NOT NULL CONSTRAINT DF_interviewer_slots_from_recurring DEFAULT (0),
        status NVARCHAR(16) NOT NULL CONSTRAINT DF_interviewer_slots_status DEFAULT (N'open'),
        application_id NVARCHAR(64) NULL,
        round_id NVARCHAR(80) NULL,
        created_at NVARCHAR(40) NOT NULL,
        updated_at NVARCHAR(40) NOT NULL,
        CONSTRAINT CK_interviewer_slots_status
          CHECK (status IN (N'open', N'booked', N'cancelled')),
        CONSTRAINT CK_interviewer_slots_range
          CHECK (ends_at > starts_at),
        CONSTRAINT FK_interviewer_slots_user
          FOREIGN KEY (user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE,
        CONSTRAINT FK_interviewer_slots_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE SET NULL
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_interviewer_slots_user_start'
        AND object_id = OBJECT_ID(N'dbo.interviewer_slots')
    )
      CREATE UNIQUE INDEX UQ_interviewer_slots_user_start
        ON dbo.interviewer_slots(user_id, starts_at);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_interviewer_slots_user_status_start'
        AND object_id = OBJECT_ID(N'dbo.interviewer_slots')
    )
      CREATE INDEX idx_interviewer_slots_user_status_start
        ON dbo.interviewer_slots(user_id, status, starts_at);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_interviewer_slots_application_id'
        AND object_id = OBJECT_ID(N'dbo.interviewer_slots')
    )
      CREATE INDEX idx_interviewer_slots_application_id
        ON dbo.interviewer_slots(application_id);

    IF OBJECT_ID(N'dbo.booking_invitations', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.booking_invitations (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        application_id NVARCHAR(64) NOT NULL,
        round_id NVARCHAR(80) NOT NULL,
        interviewer_user_id NVARCHAR(80) NOT NULL,
        token_hash NVARCHAR(64) NOT NULL,
        status NVARCHAR(16) NOT NULL CONSTRAINT DF_booking_invitations_status DEFAULT (N'sent'),
        reschedule_count INT NOT NULL CONSTRAINT DF_booking_invitations_reschedule DEFAULT (0),
        created_at NVARCHAR(40) NOT NULL,
        expires_at NVARCHAR(40) NOT NULL,
        booked_at NVARCHAR(40) NULL,
        cancelled_at NVARCHAR(40) NULL,
        reminder_sent_at NVARCHAR(40) NULL,
        CONSTRAINT CK_booking_invitations_status
          CHECK (status IN (N'sent', N'booked', N'expired', N'cancelled')),
        CONSTRAINT FK_booking_invitations_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE CASCADE,
        CONSTRAINT FK_booking_invitations_interviewer
          FOREIGN KEY (interviewer_user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE
      );
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_booking_invitations_token_hash'
        AND object_id = OBJECT_ID(N'dbo.booking_invitations')
    )
      CREATE UNIQUE INDEX UQ_booking_invitations_token_hash
        ON dbo.booking_invitations(token_hash);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_booking_invitations_open_round'
        AND object_id = OBJECT_ID(N'dbo.booking_invitations')
    )
      CREATE UNIQUE INDEX UQ_booking_invitations_open_round
        ON dbo.booking_invitations(application_id, round_id)
        WHERE status = N'sent';

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_booking_invitations_application_id'
        AND object_id = OBJECT_ID(N'dbo.booking_invitations')
    )
      CREATE INDEX idx_booking_invitations_application_id
        ON dbo.booking_invitations(application_id);

    /* Inbox only. event_type is validated in JS (NOTIFICATION_EVENT_TYPES), not CHECK. */
    IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.notifications (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        recipient_user_id NVARCHAR(80) NOT NULL,
        application_id NVARCHAR(64) NULL,
        round_id NVARCHAR(80) NULL,
        event_type NVARCHAR(40) NOT NULL,
        dedupe_key NVARCHAR(160) NOT NULL,
        title NVARCHAR(160) NOT NULL,
        body NVARCHAR(400) NOT NULL,
        href NVARCHAR(300) NOT NULL,
        read_at NVARCHAR(40) NULL,
        created_at NVARCHAR(40) NOT NULL,
        expires_at NVARCHAR(40) NOT NULL,
        CONSTRAINT FK_notifications_recipient
          FOREIGN KEY (recipient_user_id) REFERENCES dbo.admin_users(id) ON DELETE CASCADE,
        CONSTRAINT FK_notifications_application
          FOREIGN KEY (application_id) REFERENCES dbo.applications(id) ON DELETE CASCADE
      );
    END;

    /* Unread only — a read row must not block a later insert of the same key. */
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_notifications_recipient_dedupe'
        AND object_id = OBJECT_ID(N'dbo.notifications')
        AND has_filter = 0
    )
      DROP INDEX UQ_notifications_recipient_dedupe ON dbo.notifications;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'UQ_notifications_recipient_dedupe'
        AND object_id = OBJECT_ID(N'dbo.notifications')
    )
      CREATE UNIQUE INDEX UQ_notifications_recipient_dedupe
        ON dbo.notifications(recipient_user_id, dedupe_key)
        WHERE read_at IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_notifications_recipient_unread'
        AND object_id = OBJECT_ID(N'dbo.notifications')
    )
      CREATE INDEX idx_notifications_recipient_unread
        ON dbo.notifications(recipient_user_id, created_at DESC)
        WHERE read_at IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_notifications_expires_at'
        AND object_id = OBJECT_ID(N'dbo.notifications')
    )
      CREATE INDEX idx_notifications_expires_at
        ON dbo.notifications(expires_at);

    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'idx_notifications_application_id'
        AND object_id = OBJECT_ID(N'dbo.notifications')
    )
      CREATE INDEX idx_notifications_application_id
        ON dbo.notifications(application_id);
  `);

  await backfillTaskReviewColumns(database);
  await seedInterviewersFromAdminUsers(database);
}

function normalizeTaskScoreColumn(value) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 10) / 10;
}

function taskReviewFieldsFromPipeline(pipeline) {
  const task = pipeline && typeof pipeline === 'object' && pipeline.task && typeof pipeline.task === 'object'
    ? pipeline.task
    : {};
  return {
    reviewedBy: String(task.reviewedBy || '').slice(0, 120),
    reviewedByUserId: String(task.reviewedByUserId || '').slice(0, 80),
    score: normalizeTaskScoreColumn(task.score),
  };
}

function applyTaskReviewColumnsToPipeline(pipeline, row) {
  const base = pipeline && typeof pipeline === 'object' ? pipeline : {};
  const task = base.task && typeof base.task === 'object' ? { ...base.task } : {};
  // Dedicated columns are the only stored source of truth for review metadata.
  task.reviewedBy = row.task_reviewed_by != null ? String(row.task_reviewed_by) : '';
  task.reviewedByUserId = row.task_reviewed_by_user_id != null ? String(row.task_reviewed_by_user_id) : '';
  task.score = row.task_score == null || row.task_score === '' ? null : Number(row.task_score);
  base.task = task;
  return base;
}

function stripTaskReviewFromPipeline(pipeline) {
  if (!pipeline || typeof pipeline !== 'object') return pipeline;
  const copy = { ...pipeline };
  if (copy.task && typeof copy.task === 'object') {
    copy.task = { ...copy.task };
    delete copy.task.reviewedBy;
    delete copy.task.reviewedByUserId;
    delete copy.task.score;
  }
  return copy;
}

async function backfillTaskReviewColumns(database = getHiringDb()) {
  const result = await database.request().query(`
    SELECT id, pipeline, task_reviewed_by, task_reviewed_by_user_id, task_score
    FROM dbo.applications
    WHERE pipeline IS NOT NULL
  `);
  for (const row of result.recordset || []) {
    const pipeline = parseJsonColumn(row.pipeline, 'pipeline', row.id);
    if (!pipeline || typeof pipeline !== 'object') continue;
    const task = pipeline.task && typeof pipeline.task === 'object' ? pipeline.task : null;
    const nextReviewedBy = String((task && task.reviewedBy) || '').slice(0, 120);
    const nextReviewedByUserId = String((task && task.reviewedByUserId) || '').slice(0, 80);
    const nextScore = normalizeTaskScoreColumn(task && task.score);
    const hadJsonReview = Boolean(
      task && (Object.prototype.hasOwnProperty.call(task, 'reviewedBy')
        || Object.prototype.hasOwnProperty.call(task, 'reviewedByUserId')
        || Object.prototype.hasOwnProperty.call(task, 'score'))
    );
    const needsColumnWrite =
      (!row.task_reviewed_by && nextReviewedBy) ||
      (!row.task_reviewed_by_user_id && nextReviewedByUserId) ||
      (row.task_score == null && nextScore != null);
    if (!needsColumnWrite && !hadJsonReview) continue;

    const reviewedBy = row.task_reviewed_by || nextReviewedBy;
    const reviewedByUserId = row.task_reviewed_by_user_id || nextReviewedByUserId;
    const score = row.task_score != null ? Number(row.task_score) : nextScore;
    const scrubbed = serializePipeline(pipeline);
    const req = database.request();
    req.input('id', sql.NVarChar(64), row.id);
    req.input('task_reviewed_by', sql.NVarChar(120), reviewedBy);
    req.input('task_reviewed_by_user_id', sql.NVarChar(80), reviewedByUserId);
    req.input('task_score', sql.Decimal(4, 1), score);
    req.input('pipeline', sql.NVarChar(sql.MAX), scrubbed);
    await req.query(`
      UPDATE dbo.applications
      SET task_reviewed_by = @task_reviewed_by,
          task_reviewed_by_user_id = @task_reviewed_by_user_id,
          task_score = @task_score,
          pipeline = @pipeline
      WHERE id = @id
    `);
  }
}

function parseJsonColumn(raw, label, id) {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object') return parsed;
    console.warn(`[hiring-db] ${label} for ${id} parsed to non-object; treating as missing`);
    return undefined;
  } catch (error) {
    console.warn(`[hiring-db] malformed ${label} JSON for ${id}: ${error.message}`);
    return undefined;
  }
}

function serializePipeline(pipeline) {
  if (pipeline == null) return null;
  return JSON.stringify(stripTaskReviewFromPipeline(pipeline));
}

function serializeAssets(assets) {
  if (assets == null || typeof assets !== 'object') return '{}';
  return JSON.stringify(assets);
}

function rowToApplication(row) {
  const application = {
    id: row.id,
    reference: row.reference,
    role: row.role,
    roleSlug: row.role_slug || '',
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    currentSalary: row.current_salary || '',
    yearsOfExperience: row.years_experience || '',
    expectedSalary: row.expected_salary || '',
    noticePeriodWeeks: Number(row.notice_period_weeks) || 0,
    linkedin: row.linkedin || '',
    resumeName: row.resume_name || '',
    resumeFile: row.resume_file || '',
    status: row.status || 'new',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    firstContactedAt: row.first_contacted_at || null,
  };
  if (row.resume_pending) application.resumePending = true;
  const pipeline = parseJsonColumn(row.pipeline, 'pipeline', row.id);
  if (pipeline !== undefined) {
    application.pipeline = applyTaskReviewColumnsToPipeline(pipeline, row);
  } else if (row.task_reviewed_by || row.task_reviewed_by_user_id || row.task_score != null) {
    application.pipeline = applyTaskReviewColumnsToPipeline({}, row);
  }
  return application;
}

function rowToOnboarding(row) {
  const assets = parseJsonColumn(row.assets, 'assets', row.id);
  return {
    id: row.id,
    applicationId: row.application_id,
    reference: row.reference || '',
    fullName: row.full_name || '',
    jobTitle: row.job_title || '',
    email: row.email || '',
    mobile: row.mobile || '',
    linkedin: row.linkedin || '',
    idNumber: row.id_number || '',
    status: row.status || 'draft',
    assets: assets && !Array.isArray(assets) ? assets : {},
    notesHr: row.notes_hr || '',
    notesMarketing: row.notes_marketing || '',
    createdBy: row.created_by || '',
    sentAt: row.sent_at || null,
    returnedAt: row.returned_at || null,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readApplicationsStore() {
  const result = await getHiringDb().request().query(`
    SELECT * FROM dbo.applications
    ORDER BY submitted_at DESC, id DESC
  `);
  const applications = (result.recordset || []).map(rowToApplication);
  let updatedAt = null;
  for (const app of applications) {
    if (app.updatedAt && (!updatedAt || app.updatedAt > updatedAt)) updatedAt = app.updatedAt;
  }
  return { version: 1, updatedAt, applications };
}

async function writeApplicationsStore(data, options = {}) {
  const database = getHiringDb();
  const stamp = new Date().toISOString();
  data.updatedAt = stamp;
  const list = Array.isArray(data.applications) ? data.applications : [];
  const stageEvents = Array.isArray(options.stageEvents) ? options.stageEvents : [];
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    for (const app of list) {
      if (!app || !app.id) continue;
      const hasPending = Object.prototype.hasOwnProperty.call(app, 'resumePending');
      const resumePending = hasPending ? (app.resumePending ? 1 : 0) : null;
      const taskReview = taskReviewFieldsFromPipeline(app.pipeline);
      const req = new sql.Request(transaction);
      req.input('id', sql.NVarChar(64), app.id);
      req.input('reference', sql.NVarChar(64), app.reference || '');
      req.input('role', sql.NVarChar(256), app.role || '');
      req.input('role_slug', sql.NVarChar(256), app.roleSlug || '');
      req.input('full_name', sql.NVarChar(256), app.fullName || '');
      req.input('phone', sql.NVarChar(64), app.phone || '');
      req.input('email', sql.NVarChar(320), app.email || '');
      req.input('current_salary', sql.NVarChar(64), app.currentSalary || '');
      req.input('years_experience', sql.NVarChar(64), app.yearsOfExperience || '');
      req.input('expected_salary', sql.NVarChar(64), app.expectedSalary || '');
      req.input('notice_period_weeks', sql.Int, Number(app.noticePeriodWeeks) || 0);
      req.input('linkedin', sql.NVarChar(2048), app.linkedin || '');
      req.input('resume_name', sql.NVarChar(512), app.resumeName || '');
      req.input('resume_file', sql.NVarChar(512), app.resumeFile || '');
      req.input('resume_pending', sql.Int, resumePending);
      req.input('has_resume_pending', sql.Int, hasPending ? 1 : 0);
      req.input('status', sql.NVarChar(32), app.status || 'new');
      req.input('pipeline', sql.NVarChar(sql.MAX), serializePipeline(app.pipeline));
      req.input('task_reviewed_by', sql.NVarChar(120), taskReview.reviewedBy);
      req.input('task_reviewed_by_user_id', sql.NVarChar(80), taskReview.reviewedByUserId);
      req.input('task_score', sql.Decimal(4, 1), taskReview.score);
      req.input('first_contacted_at', sql.NVarChar(40), app.firstContactedAt || null);
      req.input('submitted_at', sql.NVarChar(40), app.submittedAt || stamp);
      req.input('updated_at', sql.NVarChar(40), app.updatedAt || stamp);
      await req.query(`
        MERGE dbo.applications AS target
        USING (SELECT @id AS id) AS source
        ON target.id = source.id
        WHEN MATCHED THEN UPDATE SET
          reference = @reference,
          role = @role,
          role_slug = @role_slug,
          full_name = @full_name,
          phone = @phone,
          email = @email,
          current_salary = @current_salary,
          years_experience = @years_experience,
          expected_salary = @expected_salary,
          notice_period_weeks = @notice_period_weeks,
          linkedin = @linkedin,
          resume_name = @resume_name,
          resume_file = @resume_file,
          resume_pending = CASE WHEN @has_resume_pending = 1 THEN @resume_pending ELSE target.resume_pending END,
          status = @status,
          pipeline = @pipeline,
          task_reviewed_by = @task_reviewed_by,
          task_reviewed_by_user_id = @task_reviewed_by_user_id,
          task_score = @task_score,
          first_contacted_at = COALESCE(target.first_contacted_at, @first_contacted_at),
          submitted_at = @submitted_at,
          updated_at = @updated_at
        WHEN NOT MATCHED THEN INSERT (
          id, reference, role, role_slug, full_name, phone, email,
          current_salary, years_experience, expected_salary, notice_period_weeks,
          linkedin, resume_name, resume_file, resume_pending, status, pipeline,
          task_reviewed_by, task_reviewed_by_user_id, task_score, first_contacted_at,
          submitted_at, updated_at
        ) VALUES (
          @id, @reference, @role, @role_slug, @full_name, @phone, @email,
          @current_salary, @years_experience, @expected_salary, @notice_period_weeks,
          @linkedin, @resume_name, @resume_file, COALESCE(@resume_pending, 0), @status, @pipeline,
          @task_reviewed_by, @task_reviewed_by_user_id, @task_score, @first_contacted_at,
          @submitted_at, @updated_at
        );
      `);
    }

    for (const event of stageEvents) {
      if (!event || !event.applicationId || !event.toStage) continue;
      const eventReq = new sql.Request(transaction);
      eventReq.input('application_id', sql.NVarChar(64), String(event.applicationId));
      eventReq.input('from_stage', sql.NVarChar(64), event.fromStage == null || event.fromStage === '' ? null : String(event.fromStage));
      eventReq.input('to_stage', sql.NVarChar(64), String(event.toStage));
      eventReq.input('occurred_at', sql.NVarChar(40), event.occurredAt || stamp);
      eventReq.input('actor', sql.NVarChar(128), String(event.actor || 'hr').slice(0, 128));
      await eventReq.query(`
        INSERT INTO dbo.stage_events (application_id, from_stage, to_stage, occurred_at, actor)
        VALUES (@application_id, @from_stage, @to_stage, @occurred_at, @actor)
      `);
    }

    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
  return data;
}

async function readOnboardingStore() {
  const result = await getHiringDb().request().query(`
    SELECT * FROM dbo.onboarding_requests
    ORDER BY created_at DESC, id DESC
  `);
  const requests = (result.recordset || []).map(rowToOnboarding);
  let updatedAt = null;
  for (const req of requests) {
    if (req.updatedAt && (!updatedAt || req.updatedAt > updatedAt)) updatedAt = req.updatedAt;
  }
  return { version: 1, updatedAt, requests };
}

async function writeOnboardingStore(data) {
  const database = getHiringDb();
  const stamp = new Date().toISOString();
  data.updatedAt = stamp;
  const list = Array.isArray(data.requests) ? data.requests : [];
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    for (const entry of list) {
      if (!entry || !entry.id) continue;
      const req = new sql.Request(transaction);
      req.input('id', sql.NVarChar(64), entry.id);
      req.input('application_id', sql.NVarChar(64), entry.applicationId);
      req.input('reference', sql.NVarChar(64), entry.reference || '');
      req.input('full_name', sql.NVarChar(256), entry.fullName || '');
      req.input('job_title', sql.NVarChar(256), entry.jobTitle || '');
      req.input('email', sql.NVarChar(320), entry.email || '');
      req.input('mobile', sql.NVarChar(64), entry.mobile || '');
      req.input('linkedin', sql.NVarChar(2048), entry.linkedin || '');
      req.input('id_number', sql.NVarChar(64), entry.idNumber || '');
      req.input('status', sql.NVarChar(32), entry.status || 'draft');
      req.input('assets', sql.NVarChar(sql.MAX), serializeAssets(entry.assets));
      req.input('notes_hr', sql.NVarChar(sql.MAX), entry.notesHr || '');
      req.input('notes_marketing', sql.NVarChar(sql.MAX), entry.notesMarketing || '');
      req.input('created_by', sql.NVarChar(128), entry.createdBy || '');
      req.input('sent_at', sql.NVarChar(40), entry.sentAt || null);
      req.input('returned_at', sql.NVarChar(40), entry.returnedAt || null);
      req.input('completed_at', sql.NVarChar(40), entry.completedAt || null);
      req.input('created_at', sql.NVarChar(40), entry.createdAt || stamp);
      req.input('updated_at', sql.NVarChar(40), entry.updatedAt || stamp);
      await req.query(`
        MERGE dbo.onboarding_requests AS target
        USING (SELECT @id AS id) AS source
        ON target.id = source.id
        WHEN MATCHED THEN UPDATE SET
          application_id = @application_id,
          reference = @reference,
          full_name = @full_name,
          job_title = @job_title,
          email = @email,
          mobile = @mobile,
          linkedin = @linkedin,
          id_number = @id_number,
          status = @status,
          assets = @assets,
          notes_hr = @notes_hr,
          notes_marketing = @notes_marketing,
          created_by = @created_by,
          sent_at = @sent_at,
          returned_at = @returned_at,
          completed_at = @completed_at,
          created_at = @created_at,
          updated_at = @updated_at
        WHEN NOT MATCHED THEN INSERT (
          id, application_id, reference, full_name, job_title, email, mobile, linkedin, id_number,
          status, assets, notes_hr, notes_marketing, created_by,
          sent_at, returned_at, completed_at, created_at, updated_at
        ) VALUES (
          @id, @application_id, @reference, @full_name, @job_title, @email, @mobile, @linkedin, @id_number,
          @status, @assets, @notes_hr, @notes_marketing, @created_by,
          @sent_at, @returned_at, @completed_at, @created_at, @updated_at
        );
      `);
    }
    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
  return data;
}

/** Re-read each app by id and set only reminderSentOn on the matching interview round. */
async function applyReminderSentOn(updates) {
  const database = getHiringDb();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    for (const item of updates || []) {
      if (!item || !item.applicationId || !item.interviewId) continue;
      const selectReq = new sql.Request(transaction);
      selectReq.input('id', sql.NVarChar(64), item.applicationId);
      const selected = await selectReq.query('SELECT id, pipeline FROM dbo.applications WHERE id = @id');
      const row = selected.recordset && selected.recordset[0];
      if (!row) continue;
      const pipeline = parseJsonColumn(row.pipeline, 'pipeline', row.id);
      if (!pipeline || !Array.isArray(pipeline.interviews)) continue;
      const round = pipeline.interviews.find(
        (entry) => entry && String(entry.id || '') === String(item.interviewId),
      );
      if (!round) continue;
      round.reminderSentOn = item.reminderSentOn;
      const updateReq = new sql.Request(transaction);
      updateReq.input('pipeline', sql.NVarChar(sql.MAX), serializePipeline(pipeline));
      updateReq.input('id', sql.NVarChar(64), row.id);
      await updateReq.query('UPDATE dbo.applications SET pipeline = @pipeline WHERE id = @id');
    }
    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
}

/**
 * Hard-delete an application. Onboarding and application_resumes cascade in the same
 * DELETE. deletion_log is written in the same transaction. Returns { id } if removed,
 * or null if absent — callers should not expose which.
 */
async function hardDeleteApplication(applicationId, deletedBy) {
  const database = getHiringDb();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    const selectReq = new sql.Request(transaction);
    selectReq.input('id', sql.NVarChar(64), applicationId);
    const selected = await selectReq.query('SELECT id FROM dbo.applications WHERE id = @id');
    const row = selected.recordset && selected.recordset[0];
    if (!row) {
      await transaction.commit();
      return null;
    }
    const releaseReq = new sql.Request(transaction);
    releaseReq.input('application_id', sql.NVarChar(64), applicationId);
    releaseReq.input('updated_at', sql.NVarChar(40), new Date().toISOString());
    await releaseReq.query(`
      IF OBJECT_ID(N'dbo.interviewer_slots', N'U') IS NOT NULL
      BEGIN
        UPDATE dbo.interviewer_slots
        SET status = N'open',
            application_id = NULL,
            round_id = NULL,
            updated_at = @updated_at
        WHERE application_id = @application_id
          AND status = N'booked';
      END
    `);
    const removeReq = new sql.Request(transaction);
    removeReq.input('id', sql.NVarChar(64), applicationId);
    await removeReq.query('DELETE FROM dbo.applications WHERE id = @id');
    const logReq = new sql.Request(transaction);
    logReq.input('entity_type', sql.NVarChar(64), 'application');
    logReq.input('entity_id', sql.NVarChar(64), applicationId);
    logReq.input('deleted_at', sql.NVarChar(40), new Date().toISOString());
    logReq.input('deleted_by', sql.NVarChar(128), String(deletedBy || 'hr'));
    await logReq.query(`
      INSERT INTO dbo.deletion_log (entity_type, entity_id, deleted_at, deleted_by)
      VALUES (@entity_type, @entity_id, @deleted_at, @deleted_by)
    `);
    await transaction.commit();
    return { id: row.id };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
}

const INTERVIEWER_STAGE_LABELS = ['HR', 'Technical', 'CEO', 'CTO', 'Marketing', 'Sales', 'AI & Data'];
const INTERVIEWER_STAGE_LABEL_SET = new Set(INTERVIEWER_STAGE_LABELS);

/** Empty array means the person covers every stage. Invalid labels are dropped. */
function normalizeStoredInterviewStages(value) {
  let parsed = value;
  if (parsed == null || parsed === '') return [];
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (_) { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  const unique = [];
  for (const entry of parsed) {
    const label = String(entry || '').trim();
    if (INTERVIEWER_STAGE_LABEL_SET.has(label) && !unique.includes(label)) unique.push(label);
  }
  return unique;
}

function serializeInterviewStagesColumn(stages) {
  const list = normalizeStoredInterviewStages(Array.isArray(stages) ? stages : []);
  return list.length ? JSON.stringify(list) : null;
}

function rowToAdminUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name || '',
    email: row.email || '',
    jobTitle: row.job_title || '',
    photo: row.photo || '',
    role: row.role,
    interviewStages: normalizeStoredInterviewStages(row.interview_stages),
    active: row.active === true || row.active === 1,
    passwordHash: row.password_hash == null || row.password_hash === '' ? null : row.password_hash,
    mustSetPassword: row.must_set_password === true || row.must_set_password === 1,
    inviteTokenHash: row.invite_token_hash == null || row.invite_token_hash === '' ? null : row.invite_token_hash,
    inviteExpiresAt: row.invite_expires_at == null || row.invite_expires_at === '' ? null : row.invite_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at == null || row.last_login_at === '' ? null : row.last_login_at,
  };
}

async function readAdminUsersStore() {
  const result = await getHiringDb().request().query(`
    SELECT * FROM dbo.admin_users
    ORDER BY created_at ASC, id ASC
  `);
  const users = (result.recordset || []).map(rowToAdminUser);
  let updatedAt = null;
  for (const user of users) {
    if (user.updatedAt && (!updatedAt || user.updatedAt > updatedAt)) updatedAt = user.updatedAt;
  }
  return { version: 1, updatedAt, users };
}

/** Upsert-only MERGE — does not delete rows absent from data.users (same policy as writeApplicationsStore). */
async function writeAdminUsersStore(data) {
  const database = getHiringDb();
  const stamp = new Date().toISOString();
  data.updatedAt = stamp;
  const list = Array.isArray(data.users) ? data.users : [];
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    for (const user of list) {
      if (!user || !user.id) continue;
      const req = new sql.Request(transaction);
      req.input('id', sql.NVarChar(80), user.id);
      req.input('username', sql.NVarChar(40), user.username || '');
      req.input('name', sql.NVarChar(100), user.name || '');
      req.input('email', sql.NVarChar(160), user.email || '');
      req.input('job_title', sql.NVarChar(120), user.jobTitle || '');
      req.input('photo', sql.NVarChar(300), user.photo || '');
      req.input('role', sql.NVarChar(32), user.role || '');
      req.input('active', sql.Bit, user.active !== false);
      req.input('password_hash', sql.NVarChar(200), user.passwordHash == null ? null : String(user.passwordHash));
      req.input('must_set_password', sql.Bit, Boolean(user.mustSetPassword));
      req.input('invite_token_hash', sql.NVarChar(64), user.inviteTokenHash == null ? null : String(user.inviteTokenHash));
      req.input('invite_expires_at', sql.NVarChar(40), user.inviteExpiresAt == null ? null : String(user.inviteExpiresAt));
      req.input('created_at', sql.NVarChar(40), user.createdAt || stamp);
      req.input('updated_at', sql.NVarChar(40), user.updatedAt || stamp);
      req.input('last_login_at', sql.NVarChar(40), user.lastLoginAt == null ? null : String(user.lastLoginAt));
      req.input('interview_stages', sql.NVarChar(sql.MAX), serializeInterviewStagesColumn(user.interviewStages));
      await req.query(`
        MERGE dbo.admin_users AS target
        USING (SELECT @id AS id) AS source
        ON target.id = source.id
        WHEN MATCHED THEN UPDATE SET
          username = @username,
          name = @name,
          email = @email,
          job_title = @job_title,
          photo = @photo,
          role = @role,
          active = @active,
          password_hash = @password_hash,
          must_set_password = @must_set_password,
          invite_token_hash = @invite_token_hash,
          invite_expires_at = @invite_expires_at,
          created_at = @created_at,
          updated_at = @updated_at,
          last_login_at = @last_login_at,
          interview_stages = @interview_stages
        WHEN NOT MATCHED THEN INSERT (
          id, username, name, email, job_title, photo, role, active,
          password_hash, must_set_password, invite_token_hash, invite_expires_at,
          created_at, updated_at, last_login_at, interview_stages
        ) VALUES (
          @id, @username, @name, @email, @job_title, @photo, @role, @active,
          @password_hash, @must_set_password, @invite_token_hash, @invite_expires_at,
          @created_at, @updated_at, @last_login_at, @interview_stages
        );
      `);
    }
    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
  return data;
}

async function hardDeleteAdminUser(userId) {
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), userId);
  const result = await req.query('DELETE FROM dbo.admin_users WHERE id = @id');
  return (result.rowsAffected && result.rowsAffected[0]) || 0;
}

/** Stages-only write. Does not touch name, email, role, active, or any other column. */
async function updateAdminUserInterviewStages(userId, stages) {
  const key = String(userId || '').trim();
  if (!key) return 0;
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), key);
  req.input('interview_stages', sql.NVarChar(sql.MAX), serializeInterviewStagesColumn(stages));
  req.input('updated_at', sql.NVarChar(40), new Date().toISOString());
  const result = await req.query(`
    UPDATE dbo.admin_users
    SET interview_stages = @interview_stages, updated_at = @updated_at
    WHERE id = @id AND role IN (N'hr', N'interviewer')
  `);
  return (result.rowsAffected && result.rowsAffected[0]) || 0;
}

/**
 * Insert a new application row and its CV bytes in one transaction.
 * resume: { buffer: Buffer, fileName: string, contentType: string }
 */
async function insertApplicationWithResume(application, resume) {
  if (!application || !application.id) {
    throw new Error('insertApplicationWithResume requires application.id');
  }
  if (!resume || !Buffer.isBuffer(resume.buffer) || !resume.buffer.length) {
    throw new Error('insertApplicationWithResume requires a non-empty resume buffer');
  }
  const database = getHiringDb();
  const stamp = new Date().toISOString();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  try {
    const appReq = new sql.Request(transaction);
    const taskReview = taskReviewFieldsFromPipeline(application.pipeline);
    appReq.input('id', sql.NVarChar(64), application.id);
    appReq.input('reference', sql.NVarChar(64), application.reference || '');
    appReq.input('role', sql.NVarChar(256), application.role || '');
    appReq.input('role_slug', sql.NVarChar(256), application.roleSlug || '');
    appReq.input('full_name', sql.NVarChar(256), application.fullName || '');
    appReq.input('phone', sql.NVarChar(64), application.phone || '');
    appReq.input('email', sql.NVarChar(320), application.email || '');
    appReq.input('current_salary', sql.NVarChar(64), application.currentSalary || '');
    appReq.input('years_experience', sql.NVarChar(64), application.yearsOfExperience || '');
    appReq.input('expected_salary', sql.NVarChar(64), application.expectedSalary || '');
    appReq.input('notice_period_weeks', sql.Int, Number(application.noticePeriodWeeks) || 0);
    appReq.input('linkedin', sql.NVarChar(2048), application.linkedin || '');
    appReq.input('resume_name', sql.NVarChar(512), application.resumeName || resume.fileName || '');
    appReq.input('resume_file', sql.NVarChar(512), '');
    appReq.input('resume_pending', sql.Int, 0);
    appReq.input('status', sql.NVarChar(32), application.status || 'new');
    appReq.input('pipeline', sql.NVarChar(sql.MAX), serializePipeline(application.pipeline));
    appReq.input('task_reviewed_by', sql.NVarChar(120), taskReview.reviewedBy);
    appReq.input('task_reviewed_by_user_id', sql.NVarChar(80), taskReview.reviewedByUserId);
    appReq.input('task_score', sql.Decimal(4, 1), taskReview.score);
    appReq.input('first_contacted_at', sql.NVarChar(40), application.firstContactedAt || null);
    appReq.input('submitted_at', sql.NVarChar(40), application.submittedAt || stamp);
    appReq.input('updated_at', sql.NVarChar(40), application.updatedAt || stamp);
    await appReq.query(`
      INSERT INTO dbo.applications (
        id, reference, role, role_slug, full_name, phone, email,
        current_salary, years_experience, expected_salary, notice_period_weeks,
        linkedin, resume_name, resume_file, resume_pending, status, pipeline,
        task_reviewed_by, task_reviewed_by_user_id, task_score, first_contacted_at,
        submitted_at, updated_at
      ) VALUES (
        @id, @reference, @role, @role_slug, @full_name, @phone, @email,
        @current_salary, @years_experience, @expected_salary, @notice_period_weeks,
        @linkedin, @resume_name, @resume_file, @resume_pending, @status, @pipeline,
        @task_reviewed_by, @task_reviewed_by_user_id, @task_score, @first_contacted_at,
        @submitted_at, @updated_at
      )
    `);

    const resumeReq = new sql.Request(transaction);
    resumeReq.input('application_id', sql.NVarChar(64), application.id);
    resumeReq.input('file_name', sql.NVarChar(512), resume.fileName || application.resumeName || 'resume');
    resumeReq.input('content_type', sql.NVarChar(128), resume.contentType || 'application/octet-stream');
    resumeReq.input('byte_size', sql.BigInt, resume.buffer.length);
    resumeReq.input('content', sql.VarBinary(sql.MAX), resume.buffer);
    await resumeReq.query(`
      INSERT INTO dbo.application_resumes (application_id, file_name, content_type, byte_size, content)
      VALUES (@application_id, @file_name, @content_type, @byte_size, @content)
    `);

    await transaction.commit();
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
  return application;
}

/**
 * Load one CV from application_resumes.
 * Returns null if missing. content is a full Buffer — mssql/tedious does not stream
 * VARBINARY column bytes; max upload is 5 MiB so peak cost is one buffer of that size.
 */
async function getApplicationResume(applicationId) {
  const req = getHiringDb().request();
  req.input('application_id', sql.NVarChar(64), applicationId);
  const result = await req.query(`
    SELECT file_name AS fileName, content_type AS contentType, byte_size AS byteSize, content
    FROM dbo.application_resumes
    WHERE application_id = @application_id
  `);
  const row = result.recordset && result.recordset[0];
  if (!row || !row.content) return null;
  const content = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
  return {
    fileName: row.fileName || 'resume',
    contentType: row.contentType || 'application/octet-stream',
    byteSize: Number(row.byteSize) || content.length,
    content,
  };
}

function rowToInterviewer(row) {
  return {
    id: row.id,
    name: row.name || '',
    title: row.title || '',
    email: String(row.email || '').toLowerCase(),
    interviewStages: [],
    active: row.active !== false && row.active !== 0,
    source: 'manual',
    readOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHrAccountInterviewer(row) {
  return {
    id: row.id,
    name: row.name || row.username || '',
    title: row.job_title || '',
    email: String(row.email || '').toLowerCase(),
    interviewStages: normalizeStoredInterviewStages(row.interview_stages),
    active: row.active !== false && row.active !== 0,
    source: 'account',
    readOnly: true,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function listHrAccountInterviewersStore({ activeOnly = false } = {}) {
  const result = await getHiringDb().request().query(`
    SELECT id, name, username, email, job_title, interview_stages, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE role IN (N'hr', N'interviewer')
    ORDER BY name ASC, email ASC
  `);
  let list = (result.recordset || []).map(rowToHrAccountInterviewer);
  if (activeOnly) list = list.filter((entry) => entry.active);
  return list.filter((entry) => entry.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email));
}

async function getHrAccountInterviewerById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), key);
  const result = await req.query(`
    SELECT id, name, username, email, job_title, interview_stages, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE id = @id AND role IN (N'hr', N'interviewer')
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToHrAccountInterviewer(row) : null;
}

async function findHrAccountInterviewerByEmail(email) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) return null;
  const req = getHiringDb().request();
  req.input('email', sql.NVarChar(160), key);
  const result = await req.query(`
    SELECT id, name, username, email, job_title, interview_stages, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE role IN (N'hr', N'interviewer') AND LOWER(email) = @email
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToHrAccountInterviewer(row) : null;
}

function mergeInterviewerDirectories(accountRows, manualRows) {
  const merged = [];
  const seenIds = new Set();
  const seenEmails = new Set();
  for (const entry of accountRows || []) {
    if (!entry || !entry.id) continue;
    seenIds.add(String(entry.id));
    if (entry.email) seenEmails.add(String(entry.email).toLowerCase());
    merged.push(entry);
  }
  for (const entry of manualRows || []) {
    if (!entry || !entry.id) continue;
    const email = String(entry.email || '').toLowerCase();
    if (seenIds.has(String(entry.id)) || (email && seenEmails.has(email))) continue;
    seenIds.add(String(entry.id));
    if (email) seenEmails.add(email);
    merged.push(entry);
  }
  return merged.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))
    || String(a.email || '').localeCompare(String(b.email || '')));
}

async function listMergedInterviewersStore({ activeOnly = false } = {}) {
  const [accounts, manuals] = await Promise.all([
    listHrAccountInterviewersStore({ activeOnly }),
    listInterviewersStore({ activeOnly }),
  ]);
  return mergeInterviewerDirectories(accounts, manuals);
}

async function resolveStaffInterviewerById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const account = await getHrAccountInterviewerById(key);
  if (account) return account;
  return getInterviewerById(key);
}

async function assertManualInterviewerMutable(idOrEmail, { forCreate = false } = {}) {
  const key = String(idOrEmail || '').trim();
  if (!key) return;
  const byId = await getHrAccountInterviewerById(key);
  if (byId) {
    const error = new Error('This interviewer has an account and cannot be changed here. Manage them in User Management.');
    error.status = 403;
    error.code = 'ACCOUNT_READONLY';
    throw error;
  }
  if (forCreate || key.includes('@')) {
    const byEmail = await findHrAccountInterviewerByEmail(key);
    if (byEmail) {
      const error = new Error('An HR account already uses this email. That person appears automatically in Interviewers and cannot be added again.');
      error.status = 409;
      error.code = 'ACCOUNT_EXISTS';
      throw error;
    }
  }
}

async function listInterviewersStore({ activeOnly = false } = {}) {
  const result = await getHiringDb().request().query(`
    SELECT id, name, title, email, active, created_at, updated_at
    FROM dbo.interviewers
    ORDER BY name ASC, email ASC
  `);
  let list = (result.recordset || []).map(rowToInterviewer);
  if (activeOnly) list = list.filter((entry) => entry.active);
  return list;
}

async function getInterviewerById(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), key);
  const result = await req.query(`
    SELECT id, name, title, email, active, created_at, updated_at
    FROM dbo.interviewers
    WHERE id = @id
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToInterviewer(row) : null;
}

async function upsertInterviewerStore(input, existingId) {
  const stamp = new Date().toISOString();
  const id = String(existingId || input.id || `interviewer-${crypto.randomUUID()}`).slice(0, 80);
  const name = String(input.name || '').trim().slice(0, 120);
  const title = String(input.title || '').trim().slice(0, 120);
  const email = String(input.email || '').trim().toLowerCase().slice(0, 160);
  const active = input.active === false || input.active === 0 ? 0 : 1;
  if (!name) {
    const error = new Error('Interviewer name is required.');
    error.status = 422;
    throw error;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('A valid interviewer email is required.');
    error.status = 422;
    throw error;
  }
  if (existingId) await assertManualInterviewerMutable(existingId);
  else await assertManualInterviewerMutable(email, { forCreate: true });
  await assertManualInterviewerMutable(id);
  const existing = existingId ? await getInterviewerById(existingId) : null;
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), id);
  req.input('name', sql.NVarChar(120), name);
  req.input('title', sql.NVarChar(120), title);
  req.input('email', sql.NVarChar(160), email);
  req.input('active', sql.Bit, active);
  req.input('created_at', sql.NVarChar(40), (existing && existing.createdAt) || stamp);
  req.input('updated_at', sql.NVarChar(40), stamp);
  try {
    await req.query(`
      MERGE dbo.interviewers AS target
      USING (SELECT @id AS id) AS source
      ON target.id = source.id
      WHEN MATCHED THEN UPDATE SET
        name = @name,
        title = @title,
        email = @email,
        active = @active,
        updated_at = @updated_at
      WHEN NOT MATCHED THEN INSERT (id, name, title, email, active, created_at, updated_at)
      VALUES (@id, @name, @title, @email, @active, @created_at, @updated_at);
    `);
  } catch (error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
      const conflict = new Error('An interviewer with this email already exists.');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
  return getInterviewerById(id);
}

async function deleteInterviewerStore(id) {
  const key = String(id || '').trim();
  await assertManualInterviewerMutable(key);
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), key);
  const result = await req.query('DELETE FROM dbo.interviewers WHERE id = @id');
  return (result.rowsAffected && result.rowsAffected[0]) || 0;
}

async function seedInterviewersFromAdminUsers(database = getHiringDb()) {
  // HR accounts appear automatically from admin_users — do not copy them into dbo.interviewers.
  // Keep this hook as a no-op so older boots do not reintroduce account duplicates.
  void database;
}

const SLOT_DURATION_MS = 60 * 60 * 1000;
/* Generation horizon: recurring rows are created this far ahead. */
const RECURRING_HORIZON_DAYS = 56;
const RECURRING_SHORT_HORIZON_DAYS = 21;
/* Candidate picker: tomorrow through today+14 (Cairo). Not the generation horizon. */
const BOOKING_DISPLAY_DAYS = 14;
/* Candidate may change a booked time this many times. The initial book does not count. */
const MAX_BOOKING_RESCHEDULES = 3;
/* Unbooked invitation: first (and only) reminder this many Cairo days after send. */
const BOOKING_REMINDER_DAYS = 3;
const AVAILABILITY_TZ = process.env.MAIL_TZ || 'Africa/Cairo';

function availabilityTimeZone() {
  return AVAILABILITY_TZ;
}

function isoFromSqlDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return '';
}

function rowToSlot(row) {
  return {
    id: row.id,
    userId: row.user_id,
    startsAt: isoFromSqlDate(row.starts_at),
    endsAt: isoFromSqlDate(row.ends_at),
    fromRecurring: Boolean(row.from_recurring),
    status: row.status || 'open',
    applicationId: row.application_id || '',
    roundId: row.round_id || '',
    candidateName: row.full_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tzParts(date, timeZone = AVAILABILITY_TZ) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: map.weekday,
  };
}

function zonedLocalToUtc(dateStr, timeStr, timeZone = AVAILABILITY_TZ) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(timeStr || '').trim());
  if (!dateMatch || !timeMatch) {
    throw Object.assign(new Error('Enter a date and a start time.'), { status: 422, code: 'SLOT_TIME_INVALID' });
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) {
    throw Object.assign(new Error('Enter a valid start time.'), { status: 422, code: 'SLOT_TIME_INVALID' });
  }
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = tzParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    const delta = wanted - asUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

function seriesKeyFromStart(startsAt, timeZone = AVAILABILITY_TZ) {
  const parts = tzParts(startsAt instanceof Date ? startsAt : new Date(startsAt), timeZone);
  return `${parts.weekday}|${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function weeklyStartsFrom(firstStart, horizonDays = RECURRING_HORIZON_DAYS) {
  const starts = [];
  const horizon = firstStart.getTime() + horizonDays * 24 * 60 * 60 * 1000;
  let at = firstStart.getTime();
  while (at < horizon) {
    starts.push(new Date(at));
    at += 7 * 24 * 60 * 60 * 1000;
  }
  return starts;
}

async function listSlotsForUser(userId, { includeCancelled = false } = {}) {
  const req = getHiringDb().request();
  req.input('user_id', sql.NVarChar(80), String(userId || ''));
  const result = await req.query(`
    SELECT s.*, a.full_name
    FROM dbo.interviewer_slots AS s
    LEFT JOIN dbo.applications AS a ON a.id = s.application_id
    WHERE s.user_id = @user_id
      AND (${includeCancelled ? '1 = 1' : "s.status <> N'cancelled'"})
    ORDER BY s.starts_at ASC
  `);
  return (result.recordset || []).map(rowToSlot);
}

async function getSlotForUser(slotId, userId) {
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), String(slotId || ''));
  req.input('user_id', sql.NVarChar(80), String(userId || ''));
  const result = await req.query(`
    SELECT s.*, a.full_name
    FROM dbo.interviewer_slots AS s
    LEFT JOIN dbo.applications AS a ON a.id = s.application_id
    WHERE s.id = @id AND s.user_id = @user_id
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToSlot(row) : null;
}

async function findOverlappingSlots(userId, startsAt, endsAt, transaction) {
  const req = transaction ? new sql.Request(transaction) : getHiringDb().request();
  req.input('user_id', sql.NVarChar(80), String(userId || ''));
  req.input('starts_at', sql.DateTime2, startsAt);
  req.input('ends_at', sql.DateTime2, endsAt);
  const result = await req.query(`
    SELECT s.*, a.full_name
    FROM dbo.interviewer_slots AS s WITH (UPDLOCK, HOLDLOCK)
    LEFT JOIN dbo.applications AS a ON a.id = s.application_id
    WHERE s.user_id = @user_id
      AND s.status <> N'cancelled'
      AND s.starts_at < @ends_at
      AND s.ends_at > @starts_at
  `);
  return (result.recordset || []).map(rowToSlot);
}

/* Accounts that may own booking slots: dedicated interviewers and HR,
   who can also be assigned as the interviewer on a round. */
async function isActiveInterviewerAccount(userId) {
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), String(userId || ''));
  const result = await req.query(`
    SELECT id FROM dbo.admin_users
    WHERE id = @id AND active = 1 AND role IN (N'interviewer', N'hr')
  `);
  return Boolean(result.recordset && result.recordset[0]);
}

async function listActiveInterviewersWithRecurringSeries() {
  const result = await getHiringDb().request().query(`
    SELECT u.id
    FROM dbo.admin_users AS u
    WHERE u.active = 1
      AND u.role IN (N'interviewer', N'hr')
      AND EXISTS (
        SELECT 1
        FROM dbo.interviewer_slots AS s
        WHERE s.user_id = u.id
          AND s.from_recurring = 1
          AND s.status IN (N'open', N'booked')
      )
    ORDER BY u.id
  `);
  return (result.recordset || []).map((row) => row.id);
}

async function insertSlotRows(userId, starts, { fromRecurring = false, skipOverlap = false } = {}) {
  const database = getHiringDb();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  const stamp = new Date().toISOString();
  const created = [];
  try {
    for (const start of starts) {
      const startsAt = start instanceof Date ? start : new Date(start);
      const endsAt = new Date(startsAt.getTime() + SLOT_DURATION_MS);
      const overlap = await findOverlappingSlots(userId, startsAt, endsAt, transaction);
      if (overlap.length) {
        if (skipOverlap) continue;
        const error = new Error('That time overlaps an existing slot.');
        error.status = 409;
        error.code = 'SLOT_OVERLAP';
        error.overlap = overlap[0];
        throw error;
      }
      const id = `slot-${crypto.randomUUID()}`;
      const req = new sql.Request(transaction);
      req.input('id', sql.NVarChar(80), id);
      req.input('user_id', sql.NVarChar(80), String(userId));
      req.input('starts_at', sql.DateTime2, startsAt);
      req.input('ends_at', sql.DateTime2, endsAt);
      req.input('from_recurring', sql.Bit, Boolean(fromRecurring));
      req.input('created_at', sql.NVarChar(40), stamp);
      req.input('updated_at', sql.NVarChar(40), stamp);
      const inserted = await req.query(`
        INSERT INTO dbo.interviewer_slots (
          id, user_id, starts_at, ends_at, from_recurring, status,
          application_id, round_id, created_at, updated_at
        )
        SELECT
          @id, @user_id, @starts_at, @ends_at, @from_recurring, N'open',
          NULL, NULL, @created_at, @updated_at
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.interviewer_slots WITH (UPDLOCK, HOLDLOCK)
          WHERE user_id = @user_id AND starts_at = @starts_at
        )
      `);
      const affected = inserted.rowsAffected && inserted.rowsAffected[0] ? inserted.rowsAffected[0] : 0;
      if (!affected) {
        if (skipOverlap) continue;
        const error = new Error('That time overlaps an existing slot.');
        error.status = 409;
        error.code = 'SLOT_OVERLAP';
        throw error;
      }
      created.push({
        id,
        userId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        fromRecurring: Boolean(fromRecurring),
        status: 'open',
        applicationId: '',
        roundId: '',
        candidateName: '',
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    await transaction.commit();
    return created;
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
}

async function cancelOrDeleteSlotForUser(slotId, userId) {
  const slot = await getSlotForUser(slotId, userId);
  if (!slot) return { slot: null, action: null };
  if (slot.status === 'booked') {
    const error = new Error('This slot is booked and cannot be deleted.');
    error.status = 409;
    error.code = 'SLOT_BOOKED';
    error.slot = slot;
    throw error;
  }
  if (slot.status === 'cancelled') return { slot, action: 'already_cancelled' };
  /* Finite (one-off / bulk) and weekly rows both keep a cancelled tombstone so
     (user_id, starts_at) stays blocked. The daily extender only walks
     fromRecurring groups, so cancelled bulk hours are not resurrected. */
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), slot.id);
  req.input('user_id', sql.NVarChar(80), String(userId));
  req.input('updated_at', sql.NVarChar(40), new Date().toISOString());
  await req.query(`
    UPDATE dbo.interviewer_slots
    SET status = N'cancelled', updated_at = @updated_at
    WHERE id = @id AND user_id = @user_id AND status = N'open'
  `);
  return { slot: { ...slot, status: 'cancelled' }, action: 'cancelled' };
}

async function extendRecurringSeries(userId) {
  if (!(await isActiveInterviewerAccount(userId))) return [];
  const existing = await listSlotsForUser(userId, { includeCancelled: true });
  const recurring = existing.filter((slot) => slot.fromRecurring);
  const groups = new Map();
  for (const slot of recurring) {
    const key = seriesKeyFromStart(slot.startsAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slot);
  }
  const added = [];
  const horizon = Date.now() + RECURRING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  for (const slots of groups.values()) {
    const alive = slots.some((slot) => slot.status === 'open' || slot.status === 'booked');
    if (!alive) continue;
    let last = 0;
    const taken = new Set();
    for (const slot of slots) {
      const start = Date.parse(slot.startsAt);
      if (!Number.isNaN(start)) {
        if (start > last) last = start;
        taken.add(start);
      }
    }
    const toCreate = [];
    let next = last + 7 * 24 * 60 * 60 * 1000;
    while (next < horizon) {
      if (!taken.has(next)) toCreate.push(new Date(next));
      next += 7 * 24 * 60 * 60 * 1000;
    }
    if (!toCreate.length) continue;
    const created = await insertSlotRows(userId, toCreate, { fromRecurring: true, skipOverlap: true });
    added.push(...created);
  }
  return added;
}

function rowToBookingInvitation(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    roundId: row.round_id,
    interviewerUserId: row.interviewer_user_id,
    tokenHash: row.token_hash,
    status: row.status,
    rescheduleCount: Number(row.reschedule_count) || 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    bookedAt: row.booked_at || '',
    cancelledAt: row.cancelled_at || '',
    reminderSentAt: row.reminder_sent_at || '',
  };
}

async function cancelSentInvitationsForRound(applicationId, roundId) {
  const req = getHiringDb().request();
  req.input('application_id', sql.NVarChar(64), String(applicationId || ''));
  req.input('round_id', sql.NVarChar(80), String(roundId || ''));
  req.input('cancelled_at', sql.NVarChar(40), new Date().toISOString());
  await req.query(`
    UPDATE dbo.booking_invitations
    SET status = N'cancelled', cancelled_at = @cancelled_at
    WHERE application_id = @application_id
      AND round_id = @round_id
      AND status = N'sent'
  `);
}

async function insertBookingInvitation({
  applicationId,
  roundId,
  interviewerUserId,
  tokenHash,
  expiresAt,
}) {
  const stamp = new Date().toISOString();
  const id = `binv-${crypto.randomUUID()}`;
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), id);
  req.input('application_id', sql.NVarChar(64), String(applicationId));
  req.input('round_id', sql.NVarChar(80), String(roundId));
  req.input('interviewer_user_id', sql.NVarChar(80), String(interviewerUserId));
  req.input('token_hash', sql.NVarChar(64), String(tokenHash));
  req.input('created_at', sql.NVarChar(40), stamp);
  req.input('expires_at', sql.NVarChar(40), String(expiresAt));
  await req.query(`
    INSERT INTO dbo.booking_invitations (
      id, application_id, round_id, interviewer_user_id, token_hash, status,
      reschedule_count, created_at, expires_at, booked_at, cancelled_at, reminder_sent_at
    ) VALUES (
      @id, @application_id, @round_id, @interviewer_user_id, @token_hash, N'sent',
      0, @created_at, @expires_at, NULL, NULL, NULL
    )
  `);
  return {
    id,
    applicationId,
    roundId,
    interviewerUserId,
    status: 'sent',
    rescheduleCount: 0,
    createdAt: stamp,
    expiresAt,
  };
}

async function findBookingInvitationByTokenHash(tokenHash) {
  const req = getHiringDb().request();
  req.input('token_hash', sql.NVarChar(64), String(tokenHash || ''));
  const result = await req.query(`
    SELECT TOP (1) * FROM dbo.booking_invitations
    WHERE token_hash = @token_hash
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToBookingInvitation(row) : null;
}

async function listBookingInvitationsForApplication(applicationId) {
  const req = getHiringDb().request();
  req.input('application_id', sql.NVarChar(64), String(applicationId || ''));
  const result = await req.query(`
    SELECT * FROM dbo.booking_invitations
    WHERE application_id = @application_id
    ORDER BY created_at DESC
  `);
  return (result.recordset || []).map(rowToBookingInvitation);
}

function publicBookingInvitation(invitation) {
  if (!invitation) return null;
  return {
    id: invitation.id,
    applicationId: invitation.applicationId,
    roundId: invitation.roundId,
    status: invitation.status,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    reminderSentAt: invitation.reminderSentAt,
    bookedAt: invitation.bookedAt,
  };
}

/** Sent, booked, and expired invitations. No token hash. Newest first. */
async function listActiveBookingInvitations() {
  const result = await getHiringDb().request().query(`
    SELECT *
    FROM dbo.booking_invitations
    WHERE status IN (N'sent', N'booked', N'expired')
    ORDER BY created_at DESC
  `);
  return (result.recordset || []).map((row) => publicBookingInvitation(rowToBookingInvitation(row)));
}

async function expireSentBookingInvitations(now = new Date()) {
  const req = getHiringDb().request();
  req.input('now', sql.NVarChar(40), now.toISOString());
  const result = await req.query(`
    UPDATE dbo.booking_invitations
    SET status = N'expired'
    WHERE status = N'sent'
      AND expires_at < @now
  `);
  return (result.rowsAffected && result.rowsAffected[0]) || 0;
}

async function listSentInvitationsAwaitingReminder() {
  const result = await getHiringDb().request().query(`
    SELECT *
    FROM dbo.booking_invitations
    WHERE status = N'sent'
      AND reminder_sent_at IS NULL
  `);
  return (result.recordset || []).map(rowToBookingInvitation);
}

/** Durable once-guard: claim the reminder row before sending. Returns false if already claimed. */
async function claimBookingInvitationReminder(id, stamp) {
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), String(id || ''));
  req.input('reminder_sent_at', sql.NVarChar(40), String(stamp || new Date().toISOString()));
  const result = await req.query(`
    UPDATE dbo.booking_invitations
    SET reminder_sent_at = @reminder_sent_at
    WHERE id = @id
      AND status = N'sent'
      AND reminder_sent_at IS NULL
  `);
  return Boolean(result.rowsAffected && result.rowsAffected[0] === 1);
}

async function extendAllActiveRecurringSeries() {
  const userIds = await listActiveInterviewersWithRecurringSeries();
  const added = [];
  for (const userId of userIds) {
    added.push(...(await extendRecurringSeries(userId)));
  }
  return { users: userIds.length, added: added.length, slots: added };
}

function recurringHorizonFromSlots(slots, now = new Date()) {
  const living = (slots || []).filter((slot) => (
    slot.fromRecurring && (slot.status === 'open' || slot.status === 'booked')
  ));
  if (!living.length) {
    return { hasSeries: false, lastAt: '', daysLeft: null, short: false };
  }
  let last = 0;
  for (const slot of living) {
    const at = Date.parse(slot.startsAt);
    if (!Number.isNaN(at) && at > last) last = at;
  }
  const msLeft = last - now.getTime();
  const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  return {
    hasSeries: true,
    lastAt: new Date(last).toISOString(),
    daysLeft,
    short: last < now.getTime() + RECURRING_SHORT_HORIZON_DAYS * 24 * 60 * 60 * 1000,
  };
}

async function recurringHorizonForUser(userId, now = new Date()) {
  const slots = await listSlotsForUser(userId);
  return recurringHorizonFromSlots(slots, now);
}

async function listShortRecurringHorizons(now = new Date()) {
  const userIds = await listActiveInterviewersWithRecurringSeries();
  const short = [];
  for (const userId of userIds) {
    const horizon = await recurringHorizonForUser(userId, now);
    if (horizon.short) short.push({ userId, ...horizon });
  }
  return short;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function ymdFromParts(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function addCalendarDays(ymd, days) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + Number(days)));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

function weekdayIndexFromYmd(ymd) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  if (!year || !month || !day) return -1;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function hourlyStartTimes(startTime, endTime) {
  const start = /^(\d{2}):(\d{2})$/.exec(String(startTime || '').trim());
  const end = /^(\d{2}):(\d{2})$/.exec(String(endTime || '').trim());
  if (!start || !end) {
    throw Object.assign(new Error('Enter a start and end time.'), { status: 422, code: 'SLOT_TIME_INVALID' });
  }
  let from = Number(start[1]) * 60 + Number(start[2]);
  const to = Number(end[1]) * 60 + Number(end[2]);
  if (from >= to) {
    throw Object.assign(new Error('End time must be after the start time.'), { status: 422, code: 'SLOT_RANGE_INVALID' });
  }
  const times = [];
  while (from + 60 <= to) {
    times.push(`${pad2(Math.floor(from / 60))}:${pad2(from % 60)}`);
    from += 60;
  }
  if (!times.length) {
    throw Object.assign(new Error('The range must cover at least one hour.'), { status: 422, code: 'SLOT_RANGE_INVALID' });
  }
  return times;
}

function normalizeBulkDays(days) {
  const unique = [...new Set((Array.isArray(days) ? days : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))];
  unique.sort((a, b) => a - b);
  if (!unique.length) {
    throw Object.assign(new Error('Pick at least one day.'), { status: 422, code: 'SLOT_DAYS_INVALID' });
  }
  return unique;
}

/* Finite batch of one-hour starts. Cairo calendar dates, 56-day cap.
   Does not mark rows as recurring — the weekly checkbox stays the extender. */
function generateBulkAvailabilityStarts({ days, startTime, endTime, weeks, now = new Date() } = {}) {
  const selected = normalizeBulkDays(days);
  const times = hourlyStartTimes(startTime, endTime);
  const weekCount = Number(weeks);
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 8) {
    throw Object.assign(new Error('Weeks must be between 1 and 8.'), { status: 422, code: 'SLOT_WEEKS_INVALID' });
  }
  const todayYmd = ymdFromParts(tzParts(now));
  const endYmd = addCalendarDays(todayYmd, weekCount * 7);
  const horizon = now.getTime() + RECURRING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const starts = [];
  for (let ymd = todayYmd; ymd < endYmd; ymd = addCalendarDays(ymd, 1)) {
    if (!selected.includes(weekdayIndexFromYmd(ymd))) continue;
    for (const time of times) {
      const at = zonedLocalToUtc(ymd, time);
      if (at.getTime() <= now.getTime()) continue;
      if (at.getTime() >= horizon) continue;
      starts.push(at);
    }
  }
  return starts;
}

function bookingDisplayWindow(now = new Date()) {
  const todayYmd = ymdFromParts(tzParts(now));
  const fromYmd = addCalendarDays(todayYmd, 1);
  const toYmd = addCalendarDays(todayYmd, BOOKING_DISPLAY_DAYS);
  const fromUtc = zonedLocalToUtc(fromYmd, '00:00');
  const toUtcExclusive = zonedLocalToUtc(addCalendarDays(toYmd, 1), '00:00');
  return { todayYmd, fromYmd, toYmd, fromUtc, toUtcExclusive };
}

function slotIsInBookingWindow(startsAt, window = bookingDisplayWindow()) {
  const at = startsAt instanceof Date ? startsAt.getTime() : Date.parse(startsAt);
  if (Number.isNaN(at)) return false;
  return at >= window.fromUtc.getTime() && at < window.toUtcExclusive.getTime();
}

function cairoDateTimeLocal(startsAt) {
  const parts = tzParts(startsAt instanceof Date ? startsAt : new Date(startsAt));
  return `${ymdFromParts(parts)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Candidate picker lists only status=open rows in the display window — never a free-text time. */
async function listOpenSlotsInBookingWindow(userId) {
  const window = bookingDisplayWindow();
  const req = getHiringDb().request();
  req.input('user_id', sql.NVarChar(80), String(userId || ''));
  req.input('from_utc', sql.DateTime2, window.fromUtc);
  req.input('to_utc', sql.DateTime2, window.toUtcExclusive);
  const result = await req.query(`
    SELECT s.*
    FROM dbo.interviewer_slots AS s
    WHERE s.user_id = @user_id
      AND s.status = N'open'
      AND s.starts_at >= @from_utc
      AND s.starts_at < @to_utc
    ORDER BY s.starts_at ASC
  `);
  return {
    window: { fromYmd: window.fromYmd, toYmd: window.toYmd },
    slots: (result.recordset || []).map(rowToSlot),
  };
}

function bookingConflictError(message, code = 'SLOT_TAKEN', status = 409) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function bookingInvalidError() {
  return bookingConflictError('This booking link is invalid or has expired.', 'BOOKING_INVALID', 400);
}

const ROUND_NOT_PENDING_MESSAGE = 'This interview is no longer available to book. If you still need to meet, reply to the invitation email and our HR team will help.';

function bookingRoundNotPendingError() {
  return bookingConflictError(ROUND_NOT_PENDING_MESSAGE, 'ROUND_NOT_PENDING', 409);
}

function appendInterviewRescheduleHistory(pipeline, { by, stage, from, at }) {
  const history = Array.isArray(pipeline.history) ? pipeline.history.slice(0, 40) : [];
  const detail = `${stage} rescheduled from ${from}`.slice(0, 300);
  history.unshift({
    at,
    by,
    action: 'interview_reschedule',
    detail,
  });
  pipeline.history = history.slice(0, 40);
  return detail;
}

async function lockSlotRow(transaction, { id, userId }) {
  const req = new sql.Request(transaction);
  req.input('id', sql.NVarChar(80), String(id || ''));
  req.input('user_id', sql.NVarChar(80), String(userId || ''));
  const result = await req.query(`
    SELECT * FROM dbo.interviewer_slots WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
    WHERE id = @id AND user_id = @user_id
  `);
  const row = result.recordset && result.recordset[0];
  return row ? rowToSlot(row) : null;
}

/**
 * One transaction: lock invitation + slot(s) + application. First book marks
 * the slot booked and the invitation used. Reschedule releases the old slot
 * and books the new one, or rolls both back. Two concurrent callers racing
 * the same open slot: one UPDATE wins, the other sees 0 rows.
 */
async function bookOpenSlotForInvitation({ tokenHash, slotId }) {
  const window = bookingDisplayWindow();
  const database = getHiringDb();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  const stamp = new Date().toISOString();
  try {
    const inviteReq = new sql.Request(transaction);
    inviteReq.input('token_hash', sql.NVarChar(64), String(tokenHash || ''));
    const inviteResult = await inviteReq.query(`
      SELECT * FROM dbo.booking_invitations WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
      WHERE token_hash = @token_hash
    `);
    const inviteRow = inviteResult.recordset && inviteResult.recordset[0];
    if (!inviteRow) throw bookingInvalidError();
    const invitation = rowToBookingInvitation(inviteRow);
    const expiresAt = invitation.expiresAt ? Date.parse(invitation.expiresAt) : NaN;
    const expired = invitation.status === 'expired'
      || (!Number.isNaN(expiresAt) && expiresAt < Date.now());
    const isReschedule = invitation.status === 'booked';
    if (!isReschedule && (invitation.status !== 'sent' || expired)) throw bookingInvalidError();
    if (isReschedule && invitation.rescheduleCount >= MAX_BOOKING_RESCHEDULES) {
      throw bookingConflictError(
        "You've already rescheduled three times. Reply to the invitation email and our HR team will help you find a new time.",
        'RESCHEDULE_LIMIT',
        409,
      );
    }

    const appReq = new sql.Request(transaction);
    appReq.input('id', sql.NVarChar(64), invitation.applicationId);
    const appResult = await appReq.query(`
      SELECT id, full_name, pipeline FROM dbo.applications WITH (UPDLOCK, ROWLOCK, HOLDLOCK)
      WHERE id = @id
    `);
    const appRow = appResult.recordset && appResult.recordset[0];
    if (!appRow) throw bookingInvalidError();
    const pipeline = parseJsonColumn(appRow.pipeline, 'pipeline', appRow.id) || {};
    const interviews = Array.isArray(pipeline.interviews) ? pipeline.interviews : [];
    const round = interviews.find((entry) => String(entry && entry.id || '') === String(invitation.roundId));
    if (!round) throw bookingInvalidError();
    if (String(round.result || 'pending') !== 'pending') {
      throw bookingRoundNotPendingError();
    }
    if (!isReschedule && round.scheduledAt) {
      throw bookingConflictError('This interview is already scheduled.', 'ROUND_ALREADY_SCHEDULED');
    }

    const oldSlotReq = new sql.Request(transaction);
    oldSlotReq.input('application_id', sql.NVarChar(64), invitation.applicationId);
    oldSlotReq.input('round_id', sql.NVarChar(80), invitation.roundId);
    oldSlotReq.input('user_id', sql.NVarChar(80), invitation.interviewerUserId);
    const oldSlotResult = await oldSlotReq.query(`
      SELECT TOP (1) * FROM dbo.interviewer_slots
      WHERE application_id = @application_id
        AND round_id = @round_id
        AND user_id = @user_id
        AND status = N'booked'
      ORDER BY starts_at
    `);
    const oldSlot = oldSlotResult.recordset && oldSlotResult.recordset[0]
      ? rowToSlot(oldSlotResult.recordset[0])
      : null;

    if (isReschedule && oldSlot && oldSlot.id === String(slotId || '')) {
      await transaction.commit();
      return { alreadyBooked: true, rescheduled: false, invitation, scheduledAt: round.scheduledAt };
    }

    const lockIds = [String(slotId || '')];
    if (oldSlot && oldSlot.id !== String(slotId || '')) lockIds.push(oldSlot.id);
    lockIds.sort();
    const locked = new Map();
    for (const id of lockIds) {
      const slot = await lockSlotRow(transaction, { id, userId: invitation.interviewerUserId });
      if (slot) locked.set(slot.id, slot);
    }
    const nextSlot = locked.get(String(slotId || ''));
    /* First book and reschedule both require a genuine open slot in the window. */
    if (!nextSlot || nextSlot.status !== 'open' || !slotIsInBookingWindow(nextSlot.startsAt, window)) {
      throw bookingConflictError('That time was just taken. Please choose another.');
    }

    const oldScheduledAt = round.scheduledAt || '';
    round.scheduledAt = cairoDateTimeLocal(nextSlot.startsAt);
    let historyDetail = '';
    if (isReschedule) {
      historyDetail = appendInterviewRescheduleHistory(pipeline, {
        at: stamp,
        by: String(appRow.full_name || '').trim() || 'candidate',
        stage: round.label || 'Interview',
        from: oldScheduledAt,
      });
    }

    if (oldSlot && oldSlot.id !== nextSlot.id) {
      const releaseReq = new sql.Request(transaction);
      releaseReq.input('id', sql.NVarChar(80), oldSlot.id);
      releaseReq.input('user_id', sql.NVarChar(80), invitation.interviewerUserId);
      releaseReq.input('updated_at', sql.NVarChar(40), stamp);
      const released = await releaseReq.query(`
        UPDATE dbo.interviewer_slots
        SET status = N'open',
            application_id = NULL,
            round_id = NULL,
            updated_at = @updated_at
        WHERE id = @id AND user_id = @user_id AND status = N'booked'
      `);
      if (!released.rowsAffected || released.rowsAffected[0] !== 1) {
        throw bookingConflictError('That time was just taken. Please choose another.');
      }
    }

    const bookSlotReq = new sql.Request(transaction);
    bookSlotReq.input('id', sql.NVarChar(80), nextSlot.id);
    bookSlotReq.input('user_id', sql.NVarChar(80), invitation.interviewerUserId);
    bookSlotReq.input('application_id', sql.NVarChar(64), invitation.applicationId);
    bookSlotReq.input('round_id', sql.NVarChar(80), invitation.roundId);
    bookSlotReq.input('updated_at', sql.NVarChar(40), stamp);
    const bookedSlot = await bookSlotReq.query(`
      UPDATE dbo.interviewer_slots
      SET status = N'booked',
          application_id = @application_id,
          round_id = @round_id,
          updated_at = @updated_at
      WHERE id = @id AND user_id = @user_id AND status = N'open'
    `);
    if (!bookedSlot.rowsAffected || bookedSlot.rowsAffected[0] !== 1) {
      throw bookingConflictError('That time was just taken. Please choose another.');
    }

    const nextCount = isReschedule ? invitation.rescheduleCount + 1 : invitation.rescheduleCount;
    const bookInviteReq = new sql.Request(transaction);
    bookInviteReq.input('id', sql.NVarChar(80), invitation.id);
    bookInviteReq.input('booked_at', sql.NVarChar(40), stamp);
    bookInviteReq.input('reschedule_count', sql.Int, nextCount);
    const bookedInvite = await bookInviteReq.query(`
      UPDATE dbo.booking_invitations
      SET status = N'booked',
          booked_at = @booked_at,
          reschedule_count = @reschedule_count
      WHERE id = @id AND status IN (N'sent', N'booked')
    `);
    if (!bookedInvite.rowsAffected || bookedInvite.rowsAffected[0] !== 1) {
      throw bookingConflictError('That time was just taken. Please choose another.');
    }

    const pipeReq = new sql.Request(transaction);
    pipeReq.input('id', sql.NVarChar(64), appRow.id);
    pipeReq.input('pipeline', sql.NVarChar(sql.MAX), serializePipeline(pipeline));
    pipeReq.input('updated_at', sql.NVarChar(40), stamp);
    await pipeReq.query(`
      UPDATE dbo.applications
      SET pipeline = @pipeline, updated_at = @updated_at
      WHERE id = @id
    `);

    await transaction.commit();
    return {
      alreadyBooked: false,
      rescheduled: isReschedule,
      invitation: {
        ...invitation,
        status: 'booked',
        bookedAt: stamp,
        rescheduleCount: nextCount,
      },
      slot: {
        ...nextSlot,
        status: 'booked',
        applicationId: invitation.applicationId,
        roundId: invitation.roundId,
      },
      scheduledAt: round.scheduledAt,
      applicationId: appRow.id,
      roundId: invitation.roundId,
      historyDetail,
    };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
}

/**
 * HR changed or cleared scheduledAt. Reopen booked slots for those rounds.
 * Does not touch booking_invitations or reschedule_count.
 */
async function releaseBookedSlotsForRounds(applicationId, roundIds) {
  const ids = [...new Set((roundIds || []).map((id) => String(id || '')).filter(Boolean))];
  if (!ids.length) return { released: 0 };
  const database = getHiringDb();
  const transaction = new sql.Transaction(database);
  await transaction.begin();
  const stamp = new Date().toISOString();
  let released = 0;
  try {
    for (const roundId of ids) {
      const req = new sql.Request(transaction);
      req.input('application_id', sql.NVarChar(64), String(applicationId));
      req.input('round_id', sql.NVarChar(80), roundId);
      req.input('updated_at', sql.NVarChar(40), stamp);
      const result = await req.query(`
        UPDATE dbo.interviewer_slots
        SET status = N'open',
            application_id = NULL,
            round_id = NULL,
            updated_at = @updated_at
        WHERE application_id = @application_id
          AND round_id = @round_id
          AND status = N'booked'
      `);
      released += (result.rowsAffected && result.rowsAffected[0]) || 0;
    }
    await transaction.commit();
    return { released };
  } catch (error) {
    try { await transaction.rollback(); } catch (_) { /* ignore */ }
    throw error;
  }
}

/* Interviewer-personal notices that name a candidate they were assigned to.
   round_cancelled is intentionally absent — it must still name them. */
const ASSIGNMENT_NOTICE_TYPES = new Set([
  'interviewer_assigned',
  'task_needs_review',
  'interview_upcoming',
  'hr_round_scheduled',
  'hr_round_rescheduled',
  'feedback_due',
]);

const ASSIGNMENT_RETRACT_TYPES = new Set([
  ...ASSIGNMENT_NOTICE_TYPES,
  'booking_booked',
  'booking_rescheduled',
]);

function interviewerStillAssignedToNotice(notification, application, userId) {
  const type = String((notification && notification.eventType) || '');
  if (!ASSIGNMENT_NOTICE_TYPES.has(type)) return true;
  if (!application) return false;
  const pipe = application.pipeline && typeof application.pipeline === 'object'
    ? application.pipeline
    : {};
  const recipient = String(userId || '');
  if (type === 'task_needs_review') {
    const task = pipe.task && typeof pipe.task === 'object' ? pipe.task : {};
    return String(task.assignedToUserId || '') === recipient
      && (task.decision || 'pending') === 'pending';
  }
  const rounds = Array.isArray(pipe.interviews) ? pipe.interviews : [];
  const roundId = String((notification && notification.roundId) || '');
  if (roundId) {
    const round = rounds.find((entry) => String((entry && entry.id) || '') === roundId);
    if (!round) return false;
    if (round.result === 'cancelled') return false;
    return String(round.interviewerUserId || '') === recipient;
  }
  return rounds.some((entry) => (
    String((entry && entry.interviewerUserId) || '') === recipient
    && entry.result !== 'cancelled'
  ));
}

async function retractAssignmentNotifications({
  recipientUserId,
  applicationId,
  roundId,
  taskOnly = false,
} = {}) {
  try {
    const recipient = String(recipientUserId || '').trim();
    const application = String(applicationId || '').trim();
    const round = String(roundId || '').trim();
    if (!application) return { updated: 0 };
    const types = taskOnly ? ['task_needs_review'] : [...ASSIGNMENT_RETRACT_TYPES];
    const now = new Date().toISOString();
    const expiredAt = new Date(Date.now() - 1000).toISOString();
    const req = getHiringDb().request();
    req.input('application_id', sql.NVarChar(64), application);
    req.input('read_at', sql.NVarChar(40), now);
    req.input('expires_at', sql.NVarChar(40), expiredAt);
    const typeList = types.map((type, index) => {
      req.input(`t${index}`, sql.NVarChar(40), type);
      return `@t${index}`;
    }).join(', ');
    let sqlText = `
      UPDATE dbo.notifications
      SET read_at = COALESCE(read_at, @read_at), expires_at = @expires_at
      WHERE application_id = @application_id
        AND event_type IN (${typeList})
        AND expires_at >= @read_at
    `;
    if (recipient) {
      req.input('recipient_user_id', sql.NVarChar(80), recipient);
      sqlText += ' AND recipient_user_id = @recipient_user_id';
    }
    if (round) {
      req.input('round_id', sql.NVarChar(80), round);
      sqlText += ' AND round_id = @round_id';
    }
    const result = await req.query(sqlText);
    return { updated: (result.rowsAffected && result.rowsAffected[0]) || 0 };
  } catch (error) {
    console.error(`[notifications] retract failed: ${error && error.message}`);
    return { ok: false, updated: 0, reason: 'error' };
  }
}

function notificationExpiresAt(createdAtIso) {
  const created = new Date(createdAtIso);
  created.setUTCDate(created.getUTCDate() + NOTIFICATION_UNREAD_DAYS);
  return created.toISOString();
}

function notificationReadExpiresAt(readAtIso) {
  const readAt = new Date(readAtIso);
  readAt.setUTCDate(readAt.getUTCDate() + NOTIFICATION_READ_DAYS);
  return readAt.toISOString();
}

function rowToNotification(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    title: row.title,
    body: row.body,
    href: row.href,
    applicationId: row.application_id || '',
    roundId: row.round_id || '',
    readAt: row.read_at || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

async function listNotificationsForUser(userId) {
  const req = getHiringDb().request();
  req.input('recipient_user_id', sql.NVarChar(80), String(userId || ''));
  req.input('now', sql.NVarChar(40), new Date().toISOString());
  const result = await req.query(`
    SELECT TOP (100)
      id, event_type, title, body, href, application_id, round_id,
      read_at, created_at, expires_at
    FROM dbo.notifications
    WHERE recipient_user_id = @recipient_user_id
      AND expires_at >= @now
    ORDER BY created_at DESC
  `);
  const applications = (await readApplicationsStore()).applications || [];
  const byId = new Map(applications.map((item) => [item.id, item]));
  return (result.recordset || [])
    .map(rowToNotification)
    .filter((item) => interviewerStillAssignedToNotice(item, byId.get(item.applicationId), userId));
}

async function countUnreadNotificationsForUser(userId) {
  const notifications = await listNotificationsForUser(userId);
  return notifications.filter((item) => !item.readAt).length;
}

async function markNotificationRead(userId, id) {
  const readAt = new Date().toISOString();
  const expiresAt = notificationReadExpiresAt(readAt);
  const req = getHiringDb().request();
  req.input('id', sql.NVarChar(80), String(id || ''));
  req.input('recipient_user_id', sql.NVarChar(80), String(userId || ''));
  req.input('read_at', sql.NVarChar(40), readAt);
  req.input('expires_at', sql.NVarChar(40), expiresAt);
  const result = await req.query(`
    UPDATE dbo.notifications
    SET read_at = @read_at, expires_at = @expires_at
    WHERE id = @id
      AND recipient_user_id = @recipient_user_id
      AND read_at IS NULL
  `);
  if (result.rowsAffected && result.rowsAffected[0] === 1) {
    return { updated: true, readAt, expiresAt };
  }
  const exists = getHiringDb().request();
  exists.input('id', sql.NVarChar(80), String(id || ''));
  exists.input('recipient_user_id', sql.NVarChar(80), String(userId || ''));
  const found = await exists.query(`
    SELECT id FROM dbo.notifications
    WHERE id = @id AND recipient_user_id = @recipient_user_id
  `);
  if (found.recordset && found.recordset[0]) return { updated: false, alreadyRead: true };
  return null;
}

async function markAllNotificationsRead(userId) {
  const readAt = new Date().toISOString();
  const expiresAt = notificationReadExpiresAt(readAt);
  const req = getHiringDb().request();
  req.input('recipient_user_id', sql.NVarChar(80), String(userId || ''));
  req.input('read_at', sql.NVarChar(40), readAt);
  req.input('expires_at', sql.NVarChar(40), expiresAt);
  const result = await req.query(`
    UPDATE dbo.notifications
    SET read_at = @read_at, expires_at = @expires_at
    WHERE recipient_user_id = @recipient_user_id
      AND read_at IS NULL
  `);
  return {
    updated: (result.rowsAffected && result.rowsAffected[0]) || 0,
    readAt,
    expiresAt,
  };
}

function notificationDedupeKey(eventType, payload) {
  if (payload && payload.dedupeKey) return String(payload.dedupeKey).slice(0, 160);
  const applicationId = payload && payload.applicationId ? String(payload.applicationId) : '-';
  const roundId = payload && payload.roundId ? String(payload.roundId) : '-';
  return `${eventType}:${applicationId}:${roundId}`.slice(0, 160);
}

/**
 * Inbox insert. One recipient per call — fan-out is the caller looping.
 * Uses the pool, never a caller transaction. Swallows every error so the
 * triggering action cannot fail because of the inbox.
 */
async function writeNotification(recipientUserId, eventType, payload) {
  try {
    const recipient = String(recipientUserId || '').trim();
    const type = String(eventType || '').trim();
    const data = payload && typeof payload === 'object' ? payload : {};
    if (!recipient) {
      console.warn('[notifications] skip: missing recipient');
      return { ok: false, skipped: true, reason: 'recipient' };
    }
    if (!NOTIFICATION_EVENT_TYPES.has(type)) {
      console.warn(`[notifications] skip: unknown event_type ${type}`);
      return { ok: false, skipped: true, reason: 'event_type' };
    }
    const title = String(data.title || '').trim().slice(0, 160);
    const body = String(data.body || '').trim().slice(0, 400);
    const href = String(data.href || '').trim().slice(0, 300);
    if (!title || !body || !href) {
      console.warn(`[notifications] skip: incomplete payload for ${type}`);
      return { ok: false, skipped: true, reason: 'payload' };
    }

    const activeReq = getHiringDb().request();
    activeReq.input('id', sql.NVarChar(80), recipient);
    const active = await activeReq.query(`
      SELECT id FROM dbo.admin_users WHERE id = @id AND active = 1
    `);
    if (!active.recordset || !active.recordset[0]) {
      return { ok: false, skipped: true, reason: 'inactive' };
    }

    const createdAt = new Date().toISOString();
    const expiresAt = notificationExpiresAt(createdAt);
    const dedupeKey = notificationDedupeKey(type, data);
    const id = `ntf-${crypto.randomUUID()}`;
    const applicationId = data.applicationId ? String(data.applicationId).slice(0, 64) : null;
    const roundId = data.roundId ? String(data.roundId).slice(0, 80) : null;

    const req = getHiringDb().request();
    req.input('id', sql.NVarChar(80), id);
    req.input('recipient_user_id', sql.NVarChar(80), recipient);
    req.input('application_id', sql.NVarChar(64), applicationId);
    req.input('round_id', sql.NVarChar(80), roundId);
    req.input('event_type', sql.NVarChar(40), type);
    req.input('dedupe_key', sql.NVarChar(160), dedupeKey);
    req.input('title', sql.NVarChar(160), title);
    req.input('body', sql.NVarChar(400), body);
    req.input('href', sql.NVarChar(300), href);
    req.input('created_at', sql.NVarChar(40), createdAt);
    req.input('expires_at', sql.NVarChar(40), expiresAt);
    await req.query(`
      INSERT INTO dbo.notifications (
        id, recipient_user_id, application_id, round_id, event_type, dedupe_key,
        title, body, href, read_at, created_at, expires_at
      ) VALUES (
        @id, @recipient_user_id, @application_id, @round_id, @event_type, @dedupe_key,
        @title, @body, @href, NULL, @created_at, @expires_at
      )
    `);
    return { ok: true, skipped: false, id, dedupeKey, createdAt, expiresAt };
  } catch (error) {
    const number = error && (error.number || (error.originalError && error.originalError.info && error.originalError.info.number));
    if (number === 2601 || number === 2627) {
      return { ok: true, skipped: true, reason: 'unread_dedupe' };
    }
    console.error(`[notifications] write failed: ${error && error.message}`);
    return { ok: false, skipped: true, reason: 'error' };
  }
}

/** Active accounts only. Deactivated rows are excluded here and again in writeNotification. */
async function listActiveUsersByRole(role) {
  const req = getHiringDb().request();
  req.input('role', sql.NVarChar(32), String(role || ''));
  const result = await req.query(`
    SELECT id, username, name, role
    FROM dbo.admin_users
    WHERE active = 1 AND role = @role
    ORDER BY id
  `);
  return result.recordset || [];
}

async function hasAliveRecurringSeries(userId, seriesKey) {
  const slots = await listSlotsForUser(userId);
  return slots.some((slot) => {
    if (!slot.fromRecurring) return false;
    if (slot.status !== 'open' && slot.status !== 'booked') return false;
    if (seriesKey && seriesKeyFromStart(slot.startsAt) !== seriesKey) return false;
    return true;
  });
}

module.exports = {
  sql,
  openHiringDb,
  getHiringDb,
  ensureHiringSchema,
  NOTIFICATION_EVENT_TYPES,
  ASSIGNMENT_NOTICE_TYPES,
  ASSIGNMENT_RETRACT_TYPES,
  writeNotification,
  retractAssignmentNotifications,
  listNotificationsForUser,
  countUnreadNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  listActiveUsersByRole,
  hasAliveRecurringSeries,
  seriesKeyFromStart,
  readApplicationsStore,
  writeApplicationsStore,
  readOnboardingStore,
  writeOnboardingStore,
  parseJsonColumn,
  serializePipeline,
  serializeAssets,
  rowToApplication,
  rowToOnboarding,
  rowToAdminUser,
  readAdminUsersStore,
  writeAdminUsersStore,
  hardDeleteAdminUser,
  updateAdminUserInterviewStages,
  normalizeStoredInterviewStages,
  insertApplicationWithResume,
  getApplicationResume,
  applyReminderSentOn,
  hardDeleteApplication,
  listInterviewersStore,
  listMergedInterviewersStore,
  getInterviewerById,
  resolveStaffInterviewerById,
  upsertInterviewerStore,
  deleteInterviewerStore,
  assertManualInterviewerMutable,
  SLOT_DURATION_MS,
  RECURRING_HORIZON_DAYS,
  RECURRING_SHORT_HORIZON_DAYS,
  recurringHorizonFromSlots,
  recurringHorizonForUser,
  listShortRecurringHorizons,
  BOOKING_DISPLAY_DAYS,
  BOOKING_REMINDER_DAYS,
  MAX_BOOKING_RESCHEDULES,
  ROUND_NOT_PENDING_MESSAGE,
  bookingDisplayWindow,
  addCalendarDays,
  listOpenSlotsInBookingWindow,
  bookOpenSlotForInvitation,
  releaseBookedSlotsForRounds,
  availabilityTimeZone,
  zonedLocalToUtc,
  tzParts,
  weeklyStartsFrom,
  generateBulkAvailabilityStarts,
  listSlotsForUser,
  getSlotForUser,
  insertSlotRows,
  cancelOrDeleteSlotForUser,
  extendRecurringSeries,
  extendAllActiveRecurringSeries,
  isActiveInterviewerAccount,
  cancelSentInvitationsForRound,
  insertBookingInvitation,
  findBookingInvitationByTokenHash,
  listBookingInvitationsForApplication,
  listActiveBookingInvitations,
  expireSentBookingInvitations,
  listSentInvitationsAwaitingReminder,
  claimBookingInvitationReminder,
};

