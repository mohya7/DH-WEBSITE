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

function rowToAdminUser(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name || '',
    email: row.email || '',
    jobTitle: row.job_title || '',
    photo: row.photo || '',
    role: row.role,
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
          last_login_at = @last_login_at
        WHEN NOT MATCHED THEN INSERT (
          id, username, name, email, job_title, photo, role, active,
          password_hash, must_set_password, invite_token_hash, invite_expires_at,
          created_at, updated_at, last_login_at
        ) VALUES (
          @id, @username, @name, @email, @job_title, @photo, @role, @active,
          @password_hash, @must_set_password, @invite_token_hash, @invite_expires_at,
          @created_at, @updated_at, @last_login_at
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
    active: row.active !== false && row.active !== 0,
    source: 'account',
    readOnly: true,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

async function listHrAccountInterviewersStore({ activeOnly = false } = {}) {
  const result = await getHiringDb().request().query(`
    SELECT id, name, username, email, job_title, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE role = N'hr'
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
    SELECT id, name, username, email, job_title, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE id = @id AND role = N'hr'
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
    SELECT id, name, username, email, job_title, active, created_at, updated_at
    FROM dbo.admin_users
    WHERE role = N'hr' AND LOWER(email) = @email
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
    const error = new Error('This interviewer comes from an HR account and cannot be edited here. Update their details in user settings.');
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

module.exports = {
  sql,
  openHiringDb,
  getHiringDb,
  ensureHiringSchema,
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
};

