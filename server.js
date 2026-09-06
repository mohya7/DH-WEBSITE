'use strict';

require('dotenv').config();

process.env.TZ = process.env.TZ || process.env.MAIL_TZ || 'Africa/Cairo';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const sharp = require('sharp');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '127.0.0.1';
const SITE_URL = 'https://digitalhub.com.eg';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('[fatal] ADMIN_PASSWORD is required. Set it in the environment before starting the server.');
  process.exit(1);
}
const DATA_FILE = path.join(ROOT, 'content', 'admin-content.json');
const PUBLIC_JSON_FILE = path.join(ROOT, 'content', 'site-content.json');
const PUBLIC_JS_FILE = path.join(ROOT, 'content', 'site-content.js');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const CONTACT_REQUESTS_FILE = path.join(ROOT, 'content', 'contact-requests.json');
const CONTENT_DIR = path.resolve(path.join(ROOT, 'content'));
/** Compare paths in a filesystem-aware way (case-insensitive on Windows). */
function pathKey(absPath) {
  const resolved = path.resolve(absPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
/** Default-deny under content/: only these resolved absolute paths may be served statically. */
const CONTENT_PUBLIC_ALLOW = new Set([
  pathKey(PUBLIC_JSON_FILE),
  pathKey(PUBLIC_JS_FILE),
]);
const CONTENT_DIR_KEY = pathKey(CONTENT_DIR);

/**
 * Default-deny for the whole document root. Only these top-level directories may
 * be reached over HTTP; everything else on disk — .env, .git, server.js, lib/,
 * node_modules/, scripts/, docs/, tmp/, .cursor/ — is unreachable regardless of
 * what lands there. content/ is listed here but is further restricted to
 * CONTENT_PUBLIC_ALLOW below.
 */
const PUBLIC_DIRS = new Set([
  'admin', 'assets', 'blogs', 'book', 'careers', 'cases', 'content',
  'css', 'js', 'news', 'partners', 'services',
]);

/** Files at the document root that may be served. Nothing else at root is. */
const PUBLIC_ROOT_FILES = new Set([
  'index.html', 'about-us.html', 'get-in-touch.html', 'robots.txt', 'llms.txt',
  'favicon.ico', 'sitemap.xml',
]);
const ONBOARDING_STATUSES = new Set(['draft', 'sent', 'returned', 'completed']);
const ONBOARDING_ASSET_KEYS = ['onboardingPost', 'joiningPost', 'businessCard', 'employeeId'];
const MAX_JSON_BYTES = 9 * 1024 * 1024;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_APPLICATION_BYTES = MAX_RESUME_BYTES + (512 * 1024);
const SESSION_TTL = 8 * 60 * 60 * 1000;

function sessionCookieSecure() {
  // COOKIE_SECURE is the only authority — never trust client X-Forwarded-Proto.
  return process.env.COOKIE_SECURE === 'true' || process.env.COOKIE_SECURE === '1';
}

function sessionCookieHeader(token, maxAgeSeconds, req) {
  const parts = [
    `dh_admin_session=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (sessionCookieSecure()) parts.push('Secure');
  return parts.join('; ');
}
const CONTACT_SITUATIONS = {
  gov: 'Government / public sector digital services',
  dx: 'Enterprise digital transformation',
  dex: 'Nexthink DEX (200+ endpoints)',
  other: 'Something else',
};
const COLLECTIONS = new Set(['services', 'partners', 'caseStudies', 'blogs', 'news', 'jobs', 'team']);
const PAGES = new Set(['home', 'blogs', 'cases', 'partners', 'careers', 'about', 'news']);
const VALIDATION_CONFIG_FILE = path.join(ROOT, 'content', 'validation-config.json');
const blogPages = require('./scripts/blog-pages');
const partnerLogos = require('./scripts/partner-logos');
const serviceSuiteImages = require('./scripts/service-suite-images');
const serviceMethodology = require('./scripts/service-methodology');
const aboutHistory = require('./scripts/about-history');
const siteSocial = require('./scripts/site-social');
const mail = require('./lib/mail');
const hiringDb = require('./lib/hiring-db');

const fields = {
  services: ['title', 'summary', 'href', 'icon', 'visual', 'suiteScenes', 'methodology', 'status', 'featured', 'order'],
  partners: ['name', 'summary', 'href', 'image', 'alt', 'variant', 'status', 'featured', 'order'],
  caseStudies: ['title', 'summary', 'href', 'image', 'alt', 'categories', 'metric', 'status', 'featured', 'order'],
  news: ['title', 'summary', 'details', 'image', 'alt', 'category', 'location', 'year', 'month', 'status', 'featured', 'order'],
  blogs: [
    'title', 'summary', 'seoTitle', 'metaDescription', 'href', 'image', 'alt', 'category', 'categoryLabel', 'readTime', 'accent', 'status', 'featured', 'order',
    'cluster', 'answerBlock', 'body', 'faq', 'dataCallouts', 'relatedPosts', 'comparisonTable',
    'datePublished', 'dateModified', 'tableOfContents',
  ],
  jobs: ['title', 'summary', 'aboutRole', 'keyResponsibilities', 'requiredSkills', 'niceToHave', 'roleOffers', 'interviewStages', 'href', 'department', 'location', 'type', 'status', 'featured', 'order'],
  team: ['name', 'role', 'image', 'alt', 'email', 'linkedin', 'status', 'featured', 'order'],
};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sessions = new Map();
const applicationAttempts = new Map();
const contactAttempts = new Map();
const loginAttempts = new Map();
const bookingLookupAttempts = new Map();
const bookingBookAttempts = new Map();
const BOOKING_LOOKUP_INVALID_BODY = Buffer.from(JSON.stringify({
  error: 'BOOKING_INVALID',
  message: 'This booking link is invalid or has expired.',
}));

function sendBookingLookupInvalid(res) {
  res.writeHead(400, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': BOOKING_LOOKUP_INVALID_BODY.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(BOOKING_LOOKUP_INVALID_BODY);
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

async function readUsers() {
  return hiringDb.readAdminUsersStore();
}

async function writeUsers(data) {
  return hiringDb.writeAdminUsersStore(data);
}

async function mutateUsers(mutator) {
  const users = await readUsers();
  const result = mutator(users);
  await writeUsers(users);
  return result === undefined ? users : result;
}

async function readApplications() {
  return hiringDb.readApplicationsStore();
}

async function writeApplications(data, options) {
  return hiringDb.writeApplicationsStore(data, options);
}

const DEFAULT_INTERVIEW_STAGES = ['HR', 'Technical', 'CEO', 'CTO', 'Marketing', 'Sales', 'AI & Data'];
const INTERVIEW_STAGE_SET = new Set(DEFAULT_INTERVIEW_STAGES);
const PHONE_SCREEN_OUTCOMES = new Set(['pending', 'accepted', 'rejected', 'shortlisted', 'requirements_not_met']);
const TASK_STATUSES = new Set(['sent', 'in_progress', 'done']);
const TASK_DECISIONS = new Set(['pending', 'approved', 'rejected']);
const INTERVIEW_RESULTS = new Set(['pending', 'pass', 'fail', 'no_show', 'cancelled']);

function normalizeInterviewResult(value) {
  const result = String(value || '').trim();
  if (result === 'not_attended') return 'cancelled';
  return INTERVIEW_RESULTS.has(result) ? result : 'pending';
}

function interviewResultDecided(result) {
  return result === 'pass' || result === 'fail' || result === 'no_show' || result === 'cancelled';
}

function interviewResultResolved(result) {
  return result === 'pass' || result === 'fail' || result === 'no_show';
}

function interviewResultCloses(result) {
  return result === 'fail' || result === 'no_show';
}
const INTERVIEW_FORMATS = new Set(['onsite', 'online']);
/**
 * A round whose scheduled time has passed but has no result is "awaiting
 * feedback" until this many days have gone by; after that the interviewer queue
 * shows it as stale so it stops reading like a fresh action.
 *
 * This is the only definition — change the number here and both the API and the
 * queue UI follow, since the value is echoed to the client as staleAfterDays.
 */
const INTERVIEW_FEEDBACK_STALE_DAYS = 14;
const OFFER_STATUSES = new Set(['none', 'sent', 'joined', 'declined']);
const PATHWAYS = new Set(['with_tasks', 'no_tasks']);

function normalizeInterviewStages(value, fallback = DEFAULT_INTERVIEW_STAGES) {
  const raw = Array.isArray(value) ? value : fallback;
  const stages = raw
    .map((entry) => text(entry, 40))
    .filter((entry) => INTERVIEW_STAGE_SET.has(entry));
  const unique = [...new Set(stages)];
  return unique.length ? unique : [...DEFAULT_INTERVIEW_STAGES];
}

/** Interviewer/HR coverage. Empty means every stage — do not substitute the default list. */
function normalizeInterviewerStageSet(value) {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.map((entry) => text(entry, 40)).filter((entry) => INTERVIEW_STAGE_SET.has(entry)))];
}

function interviewerPublicView(person) {
  return {
    id: person.id,
    name: person.name,
    title: person.title || '',
    email: person.email || '',
    interviewStages: normalizeInterviewerStageSet(person.interviewStages),
    active: person.active !== false,
    source: person.source || 'account',
    readOnly: Boolean(person.readOnly),
  };
}

function defaultPipeline() {
  return {
    stage: 'phone_screen',
    phoneScreen: 'pending',
    pathway: null,
    task: { title: '', notes: '', status: 'sent', decision: 'pending', assignedTo: '', assignedToUserId: '', reviewedBy: '', reviewedByUserId: '', score: null },
    interviews: [],
    offer: { status: 'none', declinedReason: '' },
    history: [],
  };
}

function normalizeHalfPointScore(value, label) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 10) {
    throw Object.assign(new Error(`${label} must be between 0 and 10.`), { status: 422 });
  }
  if (Math.round(num * 2) !== num * 2) {
    throw Object.assign(new Error(`${label} must use half-point steps (e.g. 7 or 7.5).`), { status: 422 });
  }
  return Math.round(num * 10) / 10;
}

function jobStagesForApplication(application) {
  try {
    const data = readData();
    const jobs = (data.collections && data.collections.jobs) || [];
    const slug = String(application.roleSlug || '');
    const title = String(application.role || '');
    const job = jobs.find((entry) => {
      const hrefSlug = path.basename(String(entry.href || ''), path.extname(String(entry.href || '')));
      return (slug && hrefSlug === slug) || (title && entry.title === title);
    });
    return normalizeInterviewStages(job && job.interviewStages);
  } catch (_) {
    return [...DEFAULT_INTERVIEW_STAGES];
  }
}

async function findStaffInterviewer(userId) {
  const id = text(userId, 80);
  if (!id) return null;
  try {
    const person = await hiringDb.resolveStaffInterviewerById(id);
    if (!person || !person.active) return null;
    const email = text(person.email, 160).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return {
      id: person.id,
      name: text(person.name, 120) || email,
      title: text(person.title, 120),
      email,
      interviewStages: normalizeInterviewerStageSet(person.interviewStages),
      source: person.source || 'manual',
      readOnly: Boolean(person.readOnly),
    };
  } catch (_) {
    return null;
  }
}

/** Contact lookup for already-scheduled rounds — ignores active so deactivated interviewers still get mail. */
async function resolveInterviewerContactById(userId) {
  const id = text(userId, 80);
  if (!id) return null;
  try {
    const person = await hiringDb.resolveStaffInterviewerById(id);
    if (!person) return null;
    const email = text(person.email, 160).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return {
      id: person.id,
      name: text(person.name, 120) || email,
      title: text(person.title, 120),
      email,
      active: Boolean(person.active),
      source: person.source || 'manual',
    };
  } catch (_) {
    return null;
  }
}

/**
 * Enrich a round for mail.
 * Resolution order for interviewer email:
 *   1) stored email on the round (preferred — snapshot from when it was scheduled)
 *   2) active staff via findStaffInterviewer
 *   3) any-status contact via resolveInterviewerContactById (inactive fallback)
 */
async function enrichInterviewRoundForMail(round) {
  const next = Object.assign({}, round || {});
  const storedEmail = String(next.interviewerEmail || '').trim();
  const userId = text(next.interviewerUserId, 80);
  if (!userId) {
    next.interviewerEmail = storedEmail;
    return next;
  }

  const activeStaff = await findStaffInterviewer(userId);
  if (activeStaff) {
    next.interviewer = activeStaff.name || next.interviewer;
    next.interviewerTitle = activeStaff.title || next.interviewerTitle || '';
  }

  if (storedEmail) {
    next.interviewerEmail = storedEmail;
    return next;
  }

  const contact = activeStaff || await resolveInterviewerContactById(userId);
  if (contact) {
    next.interviewerEmail = contact.email;
    if (!String(next.interviewer || '').trim()) next.interviewer = contact.name;
    if (!String(next.interviewerTitle || '').trim()) next.interviewerTitle = contact.title || '';
  } else {
    next.interviewerEmail = '';
  }
  return next;
}

function logInterviewerEmailUnresolved(applicationId, interviewId) {
  console.warn(
    `[mail] Interviewer email unresolved; skipping interviewer send (applicationId=${applicationId || ''}, interviewId=${interviewId || ''})`,
  );
}

async function listStaffInterviewers() {
  try {
    return (await hiringDb.listMergedInterviewersStore({ activeOnly: true }))
      .map((person) => ({
        id: person.id,
        name: text(person.name, 120) || person.email,
        title: text(person.title, 120),
        email: text(person.email, 160).toLowerCase(),
        interviewStages: normalizeInterviewerStageSet(person.interviewStages),
        source: person.source || 'manual',
        readOnly: Boolean(person.readOnly),
      }))
      .filter((person) => person.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (_) {
    return [];
  }
}

async function normalizeInterviewEntry(entry, index, fallbackLabel = '') {
  const label = text(entry && entry.label, 40) || text(fallbackLabel, 40) || `Stage ${index + 1}`;
  const result = normalizeInterviewResult(entry && entry.result);
  const score = normalizeHalfPointScore(entry && entry.score, 'Interview scores');
  const scheduledAt = text(entry && entry.scheduledAt, 40);
  const interviewerUserId = text(entry && entry.interviewerUserId, 80);
  const notes = text(entry && entry.notes, 2000);
  const format = INTERVIEW_FORMATS.has(entry && entry.format) ? entry.format : 'online';
  const meetingLinkRaw = text(entry && entry.meetingLink, 500);
  const meetingLink = format === 'online' ? meetingLinkRaw : '';
  const blank = !interviewerUserId
    && !scheduledAt
    && !notes
    && !meetingLink
    && score == null
    && result === 'pending';

  if (!blank) {
    if (!label) {
      throw Object.assign(new Error(`Choose an interview stage for round ${index + 1}.`), { status: 422 });
    }
    if (!INTERVIEW_FORMATS.has(format)) {
      throw Object.assign(new Error(`${label || `Round ${index + 1}`}: choose Online or Onsite.`), { status: 422 });
    }
    const staffRequired = await findStaffInterviewer(interviewerUserId);
    if (!staffRequired) {
      throw Object.assign(new Error(`Pick an interviewer before saving ${label || `round ${index + 1}`}.`), { status: 422 });
    }
    /* Candidate self-booking: interviewer assigned, no time yet. The date is
       filled when they pick a slot — not on this save. A missing join URL is
       not a save error: Needs a join link plus the follow-on email cover that,
       and blocking persist here stopped HR from rescheduling a booked round. */
    const awaitingCandidateBooking = Boolean(interviewerUserId) && !scheduledAt && result === 'pending';
    if (!awaitingCandidateBooking && !scheduledAt) {
      throw Object.assign(new Error(`Set the interview date and time for ${label || `round ${index + 1}`}.`), { status: 422 });
    }
    if (format === 'online' && meetingLink && !/^https?:\/\/\S+$/i.test(meetingLink)) {
      throw Object.assign(new Error(`Add a valid meeting link (http/https) for ${label || `round ${index + 1}`}.`), { status: 422 });
    }
  }

  if ((result === 'pass' || result === 'fail') && score == null) {
    throw Object.assign(new Error(`Add a score (0–10) before marking ${label || `round ${index + 1}`} as Pass or Fail.`), { status: 422 });
  }
  if (interviewResultResolved(result) && blank) {
    throw Object.assign(new Error(`Assign an interviewer and wait for a booked time before recording a result on ${label || `round ${index + 1}`}.`), { status: 422 });
  }

  const staff = interviewerUserId ? await findStaffInterviewer(interviewerUserId) : null;
  if (scheduledAt && !staff) {
    throw Object.assign(new Error(`Pick a staff interviewer with an email before scheduling ${label || `round ${index + 1}`}.`), { status: 422 });
  }
  const interviewer = staff
    ? staff.name
    : text(entry && entry.interviewer, 120);
  const interviewerTitle = staff
    ? text(staff.title, 120)
    : text(entry && entry.interviewerTitle, 120);
  const interviewerEmail = staff
    ? staff.email
    : text(entry && entry.interviewerEmail, 160).toLowerCase();
  const reminderSentOn = text(entry && entry.reminderSentOn, 12);
  const recordedByUserId = text(entry && entry.recordedByUserId, 80);
  const recorder = recordedByUserId ? await findStaffInterviewer(recordedByUserId) : null;

  return {
    id: text(entry && entry.id, 80) || `interview-${contentSlug(label, index + 1)}`,
    label,
    format,
    meetingLink,
    interviewer,
    interviewerTitle,
    interviewerUserId: staff ? staff.id : '',
    interviewerEmail: staff ? staff.email : interviewerEmail,
    scheduledAt,
    reminderSentOn: /^\d{4}-\d{2}-\d{2}$/.test(reminderSentOn) ? reminderSentOn : '',
    score,
    notes,
    result,
    /* Who actually entered the decision. Independent of interviewerUserId,
       which is who the round was assigned to. HR can record on anyone's
       round; the name is snapshotted so the log still reads if the account
       is later deactivated. */
    recordedByUserId: recorder ? recorder.id : recordedByUserId,
    recordedBy: recorder ? recorder.name : text(entry && entry.recordedBy, 120),
  };
}

function interviewFeedbackKey(entry) {
  return [
    (entry && entry.result) || 'pending',
    entry && entry.score == null ? '' : String(entry.score),
    (entry && entry.notes) || '',
  ].join('\n');
}

async function feedbackAuthorFromSession(session) {
  if (!session || !session.userId) return { id: '', name: '' };
  const person = await findStaffInterviewer(session.userId);
  if (person) return { id: person.id, name: person.name };
  return { id: session.userId, name: session.name || session.username || '' };
}

async function applyFeedbackAttribution(interviews, existingInterviews, session) {
  const prevById = new Map((existingInterviews || []).map((entry) => [String(entry && entry.id || ''), entry]));
  const author = await feedbackAuthorFromSession(session);
  return (interviews || []).map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    if (!interviewResultDecided(entry.result)) {
      return { ...entry, recordedBy: '', recordedByUserId: '' };
    }
    const prev = prevById.get(String(entry.id || ''));
    const changed = !prev || interviewFeedbackKey(prev) !== interviewFeedbackKey(entry);
    if (changed && author.id) {
      return { ...entry, recordedByUserId: author.id, recordedBy: author.name };
    }
    return {
      ...entry,
      recordedByUserId: (prev && prev.recordedByUserId) || entry.recordedByUserId || '',
      recordedBy: (prev && prev.recordedBy) || entry.recordedBy || '',
    };
  });
}

/**
 * Booking invitations fire only when an interviewer is newly assigned to a
 * round that still has no time. Notes, score, result, meeting-link, and
 * datetime edits do not qualify. Phone screen must already have passed.
 * If HR also set scheduledAt, the existing schedule email handles it.
 */
function detectBookingInvitationNeeds(previousInterviews, nextInterviews, pipeline) {
  if (!pipeline || pipeline.phoneScreen !== 'accepted') return [];
  if (!pipeline.pathway) return [];
  if (pipeline.stage === 'closed' || pipeline.stage === 'phone_screen') return [];
  const prevMap = new Map((previousInterviews || []).map((entry) => [String(entry && entry.id || ''), entry]));
  const needed = [];
  (nextInterviews || []).forEach((entry) => {
    if (!entry || !entry.interviewerUserId) return;
    if (entry.scheduledAt) return;
    if (entry.result && entry.result !== 'pending') return;
    const prev = prevMap.get(String(entry.id || ''));
    const previousInterviewer = prev && prev.interviewerUserId ? String(prev.interviewerUserId) : '';
    if (previousInterviewer === String(entry.interviewerUserId)) return;
    needed.push(entry);
  });
  return needed;
}

function emptyAvailabilityMessage(name) {
  const who = String(name || '').trim() || 'This interviewer';
  return `${who} has no open times in the next 14 days. The candidate will receive a booking link with nothing to pick.`;
}

async function emptyAvailabilityWarnings(rounds) {
  const seen = new Set();
  const warnings = [];
  for (const round of rounds || []) {
    const id = String((round && round.interviewerUserId) || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const listed = await hiringDb.listOpenSlotsInBookingWindow(id);
    if (listed.slots.length) continue;
    const staff = await findStaffInterviewer(id);
    const name = (staff && staff.name) || (round && round.interviewer) || 'This interviewer';
    warnings.push({
      interviewerUserId: id,
      interviewer: name,
      message: emptyAvailabilityMessage(name),
    });
  }
  return warnings;
}

function emptyAvailabilityResponse(warnings) {
  return {
    error: 'NO_OPEN_SLOTS',
    message: (warnings || []).map((entry) => entry.message).join(' '),
    slotWarnings: warnings || [],
  };
}

async function issueBookingInvitations(application, rounds, req) {
  const baseUrl = mail.publicBaseUrl(req && req.headers && req.headers.host);
  const results = [];
  for (const round of rounds) {
    const invite = createInvite();
    await hiringDb.cancelSentInvitationsForRound(application.id, round.id);
    await hiringDb.insertBookingInvitation({
      applicationId: application.id,
      roundId: round.id,
      interviewerUserId: round.interviewerUserId,
      tokenHash: invite.inviteTokenHash,
      expiresAt: invite.inviteExpiresAt,
    });
    const bookingUrl = `${baseUrl}/book/?k=${encodeURIComponent(invite.raw)}`;
    const mailed = await mail.sendBookingInvitationEmail({
      application,
      round,
      bookingUrl,
      expiresAt: invite.inviteExpiresAt,
      baseUrl,
    });
    results.push({
      roundId: round.id,
      sent: Boolean(mailed && mailed.sent),
      skipped: Boolean(mailed && mailed.skipped),
      failed: Boolean(mailed && !mailed.sent && !mailed.skipped),
    });
  }
  return results;
}

function detectInterviewScheduleChanges(previousInterviews, nextInterviews) {
  const prevMap = new Map((previousInterviews || []).map((entry) => [String(entry.id || ''), entry]));
  const changed = [];
  (nextInterviews || []).forEach((entry) => {
    if (!entry || !entry.scheduledAt) return;
    const prev = prevMap.get(String(entry.id || ''));
    const prevAt = prev && prev.scheduledAt ? String(prev.scheduledAt) : '';
    const nextAt = String(entry.scheduledAt || '');
    if (prevAt === nextAt) return;
    changed.push({
      round: entry,
      rescheduled: Boolean(prevAt),
    });
  });
  return changed;
}

/** Rounds whose time HR changed or cleared — booked interviewer slots must reopen. */
function detectBookedSlotReleases(previousInterviews, nextInterviews) {
  const nextMap = new Map((nextInterviews || []).map((entry) => [String(entry && entry.id || ''), entry]));
  const roundIds = [];
  (previousInterviews || []).forEach((entry) => {
    if (!entry || !entry.id) return;
    const prevAt = String(entry.scheduledAt || '');
    if (!prevAt) return;
    const next = nextMap.get(String(entry.id));
    const nextAt = next && next.scheduledAt ? String(next.scheduledAt) : '';
    if (prevAt !== nextAt) roundIds.push(String(entry.id));
  });
  return roundIds;
}

function validOnlineMeetingLink(round) {
  if (!round || round.format === 'onsite') return '';
  const link = String(round.meetingLink || '').trim();
  return /^https?:\/\/\S+$/i.test(link) ? link : '';
}

/** First valid join URL on a round that already had a time and previously had none. */
function detectMeetingLinkAdditions(previousInterviews, nextInterviews) {
  const prevMap = new Map((previousInterviews || []).map((entry) => [String(entry && entry.id || ''), entry]));
  const added = [];
  (nextInterviews || []).forEach((entry) => {
    if (!entry || !String(entry.scheduledAt || '').trim()) return;
    if (entry.format === 'onsite') return;
    const prev = prevMap.get(String(entry.id || ''));
    if (!prev || !String(prev.scheduledAt || '').trim()) return;
    if (validOnlineMeetingLink(prev)) return;
    if (!validOnlineMeetingLink(entry)) return;
    added.push(entry);
  });
  return added;
}

async function notifyInterviewSchedules(application, changes, req) {
  const baseUrl = mail.publicBaseUrl(req && req.headers && req.headers.host);
  const results = [];
  for (const change of changes) {
    let round = await enrichInterviewRoundForMail(change.round);
    const hasInterviewer = Boolean(String(round.interviewerEmail || '').trim());
    const hasCandidate = Boolean(String(application.email || '').trim());
    if (!hasInterviewer) {
      logInterviewerEmailUnresolved(application && application.id, round && round.id);
    }
    if (!hasInterviewer && !hasCandidate) {
      results.push({
        id: round.id,
        sent: false,
        skipped: true,
        reason: 'no_recipients',
        sides: [
          { side: 'interviewer', sent: false, skipped: true, reason: 'no_interviewer_email' },
          { side: 'candidate', sent: false, skipped: true, reason: 'no_candidate_email' },
        ],
      });
      continue;
    }
    const outcome = await mail.sendInterviewScheduleEmail({ application, round, baseUrl });
    results.push(Object.assign({ id: round.id, interviewer: round.interviewer }, outcome));
  }
  return results;
}

async function notifyMeetingLinkAdditions(application, rounds, req) {
  const baseUrl = mail.publicBaseUrl(req && req.headers && req.headers.host);
  const results = [];
  for (const entry of rounds || []) {
    let round = await enrichInterviewRoundForMail(entry);
    const hasInterviewer = Boolean(String(round.interviewerEmail || '').trim());
    const hasCandidate = Boolean(String(application.email || '').trim());
    if (!hasInterviewer) {
      logInterviewerEmailUnresolved(application && application.id, round && round.id);
    }
    if (!hasInterviewer && !hasCandidate) {
      results.push({
        id: round.id,
        sent: false,
        skipped: true,
        reason: 'no_recipients',
        sides: [
          { side: 'interviewer', sent: false, skipped: true, reason: 'no_interviewer_email' },
          { side: 'candidate', sent: false, skipped: true, reason: 'no_candidate_email' },
        ],
      });
      continue;
    }
    const outcome = await mail.sendInterviewMeetingLinkEmail({ application, round, baseUrl });
    results.push(Object.assign({ id: round.id, interviewer: round.interviewer }, outcome));
  }
  return results;
}

let reminderJobRunning = false;
/* In-memory once-per-Cairo-day slot for the 10:00 job. Interview day reminders
   and unbooked-invitation reminders both use this; the durable once-guard for
   invitations is booking_invitations.reminder_sent_at. */
let reminderLastSlot = '';
/* Once-a-day guard for recurring slot extension. Compared to Africa/Cairo
   calendar date (mail.zonedYmd), not the 10:00 reminder hour, so availability
   still grows when SES is off. In-memory — a process restart may run once more
   the same day; inserts are idempotent. */
let availabilityExtendLastDay = '';
let availabilityExtendRunning = false;
let bookingExpiryRunning = false;

function bookingReminderDue(invitation, todayYmd) {
  const createdAt = invitation && invitation.createdAt ? new Date(invitation.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  const createdYmd = mail.zonedYmd(createdAt);
  if (!createdYmd) return false;
  const dueYmd = hiringDb.addCalendarDays(createdYmd, hiringDb.BOOKING_REMINDER_DAYS);
  return String(todayYmd) >= String(dueYmd);
}

async function sendUnbookedInvitationReminders(data, todayYmd, baseUrl) {
  const pending = await hiringDb.listSentInvitationsAwaitingReminder();
  if (!pending.length) return;
  const stamp = new Date().toISOString();
  const apps = (data && data.applications) || [];
  for (const invitation of pending) {
    const expiresAt = invitation.expiresAt ? Date.parse(invitation.expiresAt) : NaN;
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) continue;
    if (!bookingReminderDue(invitation, todayYmd)) continue;
    const application = apps.find((entry) => entry.id === invitation.applicationId);
    if (!application) continue;
    const pipe = application.pipeline && typeof application.pipeline === 'object' ? application.pipeline : null;
    if (!pipe || pipe.stage === 'closed') continue;
    const round = Array.isArray(pipe.interviews)
      ? pipe.interviews.find((entry) => String(entry && entry.id || '') === String(invitation.roundId))
      : null;
    if (!round || String(round.scheduledAt || '').trim()) continue;
    const claimed = await hiringDb.claimBookingInvitationReminder(invitation.id, stamp);
    if (!claimed) continue;
    const enriched = await enrichInterviewRoundForMail(round);
    await mail.sendBookingReminderEmail({
      application,
      round: enriched,
      expiresAt: invitation.expiresAt,
      baseUrl,
    });
  }
}

async function runBookingInvitationExpiry() {
  if (bookingExpiryRunning) return;
  bookingExpiryRunning = true;
  try {
    const expired = await hiringDb.expireSentBookingInvitations();
    if (expired) console.log(`[booking] Expired ${expired} unused invitation(s).`);
  } catch (error) {
    console.error('[booking] Expiry sweep failed:', error.message || error);
  } finally {
    bookingExpiryRunning = false;
  }
}

function effectiveBookingInvitationStatus(invite, now = Date.now()) {
  if (!invite) return '';
  if (invite.status === 'booked' || invite.status === 'expired') return invite.status;
  if (invite.status === 'sent') {
    const expires = invite.expiresAt ? Date.parse(invite.expiresAt) : NaN;
    if (!Number.isNaN(expires) && expires < now) return 'expired';
    return 'sent';
  }
  return invite.status || '';
}

async function attachBookingInvitations(applications) {
  const list = Array.isArray(applications) ? applications : [];
  if (!list.length) {
    return list;
  }
  let invites = [];
  try {
    invites = await hiringDb.listActiveBookingInvitations();
  } catch (error) {
    console.error('[booking] Could not load invitations:', error.message || error);
    list.forEach((app) => { app.bookingInvitations = []; });
    return list;
  }
  const byApp = new Map();
  invites.forEach((invite) => {
    const view = Object.assign({}, invite, { status: effectiveBookingInvitationStatus(invite) });
    if (!byApp.has(view.applicationId)) byApp.set(view.applicationId, []);
    byApp.get(view.applicationId).push(view);
  });
  list.forEach((app) => {
    app.bookingInvitations = byApp.get(app.id) || [];
  });
  return list;
}

async function runInterviewDayReminders() {
  if (reminderJobRunning) return;
  if (!mail.mailEnabled() || !mail.smtpConfigured()) return;
  const now = new Date();
  const hm = mail.zonedHm(now);
  if (hm.hour !== 10 || hm.minute > 1) return;
  const today = mail.zonedYmd(now);
  const slot = `${today}T10`;
  if (reminderLastSlot === slot) return;
  reminderJobRunning = true;
  try {
    const data = await readApplications();
    const pendingReminders = [];
    const baseUrl = mail.publicBaseUrl();
    for (const application of data.applications || []) {
      const pipe = application.pipeline && typeof application.pipeline === 'object' ? application.pipeline : null;
      if (!pipe || !Array.isArray(pipe.interviews)) continue;
      for (const round of pipe.interviews) {
        if (!round || !round.scheduledAt) continue;
        if (round.result === 'fail') continue;
        if (round.reminderSentOn === today) continue;
        const when = new Date(round.scheduledAt);
        if (Number.isNaN(when.getTime())) continue;
        if (mail.zonedYmd(when) !== today) continue;
        if (when.getTime() < now.getTime()) continue;
        const enriched = await enrichInterviewRoundForMail(round);
        const interviewerEmail = String(enriched.interviewerEmail || '').trim();
        const candidateEmail = String(application.email || '').trim();
        if (!interviewerEmail) {
          logInterviewerEmailUnresolved(application && application.id, round && round.id);
        }
        if (!interviewerEmail && !candidateEmail) continue;
        const outcome = await mail.sendInterviewReminderEmail({
          application,
          round: Object.assign({}, round, {
            interviewerEmail: interviewerEmail || '',
            interviewer: enriched.interviewer || '',
            interviewerTitle: enriched.interviewerTitle || '',
          }),
          baseUrl,
        });
        if ((outcome.sent || outcome.skipped) && round.id) {
          pendingReminders.push({
            applicationId: application.id,
            interviewId: round.id,
            reminderSentOn: today,
          });
        }
      }
    }
    if (pendingReminders.length) await hiringDb.applyReminderSentOn(pendingReminders);
    await sendUnbookedInvitationReminders(data, today, baseUrl);
    reminderLastSlot = slot;
  } catch (error) {
    console.error('[mail] Day reminder job failed:', error.message || error);
  } finally {
    reminderJobRunning = false;
  }
}

async function runRecurringAvailabilityExtend() {
  if (availabilityExtendRunning) return;
  const today = mail.zonedYmd(new Date());
  if (availabilityExtendLastDay === today) return;
  availabilityExtendRunning = true;
  try {
    const result = await hiringDb.extendAllActiveRecurringSeries();
    availabilityExtendLastDay = today;
    if (result.added) {
      console.log(`[availability] Extended ${result.added} slot(s) across ${result.users} account(s).`);
    }
  } catch (error) {
    console.error('[availability] Recurring extend failed:', error.message || error);
  } finally {
    availabilityExtendRunning = false;
  }
}

function startInterviewReminderJob() {
  setInterval(() => {
    runInterviewDayReminders().catch((error) => {
      console.error('[mail] Reminder tick failed:', error.message || error);
    });
    runRecurringAvailabilityExtend().catch((error) => {
      console.error('[availability] Extend tick failed:', error.message || error);
    });
    runBookingInvitationExpiry().catch((error) => {
      console.error('[booking] Expiry tick failed:', error.message || error);
    });
  }, 60 * 1000);
  setTimeout(() => {
    runInterviewDayReminders().catch(() => {});
    runRecurringAvailabilityExtend().catch(() => {});
    runBookingInvitationExpiry().catch(() => {});
  }, 5000);
}

async function seedInterviews(stages, existing = []) {
  const byLabel = new Map((existing || []).map((entry) => [String(entry.label || ''), entry]));
  const out = [];
  for (let index = 0; index < stages.length; index += 1) {
    const label = stages[index];
    out.push(await normalizeInterviewEntry(byLabel.get(label) || { label }, index, label));
  }
  return out;
}

/* First interview only, and only on a transition. A second save has a
   pathway already stored and/or a round already present, so this stays false. */
function shouldSeedFirstInterview(pathway, task, existing, interviews) {
  if ((interviews || []).length) return false;
  if (task && task.decision === 'rejected') return false;
  const unlocked = pathway === 'no_tasks' || (pathway === 'with_tasks' && task && task.decision === 'approved');
  if (!unlocked) return false;
  const justAccepted = existing.phoneScreen !== 'accepted';
  const justChosePathway = Boolean(pathway) && pathway !== existing.pathway;
  const justApprovedTask = pathway === 'with_tasks'
    && task.decision === 'approved'
    && ((existing.task && existing.task.decision) !== 'approved');
  return justAccepted || justChosePathway || justApprovedTask;
}

function derivePipelineStage(pipeline) {
  const phone = pipeline.phoneScreen;
  if (phone === 'rejected' || phone === 'requirements_not_met') return 'closed';
  if (phone === 'pending' || phone === 'shortlisted') return 'phone_screen';
  if (phone !== 'accepted') return 'phone_screen';
  if (!pipeline.pathway) return 'phone_screen';
  if (pipeline.pathway === 'with_tasks') {
    const decision = (pipeline.task && pipeline.task.decision) || 'pending';
    if (decision === 'rejected') return 'closed';
    if (decision !== 'approved') return 'task';
  }
  if (pipeline.offer.status === 'joined' || pipeline.offer.status === 'declined') return 'closed';
  if (pipeline.offer.status === 'sent') return 'offer';
  const interviews = pipeline.interviews || [];
  if (!interviews.length) return 'interview';
  const allResolved = interviews.every((entry) => interviewResultResolved(entry && entry.result));
  if (allResolved && interviews.every((entry) => entry.result === 'pass')) return 'offer';
  if (allResolved && interviews.some((entry) => interviewResultCloses(entry.result))) return 'closed';
  return 'interview';
}

function mirrorInboxStatus(pipeline) {
  if (
    pipeline.phoneScreen === 'rejected'
    || pipeline.phoneScreen === 'requirements_not_met'
    || pipeline.offer.status === 'declined'
    || (pipeline.task && pipeline.task.decision === 'rejected')
  ) {
    return 'rejected';
  }
  if (pipeline.phoneScreen === 'accepted' || pipeline.offer.status === 'sent' || pipeline.offer.status === 'joined') {
    return 'contacted';
  }
  if (pipeline.phoneScreen === 'shortlisted' || pipeline.phoneScreen === 'pending' || pipeline.stage === 'phone_screen') {
    return pipeline.phoneScreen === 'pending' ? 'reviewing' : 'reviewing';
  }
  return 'reviewing';
}

/** Stamp firstContactedAt once when status leaves 'new'. Never overwrites an existing stamp. */
function applyApplicationStatus(application, nextStatus) {
  const previous = String((application && application.status) || 'new');
  const next = String(nextStatus || 'new');
  if (previous === 'new' && next !== 'new' && !(application && application.firstContactedAt)) {
    application.firstContactedAt = new Date().toISOString();
  }
  application.status = next;
  return application;
}

async function cleanPipelinePayload(input, existingApplication, session) {
  const existing = existingApplication.pipeline && typeof existingApplication.pipeline === 'object'
    ? existingApplication.pipeline
    : defaultPipeline();
  const incoming = input && typeof input === 'object' ? input : {};
  const phoneScreen = PHONE_SCREEN_OUTCOMES.has(incoming.phoneScreen) ? incoming.phoneScreen : (existing.phoneScreen || 'pending');
  let pathway = incoming.pathway == null || incoming.pathway === ''
    ? (existing.pathway || null)
    : (PATHWAYS.has(incoming.pathway) ? incoming.pathway : null);

  if (phoneScreen !== 'accepted') pathway = null;

  const taskIncoming = incoming.task && typeof incoming.task === 'object' ? incoming.task : {};
  const taskExisting = existing.task && typeof existing.task === 'object' ? existing.task : {};
  const reviewedByUserId = text(
    taskIncoming.reviewedByUserId != null ? taskIncoming.reviewedByUserId : taskExisting.reviewedByUserId,
    80,
  );
  const reviewer = reviewedByUserId ? await findStaffInterviewer(reviewedByUserId) : null;
  /* Who the task is routed to. Independent of reviewedByUserId, which records
     who actually submitted the decision — normally the assignee, but HR when
     they review it themselves. Assignment is a routing hint only: it decides
     whose queue the task appears in and never gates who may review it.
     Validated through findStaffInterviewer so an inactive or unknown account
     cannot be assigned; an unresolvable id clears the assignment rather than
     silently storing a dangling reference. */
  const assignedToUserId = text(
    taskIncoming.assignedToUserId != null ? taskIncoming.assignedToUserId : taskExisting.assignedToUserId,
    80,
  );
  const assignee = assignedToUserId ? await findStaffInterviewer(assignedToUserId) : null;
  const taskScoreRaw = Object.prototype.hasOwnProperty.call(taskIncoming, 'score')
    ? taskIncoming.score
    : taskExisting.score;
  const task = {
    title: text(taskIncoming.title != null ? taskIncoming.title : taskExisting.title, 200),
    notes: text(taskIncoming.notes != null ? taskIncoming.notes : taskExisting.notes, 4000),
    status: TASK_STATUSES.has(taskIncoming.status) ? taskIncoming.status : (TASK_STATUSES.has(taskExisting.status) ? taskExisting.status : 'sent'),
    decision: TASK_DECISIONS.has(taskIncoming.decision) ? taskIncoming.decision : (TASK_DECISIONS.has(taskExisting.decision) ? taskExisting.decision : 'pending'),
    /* Name is snapshotted alongside the id, as interview rounds do, so the HR
       view still reads correctly if the account is later deactivated. */
    assignedToUserId: assignee ? assignee.id : '',
    assignedTo: assignee ? assignee.name : '',
    reviewedByUserId: reviewer ? reviewer.id : '',
    reviewedBy: reviewer
      ? reviewer.name
      : text(taskIncoming.reviewedBy != null ? taskIncoming.reviewedBy : taskExisting.reviewedBy, 120),
    score: normalizeHalfPointScore(taskScoreRaw, 'Task score'),
  };

  if (task.decision === 'approved' || task.decision === 'rejected') {
    if (!task.reviewedByUserId || !task.reviewedBy) {
      throw Object.assign(new Error('Pick a reviewer before approving or rejecting the task.'), { status: 422 });
    }
  }
  if (task.decision === 'approved') {
    if (task.status !== 'done') {
      throw Object.assign(new Error('Set task status to Done before approving.'), { status: 422 });
    }
    if (task.score == null) {
      throw Object.assign(new Error('Add a task score (0–10) before approving.'), { status: 422 });
    }
  }

  if (pathway === 'with_tasks' && phoneScreen === 'accepted' && !task.title) {
    throw Object.assign(new Error('Add a task title before continuing on the tasks pathway.'), { status: 422 });
  }

  let interviews = Array.isArray(incoming.interviews) ? incoming.interviews : (existing.interviews || []);
  if (phoneScreen === 'accepted') {
    const stages = jobStagesForApplication(existingApplication);
    if (task.decision === 'rejected') {
      interviews = [];
    } else if (shouldSeedFirstInterview(pathway, task, existing, interviews)) {
      interviews = await seedInterviews(stages.slice(0, 1), interviews);
    } else if (interviews.length) {
      // Keep filled rounds + at most one open/pending blank round from older multi-seed data.
      const existingById = new Map((existing.interviews || []).map((entry) => [String(entry.id || ''), entry]));
      const normalized = [];
      for (let index = 0; index < Math.min(interviews.length, 12); index += 1) {
        const entry = interviews[index];
        const prev = existingById.get(String((entry && entry.id) || ''));
        const merged = Object.assign({}, entry || {});
        if (prev && String(prev.scheduledAt || '') === String(merged.scheduledAt || '')) {
          merged.reminderSentOn = prev.reminderSentOn || '';
        } else {
          merged.reminderSentOn = '';
        }
        normalized.push(await normalizeInterviewEntry(merged, index, stages[index] || ''));
      }
      const kept = [];
      let openKept = false;
      normalized.forEach((entry) => {
        const blank = !entry.interviewer && !entry.interviewerUserId && !entry.scheduledAt && !entry.notes && entry.score == null && entry.result === 'pending';
        if (!blank) {
          kept.push(entry);
          openKept = false;
        } else if (!openKept) {
          kept.push(entry);
          openKept = true;
        }
      });
      interviews = kept.length ? kept : normalized.slice(0, 1);
    }
  } else if (phoneScreen === 'pending' || phoneScreen === 'shortlisted') {
    interviews = Array.isArray(existing.interviews) ? existing.interviews : [];
  } else {
    interviews = [];
  }

  interviews = await applyFeedbackAttribution(interviews, existing.interviews, session);

  const offerIncoming = incoming.offer && typeof incoming.offer === 'object' ? incoming.offer : {};
  const offerExisting = existing.offer && typeof existing.offer === 'object' ? existing.offer : {};
  let offerStatus = OFFER_STATUSES.has(offerIncoming.status) ? offerIncoming.status : (OFFER_STATUSES.has(offerExisting.status) ? offerExisting.status : 'none');
  const declinedReason = text(
    offerIncoming.declinedReason != null ? offerIncoming.declinedReason : offerExisting.declinedReason,
    2000,
  );

  if (phoneScreen !== 'accepted') {
    offerStatus = 'none';
  }
  if (offerStatus === 'declined' && !declinedReason) {
    throw Object.assign(new Error('Provide a reason when the candidate declines.'), { status: 422 });
  }
  if (offerStatus !== 'none') {
    const list = interviews || [];
    const cycleComplete = list.length > 0 && list.every((entry) => entry && interviewResultResolved(entry.result));
    if (!cycleComplete) {
      throw Object.assign(new Error('Finish every interview round before choosing an offer outcome.'), { status: 422 });
    }
    if (pathway === 'with_tasks' && task.decision !== 'approved') {
      throw Object.assign(new Error('Approve the task before moving to the offer stage.'), { status: 422 });
    }
    if (offerStatus === 'sent' || offerStatus === 'joined') {
      const hasPass = list.some((entry) => entry && entry.result === 'pass');
      if (!hasPass) {
        throw Object.assign(new Error('At least one interview round must Pass before sending or joining an offer.'), { status: 422 });
      }
    }
  }

  const pipeline = {
    stage: 'phone_screen',
    phoneScreen,
    pathway,
    task: {
      title: task.title,
      notes: task.notes,
      status: task.status || 'sent',
      decision: task.decision || 'pending',
      assignedToUserId: task.assignedToUserId || '',
      assignedTo: task.assignedTo || '',
      reviewedByUserId: task.reviewedByUserId || '',
      reviewedBy: task.reviewedBy || '',
      score: task.score,
    },
    interviews: phoneScreen === 'accepted' ? interviews : interviews,
    offer: {
      status: offerStatus,
      declinedReason: offerStatus === 'declined' ? declinedReason : '',
    },
    history: Array.isArray(existing.history) ? existing.history.slice(0, 40) : [],
  };

  pipeline.stage = derivePipelineStage(pipeline);

  const detail = text(incoming.historyDetail, 300) || text(incoming.action, 80) || 'Pipeline updated';
  pipeline.history.unshift({
    at: new Date().toISOString(),
    by: session.username || 'hr',
    action: text(incoming.action, 80) || 'update',
    detail,
  });
  pipeline.history = pipeline.history.slice(0, 40);

  return pipeline;
}

function readContactRequests() {
  if (!fs.existsSync(CONTACT_REQUESTS_FILE)) return { version: 1, updatedAt: null, requests: [] };
  return JSON.parse(fs.readFileSync(CONTACT_REQUESTS_FILE, 'utf8'));
}

function writeContactRequests(data) {
  const temp = `${CONTACT_REQUESTS_FILE}.tmp`;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temp, CONTACT_REQUESTS_FILE);
  fs.unlinkSync(temp);
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expectedHex] = String(stored || '').split(':');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashInviteToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex');
}

function createInvite() {
  const raw = crypto.randomBytes(32).toString('hex');
  return {
    raw,
    inviteTokenHash: hashInviteToken(raw),
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  };
}

function applyInvite(account, invite) {
  account.inviteTokenHash = invite.inviteTokenHash;
  account.inviteExpiresAt = invite.inviteExpiresAt;
  account.mustSetPassword = true;
  account.passwordHash = null;
}

function clearInvite(account) {
  account.inviteTokenHash = null;
  account.inviteExpiresAt = null;
  account.mustSetPassword = false;
}

function inviteUrlFor(rawToken) {
  return `/admin/?setup=${encodeURIComponent(rawToken)}`;
}

/**
 * Shared account creation for both User Management and the Interviewers tab, so
 * there is a single invite implementation. Throws `{ status, code, message }`
 * for the caller to convert into a JSON error.
 *
 * Supplying `password` makes the account usable immediately; omitting it issues
 * an invite. Returns the account plus, when an invite was issued, the raw token
 * for one-time display to the creating administrator.
 */
async function createManagedAccount(body, { role: forcedRole } = {}) {
  const users = await readUsers();
  const username = cleanUsername(body.username);
  const email = cleanWorkEmail(body.email);
  const jobTitle = cleanJobTitle(body.jobTitle);
  const photo = cleanPhotoPath(body.photo);
  const name = text(body.name, 100) || username;
  const password = validatePassword(body.password, false);
  if (!name) throw Object.assign(new Error('Enter the full name for this account.'), { status: 422, code: 'NAME_REQUIRED' });
  if (!username) throw Object.assign(new Error('Enter a username for this account.'), { status: 422, code: 'USERNAME_REQUIRED' });
  if (users.users.some((user) => user.username === username)) {
    throw Object.assign(new Error('This username is already in use.'), { status: 409, code: 'USERNAME_EXISTS' });
  }
  if (users.users.some((user) => String(user.email || '').toLowerCase() === email)) {
    throw Object.assign(new Error('This work email is already in use.'), { status: 409, code: 'EMAIL_EXISTS' });
  }
  const role = normalizeAccountRole(forcedRole != null ? forcedRole : body.role);
  const now = new Date().toISOString();
  const account = {
    id: `user-${crypto.randomUUID()}`,
    username,
    name,
    email,
    jobTitle,
    photo,
    role,
    active: body.active !== false,
    passwordHash: null,
    mustSetPassword: false,
    inviteTokenHash: null,
    inviteExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    interviewStages: (role === 'hr' || role === 'interviewer')
      ? normalizeInterviewerStageSet(body.interviewStages)
      : [],
  };
  let invite = null;
  if (password) account.passwordHash = passwordHash(password);
  else {
    invite = createInvite();
    applyInvite(account, invite);
  }
  users.users.push(account);
  await writeUsers(users);
  return { account, users, invite };
}

/** One-time invite payload for the creating administrator; never re-issued. */
async function inviteResponsePart(account, invite, req) {
  if (!invite) return {};
  const emailed = await sendAccountInvite(account, invite.raw, req);
  return { invite: { url: inviteUrlFor(invite.raw), expiresAt: invite.inviteExpiresAt, emailed } };
}

/**
 * Emails the invite link. Returns whether it was actually sent so the caller can
 * tell the administrator to pass the link on manually when mail is off.
 * The raw token is never logged — on failure only the reason is recorded.
 */
async function sendAccountInvite(account, rawToken, req) {
  try {
    const baseUrl = mail.publicBaseUrl(req && req.headers && req.headers.host);
    const outcome = await mail.sendAccountInviteEmail({
      account,
      inviteUrl: `${baseUrl}${inviteUrlFor(rawToken)}`,
      expiresAt: account.inviteExpiresAt,
    });
    if (!outcome || !outcome.sent) {
      console.warn(`[invite] Not emailed for ${account.username} (${outcome && outcome.reason ? outcome.reason : 'unknown'}); share the link from the response.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[invite] Send failed:', error.message || error);
    return false;
  }
}

function cleanWorkEmail(value) {
  const email = text(value, 160).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid work email address.'), { status: 422 });
  }
  return email;
}

function cleanJobTitle(value) {
  const title = text(value, 120);
  if (!title) throw Object.assign(new Error('Enter a job title.'), { status: 422 });
  return title;
}

function cleanPhotoPath(value) {
  const photo = text(value, 300);
  if (!photo) return '';
  if (!/^assets\/(?:uploads\/)?[A-Za-z0-9._/-]+$/.test(photo) || photo.includes('..')) {
    throw Object.assign(new Error('Invalid profile photo path.'), { status: 422 });
  }
  return photo;
}

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email || '',
    jobTitle: user.jobTitle || '',
    photo: user.photo || '',
    role: user.role,
    active: user.active,
    mustSetPassword: Boolean(user.mustSetPassword) || !user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

/* ---------------------------------------------------------------------------
 * Interviewer data access
 *
 * Interviewers see only the rounds assigned to them, and never a candidate's
 * expected salary, current salary, or notice period. Every response below is
 * built from an explicit allow-list rather than by deleting keys from the full
 * record, so a column added to dbo.applications later is excluded by default
 * instead of leaking until someone remembers to hide it.
 * ------------------------------------------------------------------------- */

/** Never sent to an interviewer, on any endpoint. Asserted in tests. */
const INTERVIEWER_FORBIDDEN_FIELDS = ['expectedSalary', 'currentSalary', 'noticePeriodWeeks'];

/** The rounds on this application that belong to the given interviewer. */
function roundsAssignedTo(application, userId) {
  const id = String(userId || '');
  if (!id) return [];
  const pipeline = application && application.pipeline;
  const interviews = (pipeline && Array.isArray(pipeline.interviews)) ? pipeline.interviews : [];
  return interviews.filter((round) => String(round && round.interviewerUserId || '') === id);
}

function taskAssignedTo(application, userId) {
  const id = String(userId || '');
  if (!id) return false;
  const task = application && application.pipeline && application.pipeline.task;
  return Boolean(task && typeof task === 'object' && String(task.assignedToUserId || '') === id);
}

function interviewerHasAccess(application, userId) {
  return roundsAssignedTo(application, userId).length > 0 || taskAssignedTo(application, userId);
}

/** One round, with the interviewer's own feedback state. */
function interviewerRoundView(application, round) {
  const score = round.score == null ? null : round.score;
  const result = round.result || 'pending';
  const notes = round.notes || '';
  return {
    applicationId: application.id,
    reference: application.reference || '',
    candidateName: application.fullName || '',
    role: application.role || '',
    roundId: round.id || '',
    label: round.label || '',
    scheduledAt: round.scheduledAt || '',
    format: round.format || 'online',
    meetingLink: round.meetingLink || '',
    feedback: {
      result,
      score,
      notes,
      /* A decision was made. Notes or a score alone are a draft and must not
         pull the round out of awaiting/stale. */
      recorded: result !== 'pending',
    },
  };
}

/**
 * The task on this application, if it is routed to the given interviewer and
 * still needs a decision. Returns null otherwise.
 *
 * A task only enters the queue once its status is `done`: before that the work
 * sits with the candidate, not the reviewer, so listing it would misrepresent
 * what the interviewer is being asked to do. Assignment is a routing hint — HR
 * can review any task regardless of who it is assigned to.
 */
function interviewerTaskView(application, userId) {
  const id = String(userId || '');
  const task = application && application.pipeline && application.pipeline.task;
  if (!id || !task || typeof task !== 'object') return null;
  if (String(task.assignedToUserId || '') !== id) return null;
  if (task.decision && task.decision !== 'pending') return null; // actioned — leaves the queue
  if (task.status !== 'done') return null;                       // still with the candidate
  return {
    applicationId: application.id,
    reference: application.reference || '',
    candidateName: application.fullName || '',
    role: application.role || '',
    title: task.title || '',
    notes: task.notes || '',
    status: task.status,
    decision: task.decision || 'pending',
    bucket: 'tasks',
  };
}

/**
 * Interviewer records a task decision from their queue. Identity is taken from
 * the session, never the request body. Assignment is who may use this path;
 * it does not pre-fill the reviewer and does not stop HR using the pipeline
 * form. Does not seed interviews or move the candidate forward — HR does that.
 */
async function applyInterviewerTaskReview(application, session, incoming) {
  const existing = application.pipeline && typeof application.pipeline === 'object'
    ? application.pipeline
    : defaultPipeline();
  const taskExisting = existing.task && typeof existing.task === 'object' ? existing.task : {};
  if (!taskAssignedTo(application, session.userId)) {
    const error = new Error('This task is not assigned to you.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  if (taskExisting.status !== 'done') {
    throw Object.assign(new Error('The task is still with the candidate.'), { status: 422 });
  }
  const decision = TASK_DECISIONS.has(incoming && incoming.decision) ? incoming.decision : '';
  if (decision !== 'approved' && decision !== 'rejected') {
    throw Object.assign(new Error('Choose Approve or Reject.'), { status: 422 });
  }
  const reviewer = await findStaffInterviewer(session.userId);
  if (!reviewer) {
    throw Object.assign(new Error('Your interviewer account could not be resolved.'), { status: 422 });
  }
  const score = incoming && Object.prototype.hasOwnProperty.call(incoming, 'score')
    ? normalizeHalfPointScore(incoming.score, 'Task score')
    : (taskExisting.score == null ? null : taskExisting.score);
  if (decision === 'approved' && score == null) {
    throw Object.assign(new Error('Add a task score (0–10) before approving.'), { status: 422 });
  }
  let interviews = Array.isArray(existing.interviews) ? existing.interviews.slice() : [];
  if (decision === 'rejected') {
    interviews = [];
  } else if (decision === 'approved' && !interviews.length) {
    interviews = await seedInterviews(jobStagesForApplication(application).slice(0, 1), interviews);
  }
  const pipeline = {
    stage: existing.stage || 'task',
    phoneScreen: existing.phoneScreen || 'pending',
    pathway: existing.pathway || null,
    task: {
      title: taskExisting.title || '',
      notes: taskExisting.notes || '',
      status: taskExisting.status || 'done',
      decision,
      assignedToUserId: taskExisting.assignedToUserId || '',
      assignedTo: taskExisting.assignedTo || '',
      reviewedByUserId: reviewer.id,
      reviewedBy: reviewer.name,
      score,
    },
    interviews,
    offer: existing.offer && typeof existing.offer === 'object'
      ? existing.offer
      : { status: 'none', declinedReason: '' },
    history: Array.isArray(existing.history) ? existing.history.slice(0, 40) : [],
  };
  pipeline.stage = derivePipelineStage(pipeline);
  const scorePart = score == null ? '' : ` · score ${score}`;
  pipeline.history.unshift({
    at: new Date().toISOString(),
    by: session.username || reviewer.name || 'interviewer',
    action: 'task_review',
    detail: `Task ${decision}${scorePart} by ${reviewer.name}`,
  });
  pipeline.history = pipeline.history.slice(0, 40);
  return pipeline;
}

/**
 * Interviewer records or amends feedback on one of their own rounds. Writes the
 * existing result / score / notes fields only. Does not accept a full pipeline
 * payload, does not touch other rounds, and does not move the candidate —
 * derivePipelineStage is left for HR. Every save, including an edit, gets a
 * history row.
 */
async function applyInterviewerRoundFeedback(application, session, roundId, incoming) {
  const existing = application.pipeline && typeof application.pipeline === 'object'
    ? application.pipeline
    : defaultPipeline();
  const interviews = Array.isArray(existing.interviews) ? existing.interviews.slice() : [];
  const index = interviews.findIndex((entry) => String(entry && entry.id || '') === String(roundId || ''));
  if (index === -1) {
    const error = new Error('Interview round not found.');
    error.status = 404;
    error.code = 'ROUND_NOT_FOUND';
    throw error;
  }
  const current = interviews[index] && typeof interviews[index] === 'object' ? interviews[index] : {};
  if (String(current.interviewerUserId || '') !== String(session.userId || '')) {
    const error = new Error('This round is not assigned to you.');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
  const result = INTERVIEW_RESULTS.has(incoming && incoming.result) ? incoming.result : '';
  if (result !== 'pass' && result !== 'fail') {
    throw Object.assign(new Error('Choose Pass or Fail.'), { status: 422 });
  }
  const score = incoming && Object.prototype.hasOwnProperty.call(incoming, 'score')
    ? normalizeHalfPointScore(incoming.score, 'Interview scores')
    : (current.score == null ? null : current.score);
  if (score == null) {
    throw Object.assign(new Error('Add a score (0–10) before marking Pass or Fail.'), { status: 422 });
  }
  const notes = text(incoming && incoming.notes != null ? incoming.notes : current.notes, 2000);
  const author = await feedbackAuthorFromSession(session);
  const previous = {
    result: current.result || 'pending',
    score: current.score == null ? null : current.score,
    notes: current.notes || '',
  };
  interviews[index] = {
    ...current,
    result,
    score,
    notes,
    recordedByUserId: author.id || current.recordedByUserId || '',
    recordedBy: author.name || current.recordedBy || '',
  };
  const pipeline = {
    stage: existing.stage || 'interview',
    phoneScreen: existing.phoneScreen || 'pending',
    pathway: existing.pathway || null,
    task: existing.task && typeof existing.task === 'object' ? existing.task : defaultPipeline().task,
    interviews,
    offer: existing.offer && typeof existing.offer === 'object'
      ? existing.offer
      : { status: 'none', declinedReason: '' },
    history: Array.isArray(existing.history) ? existing.history.slice(0, 40) : [],
  };
  const label = current.label || 'Interview';
  const changed = previous.result !== result || previous.score !== score || previous.notes !== notes;
  const edited = previous.result === 'pass' || previous.result === 'fail';
  const scorePart = ` · score ${score}`;
  const fromPart = edited && previous.result !== result ? `${previous.result} → ` : '';
  pipeline.history.unshift({
    at: new Date().toISOString(),
    by: session.username || 'interviewer',
    action: 'interview_feedback',
    detail: `${label} ${fromPart}${result}${scorePart}${edited ? ' (edited)' : ''}`.trim(),
  });
  pipeline.history = pipeline.history.slice(0, 40);
  if (!changed && edited) {
    /* Still record the save — the brief requires a history row on every change.
       An identical resubmit is not a change, so skip the extra row. */
    pipeline.history.shift();
  }
  return pipeline;
}

/**
 * Sorts an interviewer's rounds into the queue buckets.
 *
 * "Completed" is inferred, not recorded: a round is treated as having happened
 * when its scheduled time is in the past and no result has been entered. HR
 * marking the round not attended is the correction path for a no-show.
 *
 * A round whose feedback is still missing INTERVIEW_FEEDBACK_STALE_DAYS after
 * the fact moves to `stale`, so the queue distinguishes "do this now" from
 * "this has been sitting". Rounds leave awaiting/stale only when result is no
 * longer pending — the same rule as tasks leaving once a decision is set.
 * Notes or a score without a result stay in the waiting bucket as a draft.
 */
function interviewerQueueBuckets(rounds, now = new Date()) {
  const staleBefore = new Date(now.getTime() - INTERVIEW_FEEDBACK_STALE_DAYS * 24 * 60 * 60 * 1000);
  const upcoming = [];
  const awaitingFeedback = [];
  const stale = [];
  const recorded = [];
  for (const round of rounds) {
    if (round.feedback.recorded) {
      recorded.push({ ...round, bucket: 'recorded' });
      continue;
    }
    const when = round.scheduledAt ? new Date(round.scheduledAt) : null;
    const valid = when && !Number.isNaN(when.getTime());
    if (!valid || when > now) {
      upcoming.push({ ...round, bucket: 'upcoming' });
    } else if (when >= staleBefore) {
      awaitingFeedback.push({ ...round, bucket: 'awaitingFeedback' });
    } else {
      stale.push({
        ...round,
        bucket: 'stale',
        daysOverdue: Math.floor((now.getTime() - when.getTime()) / (24 * 60 * 60 * 1000)),
      });
    }
  }
  const byTime = (a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || ''));
  upcoming.sort(byTime);
  awaitingFeedback.sort(byTime).reverse();
  stale.sort(byTime);
  recorded.sort(byTime).reverse();
  return { upcoming, awaitingFeedback, stale, recorded };
}

/** Full candidate detail for evaluation — allow-list, own rounds only. */
function interviewerCandidateView(application, userId) {
  return {
    id: application.id,
    reference: application.reference || '',
    fullName: application.fullName || '',
    role: application.role || '',
    roleSlug: application.roleSlug || '',
    email: application.email || '',
    phone: application.phone || '',
    linkedin: application.linkedin || '',
    yearsOfExperience: application.yearsOfExperience || '',
    resumeName: application.resumeName || '',
    status: application.status || 'new',
    submittedAt: application.submittedAt || '',
    /* Only this interviewer's rounds. Other interviewers' feedback, the task,
       the offer and the pipeline history are all withheld. */
    rounds: roundsAssignedTo(application, userId).map((round) => interviewerRoundView(application, round)),
  };
}

function isPipelineClosedRecord(pipeline) {
  if (!pipeline || typeof pipeline !== 'object') return true;
  if (pipeline.stage === 'closed') return true;
  if (pipeline.phoneScreen === 'rejected' || pipeline.phoneScreen === 'requirements_not_met') return true;
  if (pipeline.task && pipeline.task.decision === 'rejected') return true;
  if (pipeline.offer && (pipeline.offer.status === 'joined' || pipeline.offer.status === 'declined')) return true;
  return false;
}

function applicationMatchesJob(application, job) {
  const title = String((job && job.title) || '');
  const hrefSlug = path.basename(String((job && job.href) || ''), path.extname(String((job && job.href) || '')));
  const roleSlug = String((application && application.roleSlug) || '');
  return Boolean((title && application.role === title) || (hrefSlug && roleSlug && hrefSlug === roleSlug));
}

function shouldClearPipelineOnVacancyEnd(application) {
  if (!application || !application.pipeline || typeof application.pipeline !== 'object') return false;
  const joined = application.pipeline.offer && application.pipeline.offer.status === 'joined';
  const active = !isPipelineClosedRecord(application.pipeline);
  return active || joined;
}

function permissionsFor(role) {
  const admin = role === 'admin';
  const hr = role === 'hr';
  const marketing = role === 'marketing';
  const interviewer = role === 'interviewer';
  return {
    collections: admin
      ? Array.from(COLLECTIONS).filter((name) => name !== 'jobs')
      : (hr ? ['jobs'] : []),
    pages: admin ? Array.from(PAGES) : [],
    canManageUsers: admin,
    canUseTools: admin,
    canUseHiring: hr,
    canUseOnboarding: hr || marketing,
    /* Interviewers get their own portal only: no collections, no pages, no user
       management, no hiring portal, no onboarding. Every flag above is already
       false for this role; this one exists so the SPA can branch on it. */
    canUseInterviewerPortal: interviewer,
  };
}

function adminView(data, session) {
  const scopedMeta = () => ({
    ...data.meta,
    audit: (data.meta.audit || []).filter((event) => event.by === session.username).slice(0, 20),
  });
  if (session.role === 'admin') {
    const collections = {};
    for (const name of COLLECTIONS) {
      if (name === 'jobs') continue;
      collections[name] = data.collections[name] || [];
    }
    return {
      meta: data.meta,
      pages: data.pages,
      collections,
    };
  }
  if (session.role === 'hr') {
    return {
      meta: scopedMeta(),
      pages: {},
      collections: { jobs: data.collections.jobs || [] },
    };
  }
  /* Deny by default. Marketing, interviewer, and any unrecognised role get no
     collections and no pages. The HR shape used to be the fallthrough, which
     handed the whole jobs collection — drafts included — to any other role. */
  return {
    meta: scopedMeta(),
    pages: {},
    collections: {},
  };
}

function publicView(data) {
  const collections = {};
  for (const name of COLLECTIONS) {
    collections[name] = (data.collections[name] || [])
      .filter((item) => item.status === 'published')
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }
  return {
    meta: {
      version: data.meta.version,
      revision: data.meta.revision,
      updatedAt: data.meta.updatedAt,
    },
    pages: data.pages,
    collections,
  };
}

/** The public projection: pure generated artifacts, safe to rewrite any time. */
function writePublicProjection(data) {
  const published = publicView(data);
  fs.writeFileSync(PUBLIC_JSON_FILE, `${JSON.stringify(published, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    PUBLIC_JS_FILE,
    `/* Generated by the Digital Hub CMS. Do not edit directly. */\nwindow.DH_CONTENT = ${JSON.stringify(published)};\n`,
    'utf8'
  );
}

/**
 * Rewrites committed, hand-editable HTML from templates held in this process's
 * module cache. Only safe to run when content has actually been saved — running
 * it at startup replaced pushed markup with output from a stale template.
 */
function syncGeneratedHtml(data) {
  blogPages.writeBlogPages(data);
  partnerLogos.syncPartnerLogos(data);
  serviceSuiteImages.syncServiceSuiteImages(data);
  serviceMethodology.syncServiceMethodology(data);
  aboutHistory.syncAboutHistory(data);
  siteSocial.syncSiteSocial(data);
}

function writeDerivedFiles(data) {
  writePublicProjection(data);
  syncGeneratedHtml(data);
}

function blogValidationMode() {
  try {
    if (!fs.existsSync(VALIDATION_CONFIG_FILE)) return 'warn';
    const config = JSON.parse(fs.readFileSync(VALIDATION_CONFIG_FILE, 'utf8'));
    return config.blogPublishValidation === 'enforce' ? 'enforce' : 'warn';
  } catch (_) {
    return 'warn';
  }
}

function writeData(data) {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temp, DATA_FILE);
  fs.unlinkSync(temp);
  writeDerivedFiles(data);
}

/** Old end-vacancy flow set status to draft; promote those to ended using audit history. */
function migrateLegacyEndedVacancies(data) {
  const jobs = (data.collections && data.collections.jobs) || [];
  if (!jobs.length) return false;
  const endedTitles = new Set();
  for (const event of (data.meta && data.meta.audit) || []) {
    const label = String((event && event.label) || '');
    const match = label.match(/^Ended vacancy [“"](.+)[”"]$/);
    if (match && match[1]) endedTitles.add(match[1]);
  }
  if (!endedTitles.size) return false;
  let changed = false;
  const now = new Date().toISOString();
  for (const job of jobs) {
    if (job.status !== 'draft') continue;
    if (!endedTitles.has(job.title)) continue;
    job.status = 'ended';
    job.endedAt = job.endedAt || job.updatedAt || now;
    job.updatedAt = now;
    changed = true;
  }
  return changed;
}

function ensureStorage() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) throw new Error(`Missing content store: ${DATA_FILE}`);
  if (!fs.existsSync(CONTACT_REQUESTS_FILE)) writeContactRequests({ version: 1, updatedAt: null, requests: [] });
  const data = readData();
  /* A real migration changes content, so the full regeneration is warranted.
     Otherwise refresh only the public projection — never the committed HTML. */
  if (migrateLegacyEndedVacancies(data)) writeData(data);
  else writePublicProjection(data);
}

/**
 * Create the first admin when admin_users is empty (greenfield only).
 */
async function ensureAdminBootstrap() {
  const store = await readUsers();
  if ((store.users || []).length > 0) return;

  const now = new Date().toISOString();
  await writeUsers({
    version: 1,
    updatedAt: now,
    users: [{
      id: `user-${crypto.randomUUID()}`,
      username: ADMIN_USER.toLowerCase(),
      name: 'Administrator',
      role: 'admin',
      active: true,
      passwordHash: passwordHash(ADMIN_PASSWORD),
      mustSetPassword: false,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    }],
  });
  console.log('[auth] Bootstrapped initial administrator account into admin_users');
}

async function readOnboarding() {
  ensureStorage();
  return hiringDb.readOnboardingStore();
}

async function writeOnboarding(data) {
  return hiringDb.writeOnboardingStore(data);
}

function emptyOnboardingAssets() {
  return {
    onboardingPost: '',
    joiningPost: '',
    businessCard: '',
    employeeId: '',
  };
}

function cleanOnboardingAssetPath(value) {
  const raw = text(value, 260);
  if (!raw) return '';
  if (/^assets\/uploads\/[a-z0-9._-]+$/i.test(raw)) return raw;
  throw Object.assign(new Error('Asset path must be an uploaded file under assets/uploads.'), { status: 422 });
}

function cleanLinkedInUrl(value) {
  const raw = text(value, 300);
  if (!raw) return '';
  if (!/^https?:\/\/(www\.)?linkedin\.com\//i.test(raw)) {
    throw Object.assign(new Error('Enter a valid LinkedIn profile URL.'), { status: 422 });
  }
  return raw;
}

function findOpenOnboarding(requests, applicationId) {
  return (requests || []).find((item) => (
    item.applicationId === applicationId
    && item.status !== 'completed'
  ));
}

function cleanOnboardingEmail(value, required = false) {
  const email = text(value, 160).toLowerCase();
  if (!email) {
    if (required) throw Object.assign(new Error('Enter an email address.'), { status: 422 });
    return '';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid email address.'), { status: 422 });
  }
  return email;
}

function cleanOnboardingMobile(value, required = false) {
  const mobile = text(value, 40);
  if (!mobile) {
    if (required) throw Object.assign(new Error('Enter a mobile number.'), { status: 422 });
    return '';
  }
  if (mobile.replace(/[\s()-]/g, '').length < 7) {
    throw Object.assign(new Error('Enter a valid mobile number.'), { status: 422 });
  }
  return mobile;
}

function createOnboardingDraftFromApplication(application, username, overrides = {}) {
  const now = new Date().toISOString();
  const request = {
    id: `onb-${crypto.randomUUID()}`,
    applicationId: application.id,
    reference: text(application.reference || application.id, 80),
    fullName: text(overrides.fullName || application.fullName || application.name, 120),
    jobTitle: text(overrides.jobTitle || application.role || application.roleTitle || application.jobTitle, 120),
    email: text(overrides.email || application.email || '', 160).toLowerCase(),
    mobile: text(overrides.mobile || application.phone || application.mobile || '', 40),
    linkedin: text(overrides.linkedin || application.linkedin || '', 300),
    idNumber: text(overrides.idNumber || '', 80),
    status: 'draft',
    assets: emptyOnboardingAssets(),
    notesHr: text(overrides.notesHr || '', 2000),
    notesMarketing: '',
    createdBy: text(username || 'hr', 80) || 'hr',
    sentAt: null,
    returnedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  if (request.linkedin) {
    try {
      request.linkedin = cleanLinkedInUrl(request.linkedin);
    } catch (_) {
      request.linkedin = text(overrides.linkedin || application.linkedin || '', 300);
    }
  }
  return request;
}

function enrichOnboardingFromApplication(request, application) {
  if (!request || !application) return false;
  let changed = false;
  if (!request.email && application.email) {
    request.email = text(application.email, 160).toLowerCase();
    changed = true;
  }
  if (!request.mobile && (application.phone || application.mobile)) {
    request.mobile = text(application.phone || application.mobile, 40);
    changed = true;
  }
  return changed;
}

async function ensureOnboardingDraftForApplication(application, username, overrides = {}) {
  if (!application || !application.id) return { request: null, created: false, store: await readOnboarding() };
  const offerStatus = String((((application.pipeline || {}).offer || {}).status) || '').toLowerCase();
  if (offerStatus !== 'joined') {
    return { request: null, created: false, store: await readOnboarding() };
  }
  const store = await readOnboarding();
  const existing = findOpenOnboarding(store.requests, application.id);
  if (existing) return { request: existing, created: false, store, existing: true };
  const request = createOnboardingDraftFromApplication(application, username, overrides);
  store.requests.unshift(request);
  await writeOnboarding(store);
  return { request, created: true, store };
}

async function syncJoinedApplicationsIntoOnboarding(username) {
  const appsData = await readApplications();
  const appsById = new Map((appsData.applications || []).map((item) => [item.id, item]));
  const store = await readOnboarding();
  let created = 0;
  let enriched = 0;
  (appsData.applications || []).forEach((application) => {
    const offerStatus = String((((application.pipeline || {}).offer || {}).status) || '').toLowerCase();
    if (offerStatus !== 'joined') return;
    if (findOpenOnboarding(store.requests, application.id)) return;
    store.requests.unshift(createOnboardingDraftFromApplication(application, username));
    created += 1;
  });
  (store.requests || []).forEach((request) => {
    if (request.status === 'completed') return;
    const application = appsById.get(request.applicationId);
    if (enrichOnboardingFromApplication(request, application)) enriched += 1;
  });
  if (created || enriched) await writeOnboarding(store);
  return { created, store: (created || enriched) ? await readOnboarding() : store };
}

async function requireOnboarding(req, res, mutation = false) {
  const session = mutation ? await requireMutationAuth(req, res) : await requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'hr' && session.role !== 'marketing') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Employee onboarding is available to HR and Marketing accounts only.' });
    return null;
  }
  return session;
}

function canUploadAssets(session) {
  return session && (session.role === 'admin' || session.role === 'hr' || session.role === 'marketing');
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .reduce((out, part) => {
      const index = part.indexOf('=');
      if (index > -1) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
      return out;
    }, {});
}

async function getSession(req) {
  const token = parseCookies(req).dh_admin_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const account = (await readUsers()).users.find((user) => user.id === session.userId);
  if (!account || !account.active) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  return { token, ...session, ...safeUser(account) };
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function requireAuth(req, res) {
  const session = await getSession(req);
  if (!session) {
    json(res, 401, { error: 'AUTH_REQUIRED', message: 'Please sign in again.' });
    return null;
  }
  return session;
}

async function requireMutationAuth(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return null;
  if (!safeEqual(req.headers['x-csrf-token'] || '', session.csrf)) {
    json(res, 403, { error: 'INVALID_CSRF', message: 'Your session could not be verified.' });
    return null;
  }
  return session;
}

async function requireAdmin(req, res, mutation = false) {
  const session = mutation ? await requireMutationAuth(req, res) : await requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Administrator access is required.' });
    return null;
  }
  return session;
}

function canEditCollection(session, collection) {
  if (collection === 'jobs') return session.role === 'hr';
  return session.role === 'admin';
}

function canEditPage(session, page) {
  return session.role === 'admin' && PAGES.has(page);
}

async function requireHr(req, res, mutation) {
  const session = mutation ? await requireMutationAuth(req, res) : await requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'hr') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Hiring tools are available to HR accounts only.' });
    return null;
  }
  return session;
}

/* Fails closed: only the exact string 'interviewer' passes, so a missing, null,
   or unexpected role is rejected. */
function formatAvailabilityWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: hiringDb.availabilityTimeZone(),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/* Queue, rounds, task review, and candidate GET. Interviewer or HR, always
   scoped to session.userId. Assignment checks stay in the apply helpers —
   HR does not get a second write path. */
async function requireInterviewer(req, res, mutation = false) {
  const session = mutation ? await requireMutationAuth(req, res) : await requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'interviewer' && session.role !== 'hr') {
    json(res, 403, {
      error: 'FORBIDDEN',
      message: 'These tools are available to interviewer and HR accounts only.',
    });
    return null;
  }
  return session;
}

/* Availability is session-scoped: HR and interviewers may only read or edit
   their own slots. Queue and feedback use the same role pair via requireInterviewer. */
async function requireOwnAvailability(req, res, mutation = false) {
  const session = mutation ? await requireMutationAuth(req, res) : await requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'interviewer' && session.role !== 'hr') {
    json(res, 403, {
      error: 'FORBIDDEN',
      message: 'Availability is available to interviewer and HR accounts only.',
    });
    return null;
  }
  return session;
}

/* Role is required, never defaulted: an omitted role used to fall back to 'hr',
   which silently granted a new account full access to candidate data.
   'admin' stays unassignable here on purpose, so managed accounts cannot
   escalate to administrator through account creation. */
function normalizeAccountRole(value) {
  const role = String(value == null ? '' : value).trim().toLowerCase();
  if (role === 'hr' || role === 'marketing' || role === 'interviewer') return role;
  throw Object.assign(new Error('Role must be HR, Marketing, or Interviewer.'), { status: 422 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BYTES) {
        reject(Object.assign(new Error('Payload is too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_) {
        reject(Object.assign(new Error('Invalid JSON body.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Application is too large. The CV must be 5 MB or smaller.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(req, buffer) {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw Object.assign(new Error('Invalid application form.'), { status: 400 });
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fields = {};
  const files = {};
  let cursor = buffer.indexOf(boundary);

  while (cursor >= 0) {
    cursor += boundary.length;
    if (buffer.slice(cursor, cursor + 2).toString() === '--') break;
    if (buffer.slice(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
    const next = buffer.indexOf(boundary, cursor);
    if (next < 0) break;
    let part = buffer.slice(cursor, next);
    if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) {
      cursor = next;
      continue;
    }
    const headers = part.slice(0, headerEnd).toString('utf8');
    const content = part.slice(headerEnd + 4);
    const disposition = headers.match(/content-disposition:\s*form-data;[^\r\n]*/i);
    const nameMatch = disposition && disposition[0].match(/name="([^"]+)"/i);
    const fileMatch = disposition && disposition[0].match(/filename="([^"]*)"/i);
    if (nameMatch) {
      if (fileMatch) {
        const typeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
        files[nameMatch[1]] = { name: path.basename(fileMatch[1]), type: typeMatch ? typeMatch[1].trim() : '', buffer: content };
      } else {
        fields[nameMatch[1]] = content.toString('utf8');
      }
    }
    cursor = next;
  }
  return { fields, files };
}

function text(value, max = 3000) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function cleanUsername(value) {
  const username = text(value, 40).toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(username)) {
    throw Object.assign(new Error('Username must be 2–40 characters using letters, numbers, dots, dashes, or underscores.'), { status: 422 });
  }
  return username;
}

function validatePassword(value, required = true) {
  const password = String(value || '');
  if (!password && !required) return '';
  if (password.length < 10 || password.length > 200) {
    throw Object.assign(new Error('Password must be between 10 and 200 characters.'), { status: 422 });
  }
  return password;
}

function findUserByInviteToken(users, rawToken) {
  const tokenHash = hashInviteToken(rawToken);
  if (!tokenHash || !rawToken) return null;
  return users.find((user) => user.inviteTokenHash && safeEqual(user.inviteTokenHash, tokenHash)) || null;
}

const DETAIL_PATHS = {
  services: 'services',
  partners: 'partners',
  caseStudies: 'cases',
  blogs: 'blogs',
  jobs: 'careers',
};

function contentSlug(value, fallback) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return slug || String(fallback || 'item').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function automaticHref(collection, title, id) {
  const directory = DETAIL_PATHS[collection];
  if (!directory) return '';
  return `${directory}/${contentSlug(title, id)}.html`;
}

function uniqueHref(href, list, currentId) {
  if (!href) return href;
  const used = new Set(list.filter((item) => item.id !== currentId).map((item) => item.href).filter(Boolean));
  if (!used.has(href)) return href;
  const extension = path.posix.extname(href) || '.html';
  const base = href.slice(0, href.length - extension.length);
  let counter = 2;
  while (used.has(`${base}-${counter}${extension}`)) counter += 1;
  return `${base}-${counter}${extension}`;
}

function cleanItem(collection, input, existing = {}) {
  const output = { id: existing.id || text(input.id, 100) || `${collection}-${crypto.randomUUID()}` };
  if (collection === 'blogs') {
    return cleanBlogItem(input, existing, output.id);
  }
  for (const key of fields[collection]) {
    const value = input[key];
    if (key === 'href') output[key] = text(value, 1000) || existing.href || '';
    else if (key === 'featured') output[key] = Boolean(value);
    else if (key === 'order' || key === 'readTime') output[key] = Math.max(0, Number(value) || 0);
    else if (key === 'categories') {
      const raw = Array.isArray(value) ? value : String(value || '').split(',');
      output[key] = raw.map((entry) => text(entry, 80)).filter(Boolean).slice(0, 10);
    } else if (key === 'suiteScenes') {
      const raw = Array.isArray(value) ? value : (Array.isArray(existing.suiteScenes) ? existing.suiteScenes : []);
      output[key] = raw.slice(0, 8).map((entry, index) => {
        const existingScene = Array.isArray(existing.suiteScenes) ? existing.suiteScenes[index] || {} : {};
        const title = text(entry && (entry.title || entry.label), 160)
          || text(existingScene.title || existingScene.label, 160)
          || `Scene ${index + 1}`;
        const featuresRaw = Array.isArray(entry && entry.features)
          ? entry.features
          : (Array.isArray(existingScene.features) ? existingScene.features : []);
        const features = featuresRaw.slice(0, 6).map((feature) => {
          const iconRaw = text(feature && feature.icon, 80);
          const iconName = (iconRaw.match(/\bti-[a-z0-9-]+\b/i) || [])[0] || 'ti-circle';
          return {
            icon: iconName,
            text: text(feature && feature.text, 200),
          };
        }).filter((feature) => feature.text);
        return {
          title,
          label: title,
          description: text(entry && entry.description, 2000) || text(existingScene.description, 2000),
          features,
          image: text(entry && entry.image, 1000) || text(existingScene.image, 1000),
          alt: text(entry && entry.alt, 300) || text(existingScene.alt, 300) || `${title} visual`,
        };
      }).filter((entry) => entry.image || entry.title || entry.description);
    } else if (key === 'methodology') {
      const incoming = value && typeof value === 'object' ? value : {};
      const existingMethod = existing.methodology && typeof existing.methodology === 'object' ? existing.methodology : {};
      const stagesRaw = Array.isArray(incoming.stages)
        ? incoming.stages
        : (Array.isArray(existingMethod.stages) ? existingMethod.stages : []);
      output[key] = {
        label: text(incoming.label, 120) || text(existingMethod.label, 120) || 'Our methodology',
        title: text(incoming.title, 200) || text(existingMethod.title, 200),
        lead: text(incoming.lead, 2000) || text(existingMethod.lead, 2000),
        stages: stagesRaw.slice(0, 6).map((entry, index) => {
          const existingStage = Array.isArray(existingMethod.stages) ? existingMethod.stages[index] || {} : {};
          const title = text(entry && entry.title, 160) || text(existingStage.title, 160) || `Stage ${index + 1}`;
          return {
            title,
            description: text(entry && entry.description, 2000) || text(existingStage.description, 2000),
            image: text(entry && entry.image, 1000) || text(existingStage.image, 1000),
            alt: text(entry && entry.alt, 300) || text(existingStage.alt, 300) || `${title} visual`,
          };
        }).filter((entry) => entry.title || entry.description || entry.image),
      };
    } else if (key === 'status') {
      if (collection === 'jobs' && value === 'ended') output[key] = 'ended';
      else output[key] = value === 'draft' ? 'draft' : 'published';
    }
    else if (key === 'type' && collection === 'jobs') {
      const raw = text(value == null ? existing.type : value, 40);
      const normalized = raw.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (normalized === 'remote') output[key] = 'Remote';
      else if (normalized === 'hybrid' || normalized === 'hybird') output[key] = 'Hybrid';
      else output[key] = 'Full time';
    }
    else if (key === 'interviewStages') {
      output[key] = normalizeInterviewStages(value != null ? value : existing.interviewStages);
    }
    else if (['body', 'aboutRole', 'keyResponsibilities', 'requiredSkills', 'niceToHave', 'roleOffers'].includes(key)) {
      output[key] = blogPages.sanitizeHtml(String(value == null ? (existing[key] || '') : value).slice(0, 100000));
    }
    else output[key] = text(value, key === 'summary' || key === 'details' ? 5000 : 1000);
  }
  const title = output.title || output.name;
  if (!title) throw Object.assign(new Error('A title or name is required.'), { status: 422 });
  if (fields[collection].includes('href') && !output.href) output.href = automaticHref(collection, title, output.id);
  if (fields[collection].includes('alt') && output.image && !output.alt) {
    if (collection === 'partners') output.alt = `${title} logo`;
    else if (collection === 'team') output.alt = output.role ? `${title}, ${output.role}` : title;
    else output.alt = title;
  }
  output.updatedAt = new Date().toISOString();
  if (collection === 'jobs') stampJobPublishedAt(output, existing);
  return output;
}

/** First time a vacancy becomes published. Never overwrite. Never fill a job that is already published. */
function stampJobPublishedAt(output, existing) {
  if (!output) return;
  const kept = text(existing && existing.publishedAt, 40);
  if (kept) {
    output.publishedAt = kept;
    return;
  }
  if (output.status !== 'published') return;
  if ((existing && existing.status) === 'published') return;
  output.publishedAt = output.updatedAt;
}

function cleanBlogItem(input, existing = {}, id) {
  const title = text(input.title, 1000);
  if (!title) throw Object.assign(new Error('A title or name is required.'), { status: 422 });
  const cluster = text(input.cluster, 120);
  if (cluster && !blogPages.BLOG_CLUSTERS.includes(cluster)) {
    throw Object.assign(new Error('Select a valid blog cluster.'), { status: 422 });
  }
  const faq = Array.isArray(input.faq)
    ? input.faq.slice(0, 20).map((entry) => ({
      question: text(entry && entry.question, 300),
      answer: text(entry && entry.answer, 4000),
    })).filter((entry) => entry.question || entry.answer)
    : [];
  const dataCallouts = Array.isArray(input.dataCallouts)
    ? input.dataCallouts.slice(0, 10).map((entry) => ({
      figure: text(entry && entry.figure, 1000),
      source: text(entry && entry.source, 500),
    })).filter((entry) => entry.figure || entry.source)
    : [];
  for (const entry of dataCallouts) {
    if ((entry.figure && !entry.source) || (!entry.figure && entry.source)) {
      throw Object.assign(new Error('Each data callout needs both figure and source.'), { status: 422 });
    }
  }
  let comparisonTable = null;
  if (input.comparisonTable && typeof input.comparisonTable === 'object') {
    const columns = Array.isArray(input.comparisonTable.columns)
      ? input.comparisonTable.columns.map((col) => text(col, 120)).filter(Boolean).slice(0, 8)
      : [];
    const rows = Array.isArray(input.comparisonTable.rows)
      ? input.comparisonTable.rows.slice(0, 40).map((row) => (
        Array.isArray(row) ? row.map((cell) => text(cell, 500)).slice(0, columns.length || 8) : []
      )).filter((row) => row.some(Boolean))
      : [];
    if (columns.length && rows.length) comparisonTable = { columns, rows };
  }
  const relatedPosts = Array.isArray(input.relatedPosts)
    ? input.relatedPosts.map((value) => text(value, 120)).filter(Boolean).slice(0, 3)
    : [];
  const body = blogPages.sanitizeHtml(String(input.body == null ? (existing.body || '') : input.body).slice(0, 200000));
  const answerBlock = text(input.answerBlock, 2000);
  const { toc } = blogPages.extractTocAndBody(body);
  const now = new Date().toISOString();
  const status = input.status === 'draft' ? 'draft' : 'published';
  const output = {
    id,
    title,
    summary: text(input.summary, 5000),
    href: text(input.href, 1000) || existing.href || '',
    image: text(input.image, 1000),
    alt: text(input.alt, 300),
    seoTitle: text(input.seoTitle, 200),
    metaDescription: text(input.metaDescription, 400),
    accent: text(input.accent, 40) === 'orange' ? 'orange' : 'blue',
    status,
    featured: Boolean(input.featured),
    order: Math.max(0, Number(input.order) || 0),
    cluster,
    answerBlock,
    body,
    faq,
    dataCallouts,
    relatedPosts,
    comparisonTable,
    tableOfContents: toc,
    datePublished: existing.datePublished || (status === 'published' ? blogPages.dateOnly(now) : text(input.datePublished, 40)),
    dateModified: blogPages.dateOnly(now),
    updatedAt: now,
  };
  if (!output.href) output.href = automaticHref('blogs', title, output.id);
  if (status === 'published' && !output.datePublished) output.datePublished = blogPages.dateOnly(now);
  output.readTime = blogPages.computeReadTime(output);
  const taxonomy = blogPages.categoryFromCluster(cluster);
  output.category = taxonomy.category;
  output.categoryLabel = taxonomy.categoryLabel;
  if (output.image && !output.alt) {
    throw Object.assign(new Error('Add an accessible image description for the cover image.'), { status: 422 });
  }

  const warnings = blogPages.blogWarnings(output);
  if (status === 'published' && blogValidationMode() === 'enforce' && warnings.length) {
    throw Object.assign(new Error(`Blog publish blocked: ${warnings.join('; ')}`), { status: 422, warnings });
  }
  output._warnings = warnings;
  return output;
}

function finalizeBlogItem(item) {
  const warnings = item && item._warnings ? item._warnings.slice() : [];
  if (item) delete item._warnings;
  return warnings;
}

function cleanPage(input, existing = {}) {
  const allowed = ['label', 'title', 'lead', 'sectionTitle', 'sectionLead', 'seoTitle'];
  const output = allowed.reduce((out, key) => {
    out[key] = text(input[key], key === 'lead' || key === 'sectionLead' ? 5000 : 1000);
    return out;
  }, {});
  const historySource = input && input.history && typeof input.history === 'object'
    ? input.history
    : (existing && existing.history && typeof existing.history === 'object' ? existing.history : null);
  if (historySource) {
    const milestonesRaw = Array.isArray(historySource.milestones) ? historySource.milestones : [];
    output.history = {
      label: text(historySource.label, 120) || 'Since 2019',
      title: text(historySource.title, 200) || 'Our History',
      lead: text(historySource.lead, 2000),
      milestones: milestonesRaw.slice(0, 16).map((entry, index) => {
        const year = text(entry && entry.year, 40) || String(2019 + index);
        return {
          year,
          text: text(entry && entry.text, 500),
          image: text(entry && entry.image, 1000),
          alt: text(entry && entry.alt, 300) || `${year} milestone`,
        };
      }).filter((entry) => entry.year || entry.text || entry.image),
    };
  }
  const socialSource = input && input.social && typeof input.social === 'object'
    ? input.social
    : (existing && existing.social && typeof existing.social === 'object' ? existing.social : null);
  if (socialSource) {
    const cleanSocialUrl = (value) => {
      const raw = text(value, 500);
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      return '';
    };
    output.social = {
      linkedin: cleanSocialUrl(socialSource.linkedin),
      facebook: cleanSocialUrl(socialSource.facebook),
      instagram: cleanSocialUrl(socialSource.instagram),
      tiktok: cleanSocialUrl(socialSource.tiktok),
    };
  }
  const numbersSource = input && input.numbers && typeof input.numbers === 'object'
    ? input.numbers
    : (existing && existing.numbers && typeof existing.numbers === 'object' ? existing.numbers : null);
  if (numbersSource) {
    const statsRaw = Array.isArray(numbersSource.stats) ? numbersSource.stats : [];
    output.numbers = {
      label: text(numbersSource.label, 120) || 'By the Numbers',
      title: text(numbersSource.title, 200) || 'Proven at enterprise scale.',
      lead: text(numbersSource.lead, 2000),
      stats: statsRaw.slice(0, 6).map((entry) => {
        const valueRaw = text(entry && entry.value, 12).replace(/[^\d]/g, '');
        const value = valueRaw || '0';
        const suffix = text(entry && entry.suffix, 8).replace(/[^\p{L}\p{N}+%]/gu, '').slice(0, 4);
        return {
          value,
          suffix,
          label: text(entry && entry.label, 300),
        };
      }).filter((entry) => entry.label || entry.value !== '0' || entry.suffix),
    };
  }
  return output;
}

function addAudit(data, action, label, by) {
  const event = {
    id: `audit-${crypto.randomUUID()}`,
    action,
    label: text(label, 200),
    at: new Date().toISOString(),
    by,
  };
  data.meta.audit = [event, ...(data.meta.audit || [])].slice(0, 50);
  data.meta.updatedAt = event.at;
  data.meta.updatedBy = by;
  data.meta.revision = Number(data.meta.revision || 0) + 1;
  return event;
}

function checkRevision(req, res, data) {
  const expected = req.headers['if-match'];
  if (expected && Number(expected) !== Number(data.meta.revision)) {
    json(res, 409, {
      error: 'REVISION_CONFLICT',
      message: 'Content changed in another session. Refresh before saving again.',
      revision: data.meta.revision,
    });
    return false;
  }
  return true;
}

function clientAddress(req) {
  return String(req.socket.remoteAddress || 'local');
}

function canSubmitApplication(req) {
  const ip = clientAddress(req);
  const now = Date.now();
  const state = applicationAttempts.get(ip) || { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 60 * 60 * 1000;
  }
  state.count += 1;
  applicationAttempts.set(ip, state);
  return state.count <= 8;
}

function canSubmitContact(req) {
  const ip = clientAddress(req);
  const now = Date.now();
  const state = contactAttempts.get(ip) || { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 60 * 60 * 1000;
  }
  state.count += 1;
  contactAttempts.set(ip, state);
  return state.count <= 10;
}

/** Same sliding window pattern as applications/contact; key = IP + username. Limit 8 / hour. */
function canAttemptLogin(req, username) {
  const ip = clientAddress(req);
  const key = `${ip}\0${String(username || '').trim().toLowerCase()}`;
  const now = Date.now();
  const state = loginAttempts.get(key) || { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 60 * 60 * 1000;
  }
  state.count += 1;
  loginAttempts.set(key, state);
  return state.count <= 8;
}

function incrementHourlyLimit(store, ip) {
  const now = Date.now();
  const state = store.get(ip) || { count: 0, resetAt: now + 60 * 60 * 1000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 60 * 60 * 1000;
  }
  state.count += 1;
  store.set(ip, state);
  return state.count <= 8;
}

/** Same window as login. Key is IP only — the token itself must not become a limiter key. */
function canAttemptBookingLookup(req) {
  return incrementHourlyLimit(bookingLookupAttempts, clientAddress(req));
}

function canAttemptBookingBook(req) {
  return incrementHourlyLimit(bookingBookAttempts, clientAddress(req));
}

function publicBookingSlotView(slot) {
  const when = new Date(slot.startsAt);
  const day = mail.zonedYmd(when);
  const time = mail.zonedHm(when);
  return {
    id: slot.id,
    startsAt: slot.startsAt,
    day,
    time: time.label || `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`,
  };
}

function publicBookingOpenPayload(application, round, invitation, listed) {
  return {
    state: 'open',
    role: application.role || '',
    stage: round.label || 'Interview',
    interviewerName: round.interviewer || '',
    interviewerTitle: round.interviewerTitle || '',
    expiresAt: invitation.expiresAt,
    window: listed.window,
    slots: (listed.slots || []).map(publicBookingSlotView),
  };
}

function publicBookingBookedPayload(application, round, invitation, listed) {
  const used = Number(invitation && invitation.rescheduleCount) || 0;
  const remaining = Math.max(0, hiringDb.MAX_BOOKING_RESCHEDULES - used);
  const canReschedule = remaining > 0;
  const payload = {
    state: 'booked',
    role: application.role || '',
    stage: round.label || 'Interview',
    interviewerName: round.interviewer || '',
    interviewerTitle: round.interviewerTitle || '',
    when: round.scheduledAt || '',
    format: round.format || 'online',
    rescheduleCount: used,
    reschedulesRemaining: remaining,
    canReschedule,
  };
  if (canReschedule && listed) {
    payload.window = listed.window;
    payload.slots = (listed.slots || []).map(publicBookingSlotView);
  }
  if (!canReschedule) {
    payload.message = "You've already rescheduled three times. Reply to the invitation email and our HR team will help you find a new time.";
  }
  return payload;
}

async function publicBookingStatePayload(application, round, invitation) {
  if (invitation.status === 'booked') {
    const used = Number(invitation.rescheduleCount) || 0;
    const listed = used < hiringDb.MAX_BOOKING_RESCHEDULES
      ? await hiringDb.listOpenSlotsInBookingWindow(invitation.interviewerUserId)
      : null;
    return publicBookingBookedPayload(application, round, invitation, listed);
  }
  const listed = await hiringDb.listOpenSlotsInBookingWindow(invitation.interviewerUserId);
  return publicBookingOpenPayload(application, round, invitation, listed);
}

async function loadInvitationRound(invitation) {
  if (!invitation) return { application: null, round: null };
  const application = (await readApplications()).applications.find((entry) => entry.id === invitation.applicationId);
  const round = application && application.pipeline && Array.isArray(application.pipeline.interviews)
    ? application.pipeline.interviews.find((entry) => String(entry && entry.id || '') === String(invitation.roundId))
    : null;
  return { application, round };
}

function cleanContactRequest(input) {
  const situation = text(input.situation, 40).toLowerCase();
  const name = text(input.name, 120);
  const organization = text(input.org || input.organization, 160);
  const role = text(input.role, 120);
  const email = text(input.email, 160).toLowerCase();
  const message = text(input.message, 4000);
  if (!CONTACT_SITUATIONS[situation]) throw Object.assign(new Error('Please select what you are looking for.'), { status: 422 });
  if (!name || !organization || !email || !message) throw Object.assign(new Error('Please complete all required fields.'), { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 422 });
  if (message.length < 10) throw Object.assign(new Error('Please share a bit more detail in your message.'), { status: 422 });

  const now = new Date().toISOString();
  const requestUuid = crypto.randomUUID();
  return {
    id: `contact-${requestUuid}`,
    reference: requestUuid.slice(0, 8).toUpperCase(),
    situation,
    situationLabel: CONTACT_SITUATIONS[situation],
    name,
    organization,
    role,
    email,
    message,
    status: 'new',
    submittedAt: now,
    updatedAt: now,
  };
}

function cleanApplication(input, file) {
  const fullName = text(input.fullName, 120);
  const phone = text(input.phone, 40);
  const email = text(input.email, 160).toLowerCase();
  const roleSlug = text(input.roleSlug, 120).toLowerCase();
  const currentSalary = text(input.currentSalary, 30);
  const yearsOfExperience = text(input.yearsOfExperience, 30);
  const expectedSalary = text(input.expectedSalary, 30);
  const noticePeriodWeeks = text(input.noticePeriodWeeks, 3);
  const linkedin = text(input.linkedin, 500);
  const required = [fullName, phone, email, currentSalary, yearsOfExperience, expectedSalary, noticePeriodWeeks, linkedin];
  if (required.some((value) => !value)) throw Object.assign(new Error('Please complete all required fields.'), { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 422 });
  if (phone.length < 7) throw Object.assign(new Error('Enter a valid phone number.'), { status: 422 });
  if (!/^\d+(?:\.\d+)?$/.test(currentSalary) || !/^\d+(?:\.\d+)?$/.test(expectedSalary)) {
    throw Object.assign(new Error('Salary values must be numbers.'), { status: 422 });
  }
  if (!/^\d+$/.test(noticePeriodWeeks) || Number(noticePeriodWeeks) > 52) {
    throw Object.assign(new Error('Notice period must be between 0 and 52 weeks.'), { status: 422 });
  }
  let linkedinUrl;
  try {
    linkedinUrl = new URL(linkedin);
  } catch (_) {
    throw Object.assign(new Error('Enter a valid LinkedIn URL.'), { status: 422 });
  }
  if (!['http:', 'https:'].includes(linkedinUrl.protocol)) throw Object.assign(new Error('Enter a valid LinkedIn URL.'), { status: 422 });

  const data = readData();
  const jobs = publicView(data).collections.jobs || [];
  let role = 'General application';
  if (roleSlug) {
    const job = jobs.find((item) => path.basename(String(item.href || ''), path.extname(String(item.href || ''))) === roleSlug);
    if (!job) throw Object.assign(new Error('This job is no longer accepting applications.'), { status: 422 });
    role = job.title;
  }

  if (!file || !file.buffer || !file.buffer.length) throw Object.assign(new Error('Please attach your CV.'), { status: 422 });
  if (file.buffer.length > MAX_RESUME_BYTES) throw Object.assign(new Error('CV must be 5 MB or smaller.'), { status: 413 });
  const ext = path.extname(file.name || '').toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(ext)) throw Object.assign(new Error('CV must be a PDF or Word document.'), { status: 422 });

  const contentTypeByExt = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  const now = new Date().toISOString();
  const applicationUuid = crypto.randomUUID();
  const id = `application-${applicationUuid}`;
  const resumeName = path.basename(file.name);
  return {
    application: {
      id,
      reference: applicationUuid.slice(0, 8).toUpperCase(),
      role,
      roleSlug,
      fullName,
      phone,
      email,
      currentSalary,
      yearsOfExperience,
      expectedSalary,
      noticePeriodWeeks: Number(noticePeriodWeeks),
      linkedin: linkedinUrl.toString(),
      resumeName,
      resumeFile: '',
      status: 'new',
      submittedAt: now,
      updatedAt: now,
    },
    resume: {
      buffer: file.buffer,
      fileName: resumeName,
      contentType: contentTypeByExt[ext] || 'application/octet-stream',
    },
  };
}

function applicationDownloadName(value) {
  return path.basename(String(value || 'resume')).replace(/[\r\n"\\]/g, '_');
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/content' && req.method === 'GET') {
    return json(res, 200, publicView(readData()));
  }

  if (pathname === '/api/careers/applications' && req.method === 'POST') {
    if (!canSubmitApplication(req)) return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many applications were submitted. Please try again later.' });
    const body = await readRawBody(req, MAX_APPLICATION_BYTES);
    const multipart = parseMultipart(req, body);
    if (text(multipart.fields.website, 200)) return json(res, 201, { ok: true, reference: 'received' });
    const result = cleanApplication(multipart.fields, multipart.files.resume);
    await hiringDb.insertApplicationWithResume(result.application, result.resume);
    return json(res, 201, { ok: true, reference: result.application.reference });
  }

  if (pathname === '/api/contact/requests' && req.method === 'POST') {
    if (!canSubmitContact(req)) return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many messages were submitted. Please try again later.' });
    const body = await readBody(req);
    if (text(body.website, 200)) return json(res, 201, { ok: true, reference: 'received' });
    const request = cleanContactRequest(body);
    const data = readContactRequests();
    data.requests.unshift(request);
    writeContactRequests(data);
    return json(res, 201, { ok: true, reference: request.reference });
  }

  /* Lets the setup screen label itself with the right role before the password
     is chosen. The token travels in the body, never a query string, so it does
     not reach access logs or Referer headers. Reveals only the role. */
  if (pathname === '/api/admin/auth/invite-info' && req.method === 'POST') {
    const body = await readBody(req);
    const users = await readUsers();
    const account = findUserByInviteToken(users.users, text(body.token, 200));
    if (!account || !account.active || !account.inviteExpiresAt || Date.parse(account.inviteExpiresAt) < Date.now()) {
      return json(res, 400, { error: 'INVALID_INVITE', message: 'This invite link is invalid or has expired.' });
    }
    return json(res, 200, { role: account.role, roleLabel: mail.roleLabel(account.role) });
  }

  if (pathname === '/api/admin/auth/setup-password' && req.method === 'POST') {
    const body = await readBody(req);
    const rawToken = text(body.token, 200);
    const password = validatePassword(body.password, true);
    if (body.passwordConfirm != null && String(body.passwordConfirm) !== password) {
      return json(res, 422, { error: 'PASSWORD_MISMATCH', message: 'Password confirmation does not match.' });
    }
    const users = await readUsers();
    const account = findUserByInviteToken(users.users, rawToken);
    if (!account || !account.active) {
      return json(res, 400, { error: 'INVALID_INVITE', message: 'This invite link is invalid or has already been used.' });
    }
    if (!account.inviteExpiresAt || Date.parse(account.inviteExpiresAt) < Date.now()) {
      return json(res, 400, { error: 'INVITE_EXPIRED', message: 'This invite link has expired. Ask an administrator for a new one.' });
    }
    account.passwordHash = passwordHash(password);
    clearInvite(account);
    account.updatedAt = new Date().toISOString();
    await writeUsers(users);
    return json(res, 200, { ok: true, username: account.username, message: 'Password saved. You can sign in now.' });
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await readBody(req);
    const username = text(body.username, 40).toLowerCase();
    if (!canAttemptLogin(req, username)) {
      return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' });
    }
    let users;
    try {
      users = await readUsers();
    } catch (error) {
      console.error('[auth] Login store unavailable:', error.message || error);
      return json(res, 503, {
        error: 'AUTH_STORE_UNAVAILABLE',
        message: 'Sign-in is temporarily unavailable because the account database could not be reached. Try again shortly.',
      });
    }
    const account = users.users.find((user) => user.username === username);
    if (!account || !account.active || !account.passwordHash || account.mustSetPassword) {
      return json(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect.' });
    }
    if (!verifyPassword(body.password || '', account.passwordHash)) {
      return json(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect.' });
    }
    // Re-read before write so concurrent HR account creates are not wiped by login.
    let latest;
    try {
      latest = await mutateUsers((store) => {
        const current = store.users.find((user) => user.id === account.id);
        if (current) current.lastLoginAt = new Date().toISOString();
        return current || account;
      });
    } catch (error) {
      console.error('[auth] Login store write failed:', error.message || error);
      return json(res, 503, {
        error: 'AUTH_STORE_UNAVAILABLE',
        message: 'Sign-in is temporarily unavailable because the account database could not be reached. Try again shortly.',
      });
    }
    const signedIn = latest && latest.id ? latest : account;
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { userId: signedIn.id, csrf, expiresAt: Date.now() + SESSION_TTL });
    return json(
      res,
      200,
      { authenticated: true, user: safeUser(signedIn), permissions: permissionsFor(signedIn.role), csrf },
      { 'Set-Cookie': sessionCookieHeader(token, SESSION_TTL / 1000, req) }
    );
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    const session = await getSession(req);
    return json(res, 200, session
      ? { authenticated: true, user: safeUser(session), permissions: permissionsFor(session.role), csrf: session.csrf }
      : { authenticated: false });
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    sessions.delete(session.token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookieHeader('', 0, req) });
  }

  /* Token in the body, never a query string. Expired, cancelled-link, tampered,
     and never-existed all write the same precomputed buffer — no status or
     message variation an attacker can use to tell them apart. A holder of a
     real token whose round is no longer pending gets 409 ROUND_NOT_PENDING
     instead: they had a valid link and the round changed. Booked is a 200
     while the round is still pending. */
  if (pathname === '/api/booking/lookup' && req.method === 'POST') {
    if (!canAttemptBookingLookup(req)) {
      return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' });
    }
    const body = await readBody(req);
    const rawToken = text(body && body.token, 200);
    const tokenHash = hashInviteToken(rawToken);
    let invitation = null;
    try {
      invitation = tokenHash ? await hiringDb.findBookingInvitationByTokenHash(tokenHash) : null;
    } catch (_) {
      invitation = null;
    }
    const now = Date.now();
    const expiresAt = invitation && invitation.expiresAt ? Date.parse(invitation.expiresAt) : NaN;
    const expired = invitation && (invitation.status === 'expired' || (!Number.isNaN(expiresAt) && expiresAt < now));
    if (!invitation) {
      return sendBookingLookupInvalid(res);
    }
    const { application, round } = await loadInvitationRound(invitation);
    if (!application || !round) {
      return sendBookingLookupInvalid(res);
    }
    if (String(round.result || 'pending') !== 'pending') {
      return json(res, 409, {
        error: 'ROUND_NOT_PENDING',
        message: hiringDb.ROUND_NOT_PENDING_MESSAGE,
      });
    }
    if (invitation.status === 'cancelled') {
      return sendBookingLookupInvalid(res);
    }
    if (invitation.status === 'booked') {
      return json(res, 200, await publicBookingStatePayload(application, round, invitation));
    }
    if (invitation.status !== 'sent' || expired) {
      return sendBookingLookupInvalid(res);
    }
    return json(res, 200, await publicBookingStatePayload(application, round, invitation));
  }

  if (pathname === '/api/booking/book' && req.method === 'POST') {
    if (!canAttemptBookingBook(req)) {
      return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' });
    }
    const body = await readBody(req);
    const rawToken = text(body && body.token, 200);
    const slotId = text(body && body.slotId, 80);
    const tokenHash = hashInviteToken(rawToken);
    if (!tokenHash || !slotId) {
      return sendBookingLookupInvalid(res);
    }
    let result;
    try {
      result = await hiringDb.bookOpenSlotForInvitation({ tokenHash, slotId });
    } catch (error) {
      if (error && error.code === 'BOOKING_INVALID') {
        return sendBookingLookupInvalid(res);
      }
      if (error && (error.code === 'SLOT_TAKEN' || error.code === 'ROUND_ALREADY_SCHEDULED' || error.code === 'RESCHEDULE_LIMIT' || error.code === 'ROUND_NOT_PENDING')) {
        return json(res, error.status || 409, {
          error: error.code,
          message: error.message || 'That time was just taken. Please choose another.',
        });
      }
      throw error;
    }
    const { application, round } = await loadInvitationRound(result.invitation);
    if (!application || !round) {
      return sendBookingLookupInvalid(res);
    }
    if (!result.alreadyBooked) {
      await notifyInterviewSchedules(application, [{ round, rescheduled: Boolean(result.rescheduled) }], req);
    }
    return json(res, 200, await publicBookingStatePayload(application, round, result.invitation));
  }

  if (!pathname.startsWith('/api/admin/')) return json(res, 404, { error: 'NOT_FOUND' });

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    if (!(await requireAdmin(req, res))) return;
    const users = await readUsers();
    return json(res, 200, { updatedAt: users.updatedAt, users: users.users.map(safeUser) });
  }

  if (pathname === '/api/admin/auth/change-password' && req.method === 'POST') {
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || '');
    const password = validatePassword(body.password, true);
    if (body.passwordConfirm != null && String(body.passwordConfirm) !== password) {
      return json(res, 422, { error: 'PASSWORD_MISMATCH', message: 'Password confirmation does not match.' });
    }
    if (currentPassword === password) {
      return json(res, 422, { error: 'PASSWORD_UNCHANGED', message: 'Choose a new password that is different from the current one.' });
    }
    const users = await readUsers();
    const account = users.users.find((user) => user.id === session.userId);
    if (!account || !account.active || !account.passwordHash || !verifyPassword(currentPassword, account.passwordHash)) {
      return json(res, 403, { error: 'INVALID_PASSWORD', message: 'Current password is incorrect.' });
    }
    account.passwordHash = passwordHash(password);
    clearInvite(account);
    account.updatedAt = new Date().toISOString();
    /* A password change signs the account out everywhere else — matching what
       delete, deactivate and an admin-set password already do. The caller's own
       session is kept: they authenticated with the current password moments ago,
       and bouncing someone to the login screen for changing their own password
       is the behaviour people expect from every other product. */
    let revoked = 0;
    for (const [token, activeSession] of sessions.entries()) {
      if (activeSession.userId === account.id && token !== session.token) {
        sessions.delete(token);
        revoked += 1;
      }
    }
    await writeUsers(users);
    return json(res, 200, {
      ok: true,
      revokedOtherSessions: revoked,
      message: revoked
        ? `Password updated. Signed out of ${revoked} other ${revoked === 1 ? 'session' : 'sessions'}.`
        : 'Password updated.',
    });
  }

  if (pathname === '/api/admin/users' && req.method === 'POST') {
    const session = await requireAdmin(req, res, true);
    if (!session) return;
    const body = await readBody(req);
    try {
      const { account, users, invite } = await createManagedAccount(body);
      return json(res, 201, {
        user: safeUser(account),
        users: users.users.map(safeUser),
        ...(await inviteResponsePart(account, invite, req)),
      });
    } catch (error) {
      return json(res, error.status || 422, { error: error.code || 'ACCOUNT_INVALID', message: error.message || 'Could not create the account.' });
    }
  }

  if (pathname.startsWith('/api/admin/users/') && ['PUT', 'DELETE'].includes(req.method)) {
    const session = await requireAdmin(req, res, true);
    if (!session) return;
    const id = pathname.split('/').pop();
    const users = await readUsers();
    const index = users.users.findIndex((user) => user.id === id);
    if (index < 0) return json(res, 404, { error: 'USER_NOT_FOUND', message: 'Account not found.' });
    const account = users.users[index];
    if (account.role === 'admin') {
      return json(res, 403, { error: 'PROTECTED_ACCOUNT', message: 'The primary administrator account cannot be changed here.' });
    }

    if (req.method === 'DELETE') {
      users.users.splice(index, 1);
      for (const [token, activeSession] of sessions.entries()) {
        if (activeSession.userId === account.id) sessions.delete(token);
      }
      await hiringDb.hardDeleteAdminUser(account.id);
      const remaining = await readUsers();
      return json(res, 200, { users: remaining.users.map(safeUser) });
    }

    const body = await readBody(req);
    const username = cleanUsername(body.username);
    const email = cleanWorkEmail(body.email);
    const jobTitle = cleanJobTitle(body.jobTitle);
    const photo = cleanPhotoPath(body.photo);
    const name = text(body.name, 100) || username;
    if (users.users.some((user) => user.id !== account.id && user.username === username)) {
      return json(res, 409, { error: 'USERNAME_EXISTS', message: 'This username is already in use.' });
    }
    if (users.users.some((user) => user.id !== account.id && String(user.email || '').toLowerCase() === email)) {
      return json(res, 409, { error: 'EMAIL_EXISTS', message: 'This work email is already in use.' });
    }
    account.username = username;
    account.name = name;
    account.email = email;
    account.jobTitle = jobTitle;
    account.photo = photo;
    account.active = body.active !== false;

    const password = validatePassword(body.password, false);
    if (password) {
      account.passwordHash = passwordHash(password);
      clearInvite(account);
      for (const [token, activeSession] of sessions.entries()) {
        if (activeSession.userId === account.id) sessions.delete(token);
      }
    }

    account.updatedAt = new Date().toISOString();
    if (!account.active) {
      for (const [token, activeSession] of sessions.entries()) {
        if (activeSession.userId === account.id) sessions.delete(token);
      }
    }
    await writeUsers(users);
    return json(res, 200, {
      user: safeUser(account),
      users: (await readUsers()).users.map(safeUser),
    });
  }

  if (pathname === '/api/admin/content' && req.method === 'GET') {
    const session = await requireAuth(req, res);
    if (!session) return;
    return json(res, 200, adminView(readData(), session));
  }

  if (pathname === '/api/admin/content' && req.method === 'PUT') {
    const session = await requireAdmin(req, res, true);
    if (!session) return;
    const current = readData();
    if (!checkRevision(req, res, current)) return;
    const body = await readBody(req);
    if (!body.pages || !body.collections) return json(res, 422, { error: 'INVALID_IMPORT', message: 'The import file has an invalid structure.' });
    const next = { meta: current.meta, pages: {}, collections: {} };
    for (const page of PAGES) next.pages[page] = cleanPage(body.pages[page] || {}, (current.pages && current.pages[page]) || {});
    for (const collection of COLLECTIONS) {
      const items = Array.isArray(body.collections[collection]) ? body.collections[collection] : [];
      next.collections[collection] = items.slice(0, 500).map((item) => {
        const cleaned = cleanItem(collection, item, item);
        finalizeBlogItem(cleaned);
        return cleaned;
      });
    }
    addAudit(next, 'import', 'Imported a complete content backup', session.username);
    writeData(next);
    return json(res, 200, next);
  }

  if (pathname === '/api/admin/applications' && req.method === 'GET') {
    if (!(await requireHr(req, res, false))) return;
    const data = await readApplications();
    await attachBookingInvitations(data.applications || []);
    return json(res, 200, { updatedAt: data.updatedAt, applications: data.applications || [] });
  }

  /* Every round assigned to the signed-in interviewer or HR user, across all
     applications. Admin, marketing, and unknown roles still get 403. */
  if (pathname === '/api/admin/interviewer/rounds' && req.method === 'GET') {
    const session = await requireInterviewer(req, res, false);
    if (!session) return;
    const data = await readApplications();
    const rounds = [];
    for (const application of data.applications || []) {
      for (const round of roundsAssignedTo(application, session.userId)) {
        rounds.push(interviewerRoundView(application, round));
      }
    }
    rounds.sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')));
    return json(res, 200, { updatedAt: data.updatedAt, rounds });
  }

  /* The work queue: everything awaiting this interviewer or HR user. Items
     they have already actioned are omitted — a round with feedback recorded,
     or a task with a decision, leaves the queue. */
  if (pathname === '/api/admin/interviewer/queue' && req.method === 'GET') {
    const session = await requireInterviewer(req, res, false);
    if (!session) return;
    const data = await readApplications();
    const rounds = [];
    const tasks = [];
    for (const application of data.applications || []) {
      for (const round of roundsAssignedTo(application, session.userId)) {
        rounds.push(interviewerRoundView(application, round));
      }
      const task = interviewerTaskView(application, session.userId);
      if (task) tasks.push(task);
    }
    tasks.sort((a, b) => String(a.candidateName || '').localeCompare(String(b.candidateName || '')));
    const buckets = interviewerQueueBuckets(rounds);
    return json(res, 200, {
      generatedAt: new Date().toISOString(),
      staleAfterDays: INTERVIEW_FEEDBACK_STALE_DAYS,
      counts: {
        tasks: tasks.length,
        upcoming: buckets.upcoming.length,
        awaitingFeedback: buckets.awaitingFeedback.length,
        stale: buckets.stale.length,
        recorded: buckets.recorded.length,
        total: tasks.length + buckets.upcoming.length + buckets.awaitingFeedback.length + buckets.stale.length,
      },
      tasks,
      ...buckets,
    });
  }

  /* Task review from the shared queue. Same stored fields as HR's pipeline
     form (decision, reviewedBy, reviewedByUserId, score). Identity comes from
     the session. Does not accept a full pipeline payload. */
  const interviewerTaskMatch = pathname.match(/^\/api\/admin\/interviewer\/candidates\/([^/]+)\/task$/);
  if (interviewerTaskMatch && req.method === 'PUT') {
    const session = await requireInterviewer(req, res, true);
    if (!session) return;
    const id = decodeURIComponent(interviewerTaskMatch[1]);
    const data = await readApplications();
    const application = (data.applications || []).find((entry) => entry.id === id);
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    try {
      const previousStage = application.pipeline && application.pipeline.stage
        ? String(application.pipeline.stage)
        : '';
      application.pipeline = await applyInterviewerTaskReview(application, session, await readBody(req));
      applyApplicationStatus(application, mirrorInboxStatus(application.pipeline));
      application.updatedAt = new Date().toISOString();
      const nextStage = String((application.pipeline && application.pipeline.stage) || '');
      const stageEvents = [];
      if (previousStage !== nextStage && nextStage) {
        stageEvents.push({
          applicationId: application.id,
          fromStage: previousStage || null,
          toStage: nextStage,
          occurredAt: application.updatedAt,
          actor: session.username || 'interviewer',
        });
      }
      await writeApplications(data, { stageEvents });
      return json(res, 200, {
        applicationId: application.id,
        task: {
          decision: application.pipeline.task.decision,
          reviewedBy: application.pipeline.task.reviewedBy,
          reviewedByUserId: application.pipeline.task.reviewedByUserId,
          score: application.pipeline.task.score,
        },
      });
    } catch (error) {
      return json(res, error.status || 500, {
        error: error.code || 'TASK_REVIEW_INVALID',
        message: error.message || 'Could not record the task review.',
      });
    }
  }

  /* Interview feedback from the shared queue. Same stored fields as HR's
     interview card (result, score, notes). Identity is who the round is
     assigned to. HR and interviewers both hit this handler — there is no
     second write path. Does not accept a full pipeline payload and does
     not move the candidate forward. */
  const interviewerRoundMatch = pathname.match(/^\/api\/admin\/interviewer\/candidates\/([^/]+)\/rounds\/([^/]+)$/);
  if (interviewerRoundMatch && req.method === 'PUT') {
    const session = await requireInterviewer(req, res, true);
    if (!session) return;
    const applicationId = decodeURIComponent(interviewerRoundMatch[1]);
    const roundId = decodeURIComponent(interviewerRoundMatch[2]);
    const data = await readApplications();
    const application = (data.applications || []).find((entry) => entry.id === applicationId);
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    try {
      application.pipeline = await applyInterviewerRoundFeedback(application, session, roundId, await readBody(req));
      application.updatedAt = new Date().toISOString();
      await writeApplications(data);
      const round = (application.pipeline.interviews || []).find((entry) => String(entry && entry.id || '') === String(roundId));
      return json(res, 200, {
        applicationId: application.id,
        roundId,
        feedback: {
          result: round.result,
          score: round.score,
          notes: round.notes || '',
        },
      });
    } catch (error) {
      return json(res, error.status || 500, {
        error: error.code || 'ROUND_FEEDBACK_INVALID',
        message: error.message || 'Could not record the interview feedback.',
      });
    }
  }

  /* One candidate, for the signed-in interviewer or HR user assigned to at
     least one of their rounds or the task. Anyone else gets 403, not 404,
     because the record does exist. */
  const interviewerCandidateMatch = pathname.match(/^\/api\/admin\/interviewer\/candidates\/([^/]+)$/);
  if (interviewerCandidateMatch && req.method === 'GET') {
    const session = await requireInterviewer(req, res, false);
    if (!session) return;
    const id = decodeURIComponent(interviewerCandidateMatch[1]);
    const application = (await readApplications()).applications.find((entry) => entry.id === id);
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    if (!interviewerHasAccess(application, session.userId)) {
      return json(res, 403, { error: 'FORBIDDEN', message: 'You are not assigned to this candidate.' });
    }
    return json(res, 200, { candidate: interviewerCandidateView(application, session.userId) });
  }

  /* Own availability only. user_id always comes from the session — never from
     the query string or body — so one account cannot list or edit another. */
  if (pathname === '/api/admin/interviewer/availability' && req.method === 'GET') {
    const session = await requireOwnAvailability(req, res, false);
    if (!session) return;
    try {
      const extended = await hiringDb.extendRecurringSeries(session.userId);
      const slots = await hiringDb.listSlotsForUser(session.userId);
      return json(res, 200, {
        timezone: hiringDb.availabilityTimeZone(),
        horizonDays: hiringDb.RECURRING_HORIZON_DAYS,
        displayWindowDays: 14,
        extended: extended.length,
        slots,
      });
    } catch (error) {
      return json(res, error.status || 500, {
        error: error.code || 'AVAILABILITY_READ_FAILED',
        message: error.message || 'Could not load availability.',
      });
    }
  }

  if (pathname === '/api/admin/interviewer/availability' && req.method === 'POST') {
    const session = await requireOwnAvailability(req, res, true);
    if (!session) return;
    const body = await readBody(req);
    try {
      const startsAt = hiringDb.zonedLocalToUtc(body.date, body.startTime);
      if (startsAt.getTime() <= Date.now()) {
        return json(res, 422, { error: 'SLOT_IN_PAST', message: 'Pick a start time in the future.' });
      }
      const repeatWeekly = body.repeatWeekly === true || body.repeatWeekly === 'true';
      const starts = repeatWeekly ? hiringDb.weeklyStartsFrom(startsAt) : [startsAt];
      const created = await hiringDb.insertSlotRows(session.userId, starts, { fromRecurring: repeatWeekly });
      return json(res, 201, { slots: created, created: created.length, repeatWeekly });
    } catch (error) {
      const overlap = error.overlap;
      const message = error.code === 'SLOT_OVERLAP' && overlap
        ? `That time overlaps an existing slot on ${formatAvailabilityWhen(overlap.startsAt)}.`
        : (error.message || 'Could not add the slot.');
      return json(res, error.status || 422, {
        error: error.code || 'SLOT_INVALID',
        message,
        overlap: overlap ? { id: overlap.id, startsAt: overlap.startsAt, endsAt: overlap.endsAt } : undefined,
      });
    }
  }

  const availabilitySlotMatch = pathname.match(/^\/api\/admin\/interviewer\/availability\/([^/]+)$/);
  if (availabilitySlotMatch && req.method === 'DELETE') {
    const session = await requireOwnAvailability(req, res, true);
    if (!session) return;
    const slotId = decodeURIComponent(availabilitySlotMatch[1]);
    try {
      const result = await hiringDb.cancelOrDeleteSlotForUser(slotId, session.userId);
      if (!result.slot) {
        return json(res, 404, { error: 'SLOT_NOT_FOUND', message: 'Slot not found.' });
      }
      return json(res, 200, { ok: true, action: result.action });
    } catch (error) {
      if (error.code === 'SLOT_BOOKED' && error.slot) {
        const who = error.slot.candidateName || 'a candidate';
        const when = formatAvailabilityWhen(error.slot.startsAt);
        return json(res, 409, {
          error: 'SLOT_BOOKED',
          message: `Cannot delete this slot — it is booked with ${who} on ${when}.`,
        });
      }
      return json(res, error.status || 500, {
        error: error.code || 'SLOT_DELETE_FAILED',
        message: error.message || 'Could not delete the slot.',
      });
    }
  }

  if (pathname === '/api/admin/staff-interviewers' && req.method === 'GET') {
    if (!(await requireHr(req, res, false))) return;
    return json(res, 200, { interviewers: await listStaffInterviewers() });
  }

  const staffOpenSlotsMatch = pathname.match(/^\/api\/admin\/staff-interviewers\/([^/]+)\/open-slots$/);
  if (staffOpenSlotsMatch && req.method === 'GET') {
    if (!(await requireHr(req, res, false))) return;
    const userId = decodeURIComponent(staffOpenSlotsMatch[1]);
    const staff = await findStaffInterviewer(userId);
    if (!staff) return json(res, 404, { error: 'NOT_FOUND', message: 'Interviewer not found.' });
    const listed = await hiringDb.listOpenSlotsInBookingWindow(userId);
    return json(res, 200, {
      interviewerUserId: staff.id,
      name: staff.name,
      count: listed.slots.length,
      window: listed.window,
    });
  }

  if (pathname === '/api/admin/interviewers' && req.method === 'GET') {
    if (!(await requireHr(req, res, false))) return;
    const interviewers = await hiringDb.listMergedInterviewersStore();
    return json(res, 200, { interviewers });
  }

  /* Every interviewer now needs a login, so this creates an account (role
     interviewer) and issues an invite. Bare dbo.interviewers rows are no longer
     created; the table remains a read-only fallback for legacy data. */
  if (pathname === '/api/admin/interviewers' && req.method === 'POST') {
    if (!(await requireHr(req, res, true))) return;
    const body = await readBody(req);
    try {
      const { account, invite } = await createManagedAccount(body, { role: 'interviewer' });
      return json(res, 201, {
        interviewer: interviewerPublicView({
          id: account.id,
          name: account.name,
          title: account.jobTitle || '',
          email: account.email,
          interviewStages: account.interviewStages,
          active: account.active,
          source: 'account',
          readOnly: true,
        }),
        interviewers: await hiringDb.listMergedInterviewersStore(),
        ...(await inviteResponsePart(account, invite, req)),
      });
    } catch (error) {
      return json(res, error.status || 422, { error: error.code || 'INTERVIEWER_INVALID', message: error.message || 'Could not create the interviewer account.' });
    }
  }

  const interviewerMatch = pathname.match(/^\/api\/admin\/interviewers\/([^/]+)$/);

  /* Converts a legacy dbo.interviewers row into a real account with an invite,
     then removes the row. This is the only supported way to give an existing
     manual entry a login. */
  const convertMatch = pathname.match(/^\/api\/admin\/interviewers\/([^/]+)\/convert$/);
  if (convertMatch && req.method === 'POST') {
    if (!(await requireHr(req, res, true))) return;
    const legacyId = decodeURIComponent(convertMatch[1]);
    try {
      const legacy = await hiringDb.getInterviewerById(legacyId);
      if (!legacy) {
        return json(res, 404, { error: 'NOT_FOUND', message: 'No legacy interviewer row with that id.' });
      }
      const body = await readBody(req);
      const { account, invite } = await createManagedAccount({
        name: body.name != null ? body.name : legacy.name,
        username: body.username,
        email: body.email != null ? body.email : legacy.email,
        jobTitle: body.jobTitle != null ? body.jobTitle : legacy.title,
        active: true,
      }, { role: 'interviewer' });
      /* Only drop the row once the account exists, so a failure leaves the
         legacy entry intact and the conversion can be retried. */
      await hiringDb.deleteInterviewerStore(legacyId);
      return json(res, 201, {
        converted: { from: legacyId, to: account.id },
        interviewers: await hiringDb.listMergedInterviewersStore(),
        ...(await inviteResponsePart(account, invite, req)),
      });
    } catch (error) {
      return json(res, error.status || 422, { error: error.code || 'CONVERT_FAILED', message: error.message || 'Could not convert this interviewer.' });
    }
  }

  const interviewerStagesMatch = pathname.match(/^\/api\/admin\/interviewers\/([^/]+)\/stages$/);
  if (interviewerStagesMatch && req.method === 'PATCH') {
    if (!(await requireHr(req, res, true))) return;
    const targetId = decodeURIComponent(interviewerStagesMatch[1]);
    const body = await readBody(req);
    const forbidden = ['name', 'email', 'role', 'active'];
    const extraKeys = Object.keys(body || {}).filter((key) => key !== 'stages');
    if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(body || {}, key)) || extraKeys.length) {
      return json(res, 422, {
        error: 'STAGES_ONLY',
        message: 'This path can only change interview stages. Name, email, role, and active are rejected here.',
      });
    }
    if (!Array.isArray(body && body.stages)) {
      return json(res, 422, { error: 'STAGES_REQUIRED', message: 'Send a stages array. Leave it empty for every stage.' });
    }
    const staff = await hiringDb.resolveStaffInterviewerById(targetId);
    if (!staff || staff.source !== 'account') {
      return json(res, 404, { error: 'NOT_FOUND', message: 'No interviewer or HR account with that id.' });
    }
    const stages = normalizeInterviewerStageSet(body.stages);
    const updated = await hiringDb.updateAdminUserInterviewStages(targetId, stages);
    if (!updated) {
      return json(res, 404, { error: 'NOT_FOUND', message: 'No interviewer or HR account with that id.' });
    }
    return json(res, 200, {
      ok: true,
      interviewer: interviewerPublicView({ ...staff, interviewStages: stages }),
      interviewers: await hiringDb.listMergedInterviewersStore(),
    });
  }

  /* The manual write path is retired: entries are created as accounts and
     edited in User Management. Legacy rows are converted, not edited. */
  if (interviewerMatch && req.method === 'PUT') {
    if (!(await requireHr(req, res, true))) return;
    const targetId = decodeURIComponent(interviewerMatch[1]);
    const account = await hiringDb.resolveStaffInterviewerById(targetId);
    if (account && account.source === 'account') {
      return json(res, 403, {
        error: 'ACCOUNT_READONLY',
        message: 'This interviewer has an account. Change their details in User Management.',
      });
    }
    return json(res, 409, {
      error: 'MANUAL_ENTRY_RETIRED',
      message: 'Manual interviewer entries are no longer editable. Use Convert to account to give this person a login.',
    });
  }

  if (interviewerMatch && req.method === 'DELETE') {
    if (!(await requireHr(req, res, true))) return;
    try {
      const deleted = await hiringDb.deleteInterviewerStore(decodeURIComponent(interviewerMatch[1]));
      if (!deleted) {
        return json(res, 404, { error: 'NOT_FOUND', message: 'Interviewer not found.' });
      }
      return json(res, 200, { ok: true, interviewers: await hiringDb.listMergedInterviewersStore() });
    } catch (error) {
      return json(res, error.status || 500, {
        error: error.code || 'INTERVIEWER_INVALID',
        message: error.message || 'Could not delete interviewer.',
      });
    }
  }

  if (pathname === '/api/admin/onboarding' && req.method === 'GET') {
    const session = await requireOnboarding(req, res, false);
    if (!session) return;
    let data = await readOnboarding();
    if (session.role === 'hr') {
      const sync = await syncJoinedApplicationsIntoOnboarding(session.username);
      data = sync.store;
    }
    let requests = data.requests || [];
    if (session.role === 'marketing') {
      requests = requests.filter((item) => item.status === 'sent' || item.status === 'returned');
    }
    return json(res, 200, { updatedAt: data.updatedAt, requests });
  }

  if (pathname === '/api/admin/onboarding' && req.method === 'POST') {
    const session = await requireOnboarding(req, res, true);
    if (!session) return;
    if (session.role !== 'hr') {
      return json(res, 403, { error: 'FORBIDDEN', message: 'Only HR can start employee onboarding.' });
    }
    const body = await readBody(req);
    const applicationId = text(body.applicationId, 80);
    if (!applicationId) {
      return json(res, 422, { error: 'APPLICATION_REQUIRED', message: 'Select a joined candidate to start onboarding.' });
    }
    const appsData = await readApplications();
    const application = (appsData.applications || []).find((item) => item.id === applicationId);
    if (!application) {
      return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    }
    const offerStatus = String((((application.pipeline || {}).offer || {}).status) || '').toLowerCase();
    if (offerStatus !== 'joined') {
      return json(res, 422, { error: 'NOT_JOINED', message: 'Onboarding can only start for candidates marked as Joined.' });
    }
    const result = await ensureOnboardingDraftForApplication(application, session.username, body);
    return json(res, result.created ? 201 : 200, {
      request: result.request,
      requests: result.store.requests,
      existing: !result.created,
    });
  }

  if (pathname.startsWith('/api/admin/onboarding/') && req.method === 'PUT') {
    const session = await requireOnboarding(req, res, true);
    if (!session) return;
    const id = pathname.split('/').pop();
    const store = await readOnboarding();
    const index = (store.requests || []).findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: 'NOT_FOUND', message: 'Onboarding request not found.' });
    const request = store.requests[index];
    const body = await readBody(req);
    const action = text(body.action || '', 40).toLowerCase();
    const now = new Date().toISOString();

    if (session.role === 'hr') {
      if (action === 'send') {
        if (request.status !== 'draft' && request.status !== 'returned') {
          return json(res, 422, { error: 'INVALID_STATUS', message: 'Only draft or returned requests can be sent to Marketing.' });
        }
        try {
          request.fullName = text(body.fullName != null ? body.fullName : request.fullName, 120);
          request.jobTitle = text(body.jobTitle != null ? body.jobTitle : request.jobTitle, 120);
          request.email = cleanOnboardingEmail(body.email != null ? body.email : request.email, true);
          request.mobile = cleanOnboardingMobile(body.mobile != null ? body.mobile : request.mobile, true);
          request.linkedin = cleanLinkedInUrl(body.linkedin != null ? body.linkedin : request.linkedin);
          request.idNumber = text(body.idNumber != null ? body.idNumber : request.idNumber, 80);
          request.notesHr = text(body.notesHr != null ? body.notesHr : request.notesHr, 2000);
        } catch (error) {
          return json(res, error.status || 422, { error: 'INVALID_PACKAGE', message: error.message });
        }
        if (!request.fullName || !request.jobTitle || !request.email || !request.mobile || !request.linkedin || !request.idNumber) {
          return json(res, 422, { error: 'PACKAGE_INCOMPLETE', message: 'Full name, job title, email, mobile, LinkedIn, and ID number are required before sending.' });
        }
        request.status = 'sent';
        request.sentAt = now;
        request.updatedAt = now;
        await writeOnboarding(store);
        return json(res, 200, { request, requests: store.requests });
      }
      if (action === 'complete') {
        if (request.status !== 'returned') {
          return json(res, 422, { error: 'INVALID_STATUS', message: 'Mark completed only after Marketing returns deliverables.' });
        }
        request.status = 'completed';
        request.completedAt = now;
        request.updatedAt = now;
        await writeOnboarding(store);
        return json(res, 200, { request, requests: store.requests });
      }
      if (request.status !== 'draft') {
        return json(res, 422, { error: 'LOCKED', message: 'Package fields can only be edited while the request is in draft.' });
      }
      try {
        if (body.fullName != null) request.fullName = text(body.fullName, 120);
        if (body.jobTitle != null) request.jobTitle = text(body.jobTitle, 120);
        if (body.email != null) request.email = body.email === '' ? '' : cleanOnboardingEmail(body.email, false);
        if (body.mobile != null) request.mobile = body.mobile === '' ? '' : cleanOnboardingMobile(body.mobile, false);
        if (body.linkedin != null) request.linkedin = body.linkedin === '' ? '' : cleanLinkedInUrl(body.linkedin);
        if (body.idNumber != null) request.idNumber = text(body.idNumber, 80);
        if (body.notesHr != null) request.notesHr = text(body.notesHr, 2000);
      } catch (error) {
        return json(res, error.status || 422, { error: 'INVALID_PACKAGE', message: error.message });
      }
      request.updatedAt = now;
      await writeOnboarding(store);
      return json(res, 200, { request, requests: store.requests });
    }

    // Marketing
    if (request.status !== 'sent' && request.status !== 'returned') {
      return json(res, 422, { error: 'INVALID_STATUS', message: 'Marketing can only update requests that were sent by HR.' });
    }
    if (!request.assets) request.assets = emptyOnboardingAssets();
    try {
      if (body.assets && typeof body.assets === 'object') {
        for (const key of ONBOARDING_ASSET_KEYS) {
          if (body.assets[key] != null) {
            request.assets[key] = cleanOnboardingAssetPath(body.assets[key]);
          }
        }
      }
      if (body.notesMarketing != null) request.notesMarketing = text(body.notesMarketing, 2000);
    } catch (error) {
      return json(res, error.status || 422, { error: 'INVALID_ASSETS', message: error.message });
    }
    if (action === 'return') {
      const missing = ONBOARDING_ASSET_KEYS.filter((key) => !request.assets[key]);
      if (missing.length) {
        return json(res, 422, {
          error: 'ASSETS_INCOMPLETE',
          message: 'Upload all four deliverables before returning to HR.',
        });
      }
      request.status = 'returned';
      request.returnedAt = now;
    }
    request.updatedAt = now;
    await writeOnboarding(store);
    return json(res, 200, { request, requests: store.requests });
  }

  if (pathname === '/api/admin/vacancies/end' && req.method === 'POST') {
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    if (!canEditCollection(session, 'jobs')) {
      return json(res, 403, { error: 'FORBIDDEN', message: 'You do not have permission to end vacancies.' });
    }
    const body = await readBody(req);
    const jobId = text(body.jobId, 120);
    if (!jobId) return json(res, 422, { error: 'MISSING_JOB', message: 'Select a vacancy to end.' });
    const data = readData();
    const jobs = data.collections.jobs || [];
    const job = jobs.find((entry) => entry.id === jobId);
    if (!job) return json(res, 404, { error: 'JOB_NOT_FOUND', message: 'Vacancy not found.' });
    if (job.status !== 'published') {
      return json(res, 422, { error: 'ALREADY_ENDED', message: 'This vacancy is already ended or unpublished.' });
    }

    job.status = 'ended';
    job.endedAt = new Date().toISOString();
    job.updatedAt = job.endedAt;
    addAudit(data, 'update', `Ended vacancy “${job.title || jobId}”`, session.username);
    writeData(data);

    const appsData = await readApplications();
    const activeCount = (appsData.applications || []).filter((application) => {
      if (!applicationMatchesJob(application, job)) return false;
      if (!application.pipeline || typeof application.pipeline !== 'object') return false;
      return !isPipelineClosedRecord(application.pipeline);
    }).length;

    return json(res, 200, {
      content: adminView(data, session),
      applications: appsData.applications || [],
      activeCount,
      job: { id: job.id, title: job.title, status: job.status },
    });
  }

  const applicationMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)(?:\/(resume|pipeline))?$/);
  if (applicationMatch && req.method === 'GET' && applicationMatch[2] === 'resume') {
    /* HR reaches any CV. An interviewer reaches a CV only for a candidate they
       have a round or the task on — checked against the pipeline below, after
       the record is loaded, never from anything the client sent. */
    const session = await requireAuth(req, res);
    if (!session) return;
    if (session.role !== 'hr' && session.role !== 'interviewer') {
      return json(res, 403, { error: 'FORBIDDEN', message: 'Candidate CVs are available to HR and assigned interviewers only.' });
    }
    const id = decodeURIComponent(applicationMatch[1]);
    const application = (await readApplications()).applications.find((entry) => entry.id === id);
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    if (session.role === 'interviewer' && !interviewerHasAccess(application, session.userId)) {
      return json(res, 403, { error: 'FORBIDDEN', message: 'You are not assigned to this candidate.' });
    }
    const resume = await hiringDb.getApplicationResume(id);
    if (!resume) {
      return json(res, 404, { error: 'RESUME_NOT_FOUND', message: 'CV file not found.' });
    }
    const downloadName = applicationDownloadName(resume.fileName || application.resumeName);
    res.writeHead(200, {
      'Content-Type': resume.contentType || 'application/octet-stream',
      'Content-Length': resume.byteSize,
      'Content-Disposition': `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(resume.content);
  }

  if (applicationMatch && req.method === 'PUT' && !applicationMatch[2]) {
    if (!(await requireHr(req, res, true))) return;
    const allowedStatuses = new Set(['new', 'reviewing', 'contacted', 'rejected']);
    const body = await readBody(req);
    const status = text(body.status, 30);
    if (!allowedStatuses.has(status)) return json(res, 422, { error: 'INVALID_STATUS', message: 'Select a valid application status.' });
    const data = await readApplications();
    const application = data.applications.find((entry) => entry.id === decodeURIComponent(applicationMatch[1]));
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    applyApplicationStatus(application, status);
    application.updatedAt = new Date().toISOString();
    await writeApplications(data);
    return json(res, 200, { application });
  }

  if (applicationMatch && req.method === 'DELETE' && !applicationMatch[2]) {
    if (!(await requireHr(req, res, true))) return;
    const session = await getSession(req);
    const id = decodeURIComponent(applicationMatch[1]);
    await hiringDb.hardDeleteApplication(id, session && session.username);
    return json(res, 200, { ok: true });
  }

  if (applicationMatch && req.method === 'PUT' && applicationMatch[2] === 'pipeline') {
    if (!(await requireHr(req, res, true))) return;
    const body = await readBody(req);
    const data = await readApplications();
    const application = data.applications.find((entry) => entry.id === decodeURIComponent(applicationMatch[1]));
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    const session = await getSession(req);
    try {
      const previousPipeline = application.pipeline && typeof application.pipeline === 'object'
        ? application.pipeline
        : null;
      const previousStage = previousPipeline && previousPipeline.stage
        ? String(previousPipeline.stage)
        : '';
      const previousInterviews = previousPipeline && Array.isArray(previousPipeline.interviews)
        ? previousPipeline.interviews.slice()
        : [];
      const nextPipeline = await cleanPipelinePayload(body.pipeline || body, application, session || {});
      const bookingNeeds = detectBookingInvitationNeeds(
        previousInterviews,
        nextPipeline.interviews || [],
        nextPipeline,
      );
      if (bookingNeeds.length && body.acknowledgeEmptySlots !== true) {
        const slotWarnings = await emptyAvailabilityWarnings(bookingNeeds);
        if (slotWarnings.length) {
          return json(res, 409, emptyAvailabilityResponse(slotWarnings));
        }
      }
      application.pipeline = nextPipeline;
      applyApplicationStatus(application, mirrorInboxStatus(application.pipeline));
      application.updatedAt = new Date().toISOString();
      const nextStage = String((application.pipeline && application.pipeline.stage) || '');
      const stageEvents = [];
      if (previousStage !== nextStage && nextStage) {
        stageEvents.push({
          applicationId: application.id,
          fromStage: previousStage || null,
          toStage: nextStage,
          occurredAt: application.updatedAt,
          actor: (session && session.username) || 'hr',
        });
      }
      const scheduleChanges = detectInterviewScheduleChanges(previousInterviews, application.pipeline.interviews || []);
      const slotReleases = detectBookedSlotReleases(previousInterviews, application.pipeline.interviews || []);
      const scheduleIds = new Set(scheduleChanges.map((entry) => String(entry.round && entry.round.id || '')));
      const meetingLinkAdds = detectMeetingLinkAdditions(
        previousInterviews,
        application.pipeline.interviews || [],
      ).filter((entry) => !scheduleIds.has(String(entry.id || '')));
      await writeApplications(data, { stageEvents });
      for (const entry of (application.pipeline.interviews || [])) {
        if (!entry || !entry.id) continue;
        if (String(entry.result || 'pending') === 'pending') continue;
        await hiringDb.cancelSentInvitationsForRound(application.id, entry.id);
      }
      if (slotReleases.length) {
        /* Invitation stays booked. Counter is not incremented. Candidate link still works. */
        await hiringDb.releaseBookedSlotsForRounds(application.id, slotReleases);
      }
      let mailResults = [];
      if (scheduleChanges.length) {
        mailResults = await notifyInterviewSchedules(application, scheduleChanges, req);
      }
      let meetingLinkNotices = [];
      if (meetingLinkAdds.length) {
        meetingLinkNotices = await notifyMeetingLinkAdditions(application, meetingLinkAdds, req);
      }
      let bookingInvites = [];
      if (bookingNeeds.length) {
        bookingInvites = await issueBookingInvitations(application, bookingNeeds, req);
      }
      let onboarding = null;
      if (application.pipeline && application.pipeline.offer && application.pipeline.offer.status === 'joined') {
        const ensured = await ensureOnboardingDraftForApplication(application, session && session.username);
        if (ensured.request) {
          onboarding = {
            request: ensured.request,
            created: ensured.created,
            existing: !ensured.created,
          };
        }
      }
      await attachBookingInvitations([application]);
      return json(res, 200, {
        application,
        onboarding,
        mail: {
          scheduleNotices: mailResults,
          meetingLinkNotices,
          sent: mailResults.filter((entry) => entry.sent).length + meetingLinkNotices.filter((entry) => entry.sent).length,
          failed: mailResults.filter((entry) => !entry.sent && !entry.skipped).length
            + meetingLinkNotices.filter((entry) => !entry.sent && !entry.skipped).length,
          skipped: mailResults.filter((entry) => entry.skipped).length
            + meetingLinkNotices.filter((entry) => entry.skipped).length,
          bookingInvites,
        },
      });
    } catch (error) {
      return json(res, error.status || 500, { error: 'PIPELINE_INVALID', message: error.message || 'Could not update the hiring pipeline.' });
    }
  }

  const bookingInviteMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)\/booking-invitations$/);
  if (bookingInviteMatch && req.method === 'POST') {
    if (!(await requireHr(req, res, true))) return;
    const body = await readBody(req);
    const roundId = text(body && body.roundId, 80);
    if (!roundId) return json(res, 422, { error: 'ROUND_REQUIRED', message: 'Choose the interview round to send a booking link for.' });
    const data = await readApplications();
    const application = data.applications.find((entry) => entry.id === decodeURIComponent(bookingInviteMatch[1]));
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    const pipe = application.pipeline && typeof application.pipeline === 'object' ? application.pipeline : null;
    const round = pipe && Array.isArray(pipe.interviews)
      ? pipe.interviews.find((entry) => String(entry && entry.id || '') === roundId)
      : null;
    if (!round || !round.interviewerUserId) {
      return json(res, 422, { error: 'INTERVIEWER_REQUIRED', message: 'Assign an interviewer before sending a booking link.' });
    }
    if (String(round.scheduledAt || '').trim()) {
      return json(res, 422, { error: 'ALREADY_SCHEDULED', message: 'This round already has a time. Clear it before sending a new booking link.' });
    }
    if (String(round.result || 'pending') !== 'pending') {
      return json(res, 422, {
        error: 'ROUND_NOT_PENDING',
        message: 'Set the round back to Pending before sending a booking link.',
      });
    }
    if (body.acknowledgeEmptySlots !== true) {
      const slotWarnings = await emptyAvailabilityWarnings([round]);
      if (slotWarnings.length) {
        return json(res, 409, emptyAvailabilityResponse(slotWarnings));
      }
    }
    const bookingInvites = await issueBookingInvitations(application, [round], req);
    await attachBookingInvitations([application]);
    return json(res, 200, { application, bookingInvites });
  }

  if (bookingInviteMatch && req.method === 'DELETE') {
    if (!(await requireHr(req, res, true))) return;
    const body = await readBody(req);
    const roundId = text(body && body.roundId, 80);
    if (!roundId) return json(res, 422, { error: 'ROUND_REQUIRED', message: 'Choose the interview round whose booking link to cancel.' });
    const data = await readApplications();
    const application = data.applications.find((entry) => entry.id === decodeURIComponent(bookingInviteMatch[1]));
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    await hiringDb.cancelSentInvitationsForRound(application.id, roundId);
    await attachBookingInvitations([application]);
    return json(res, 200, { application, cancelled: true });
  }

  if (pathname === '/api/admin/contact-requests' && req.method === 'GET') {
    if (!(await requireAdmin(req, res))) return;
    const data = readContactRequests();
    return json(res, 200, { updatedAt: data.updatedAt, requests: data.requests || [] });
  }

  const contactMatch = pathname.match(/^\/api\/admin\/contact-requests\/([^/]+)$/);
  if (contactMatch && req.method === 'PUT') {
    if (!(await requireAdmin(req, res, true))) return;
    const allowedStatuses = new Set(['new', 'reviewing', 'contacted', 'closed']);
    const body = await readBody(req);
    const status = text(body.status, 30);
    if (!allowedStatuses.has(status)) return json(res, 422, { error: 'INVALID_STATUS', message: 'Select a valid request status.' });
    const data = readContactRequests();
    const request = data.requests.find((entry) => entry.id === decodeURIComponent(contactMatch[1]));
    if (!request) return json(res, 404, { error: 'CONTACT_REQUEST_NOT_FOUND', message: 'Contact request not found.' });
    request.status = status;
    request.updatedAt = new Date().toISOString();
    writeContactRequests(data);
    return json(res, 200, { request, requests: data.requests });
  }

  if (pathname.startsWith('/api/admin/pages/') && req.method === 'PUT') {
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    const page = pathname.split('/').pop();
    if (!PAGES.has(page)) return json(res, 404, { error: 'UNKNOWN_PAGE' });
    if (!canEditPage(session, page)) return json(res, 403, { error: 'FORBIDDEN', message: 'Only administrators can edit page content.' });
    const data = readData();
    if (!checkRevision(req, res, data)) return;
    data.pages[page] = cleanPage(await readBody(req), data.pages[page] || {});
    addAudit(data, 'page-update', `Updated ${page} page content`, session.username);
    writeData(data);
    return json(res, 200, adminView(data, session));
  }

  if (pathname === '/api/admin/upload' && req.method === 'POST') {
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    if (!canUploadAssets(session)) {
      return json(res, 403, { error: 'FORBIDDEN', message: 'You do not have permission to upload files.' });
    }
    const body = await readBody(req);
    const dataUrl = String(body.dataUrl || '');
    const pdfMatch = dataUrl.match(/^data:application\/pdf;base64,([a-z0-9+/=]+)$/i);
    const imageMatch = dataUrl.match(/^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/=]+)$/i);
    if (!pdfMatch && !imageMatch) {
      return json(res, 422, { error: 'INVALID_FILE', message: 'Use a PNG, JPG, WEBP, GIF, or PDF file.' });
    }
    const buffer = Buffer.from((pdfMatch ? pdfMatch[1] : imageMatch[2]), 'base64');
    if (!buffer.length) return json(res, 422, { error: 'INVALID_FILE', message: 'The file is empty.' });
    if (buffer.length > 5 * 1024 * 1024) {
      return json(res, 413, { error: 'FILE_TOO_LARGE', message: 'File is over 5 MB. Compress or resize it before uploading.' });
    }
    const base = path.basename(text(body.name || (pdfMatch ? 'document' : 'image'), 100), path.extname(body.name || '')).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || (pdfMatch ? 'document' : 'image');
    let filename;
    let payload;
    if (pdfMatch) {
      filename = `${Date.now()}-${base.toLowerCase()}.pdf`;
      payload = buffer;
    } else {
      filename = `${Date.now()}-${base.toLowerCase()}.webp`;
      try {
        payload = await sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: 1620, height: 1620, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80, effort: 5 })
          .toBuffer();
      } catch (_) {
        return json(res, 422, { error: 'INVALID_IMAGE', message: 'Could not process that image. Try another PNG, JPG, or WEBP file.' });
      }
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), payload);
    const data = readData();
    addAudit(data, 'upload', `Uploaded ${filename}`, session.username);
    writeData(data);
    return json(res, 201, { path: `assets/uploads/${filename}`, revision: data.meta.revision });
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'items') {
    const collection = parts[3];
    const id = parts[4];
    if (!COLLECTIONS.has(collection)) return json(res, 404, { error: 'UNKNOWN_COLLECTION' });
    const session = await requireMutationAuth(req, res);
    if (!session) return;
    if (!canEditCollection(session, collection)) return json(res, 403, { error: 'FORBIDDEN', message: 'You can only manage Careers content.' });
    const data = readData();
    if (!checkRevision(req, res, data)) return;
    const list = data.collections[collection] || (data.collections[collection] = []);

    if (req.method === 'POST' && !id) {
      const item = cleanItem(collection, await readBody(req));
      if (DETAIL_PATHS[collection]) item.href = automaticHref(collection, item.title || item.name, item.id);
      item.href = uniqueHref(item.href, list, item.id);
      if (!item.order) item.order = (Math.max(0, ...list.map((entry) => Number(entry.order || 0))) + 10);
      const warnings = finalizeBlogItem(item);
      list.push(item);
      addAudit(data, 'create', `Created ${item.title || item.name}`, session.username);
      writeData(data);
      return json(res, 201, { ...adminView(data, session), warnings });
    }

    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: 'ITEM_NOT_FOUND' });

    if (req.method === 'PUT') {
      const item = cleanItem(collection, await readBody(req), list[index]);
      const warnings = finalizeBlogItem(item);
      list[index] = item;
      addAudit(data, 'update', `Updated ${item.title || item.name}`, session.username);
      writeData(data);
      return json(res, 200, { ...adminView(data, session), warnings });
    }

    if (req.method === 'DELETE') {
      const [removed] = list.splice(index, 1);
      addAudit(data, 'delete', `Deleted ${removed.title || removed.name}`, session.username);
      writeData(data);
      if (collection === 'jobs') {
        const appsData = await readApplications();
        const activeCount = (appsData.applications || []).filter((application) => {
          if (!applicationMatchesJob(application, removed)) return false;
          if (!application.pipeline || typeof application.pipeline !== 'object') return false;
          return !isPipelineClosedRecord(application.pipeline);
        }).length;
        return json(res, 200, {
          content: adminView(data, session),
          applications: appsData.applications || [],
          activeCount,
        });
      }
      return json(res, 200, adminView(data, session));
    }
  }

  return json(res, 404, { error: 'NOT_FOUND' });
}

function htmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function publicItemHref(collection, item) {
  return item.href || automaticHref(collection, item.title || item.name, item.id);
}

function absolutePublicUrl(relativeUrl) {
  const clean = String(relativeUrl || '').split('#')[0].split('?')[0].replace(/^\/+/, '');
  if (!clean || clean === 'index.html') return `${SITE_URL}/`;
  return new URL(clean, `${SITE_URL}/`).href;
}

// Authoritative sitemap for /sitemap.xml. There is no checked-in sitemap.xml —
// update this fixedPages list (and CMS collections) when public pages change.
function sitemapLastmodFromFile(filePath) {
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function sitemapXml() {
  const data = readData();
  const urls = new Map();
  const fixedPages = [
    'index.html',
    'about-us.html',
    'get-in-touch.html',
    'services/enterprise-software.html',
    'services/data-analytics.html',
    'services/ai-automation.html',
    'services/outsourcing.html',
    'cases/index.html',
    'cases/ministry-planning.html',
    'cases/data-center-transformation.html',
    'cases/nexthink-dex-bank.html',
    'blogs/index.html',
    'blogs/digital-employee-experience.html',
    'blogs/digital-transformation-signs.html',
    'blogs/azure-digital-egypt-2030.html',
    'blogs/enterprise-ai-production.html',
    'blogs/augment-vs-outsource-tech-team.html',
    'partners/index.html',
    'partners/microsoft.html',
    'partners/huawei.html',
    'partners/nexthink.html',
    'partners/efinance.html',
    'partners/vodafone.html',
    'careers/index.html',
    'careers/dotnet-backend-developer.html',
    'careers/data-analyst.html',
    'careers/full-stack-developer.html',
    'news/index.html',
  ];
  fixedPages.forEach((relativePath) => {
    const target = path.join(ROOT, ...relativePath.split('/'));
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return;
    const canonical = relativePath.endsWith('/index.html')
      ? `${SITE_URL}/${relativePath.slice(0, -'index.html'.length)}`
      : absolutePublicUrl(relativePath);
    urls.set(canonical, sitemapLastmodFromFile(target));
  });
  for (const collection of Object.keys(DETAIL_PATHS)) {
    for (const item of data.collections[collection] || []) {
      if (item.status !== 'published') continue;
      const href = publicItemHref(collection, item);
      if (!href || href.includes('#')) continue;
      const relative = String(href).replace(/^\/+/, '').split(/[?#]/)[0];
      const canonical = absolutePublicUrl(relative);
      // Static HTML pages already recorded keep file mtime — do not overwrite with CMS dates.
      if (urls.has(canonical)) continue;
      const target = path.join(ROOT, ...relative.split('/'));
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        urls.set(canonical, sitemapLastmodFromFile(target));
        continue;
      }
      // CMS-generated detail pages only (no on-disk HTML).
      if (item.updatedAt) {
        urls.set(canonical, String(item.updatedAt).slice(0, 10));
      }
    }
  }
  const body = Array.from(urls.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([location, lastModified]) => {
    const lines = [`  <url>`, `    <loc>${xmlEscape(location)}</loc>`];
    if (lastModified) lines.push(`    <lastmod>${xmlEscape(lastModified)}</lastmod>`);
    lines.push(`  </url>`);
    return lines.join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function findGeneratedDetail(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
  // Full custom service HTML must never be replaced by the CMS stub renderer.
  if (/^services\//i.test(cleanPath)) return null;
  const data = readData();
  for (const collection of Object.keys(DETAIL_PATHS)) {
    const item = (data.collections[collection] || []).find((entry) => {
      if (entry.status !== 'published') return false;
      return publicItemHref(collection, entry).replace(/^\/+/, '').split(/[?#]/)[0] === cleanPath;
    });
    if (item) return { collection, item };
  }
  return null;
}

function generatedDetailSchema(collection, item, canonical, imageUrl) {
  const name = item.title || item.name;
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Digital Hub',
    legalName: 'Digital Hub S.A.E.',
    alternateName: 'Digital Hub Egypt',
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/assets/digital-hub-logo.png`,
    },
    foundingDate: '2019',
    slogan: 'Empowering Digital Evolution',
    description: 'Digital Hub is a digital transformation company founded in 2019 and headquartered in New Cairo, Egypt, providing enterprise software, data and analytics, AI automation, and technical talent outsourcing to government, banking, and enterprise clients.',
    email: 'sales@digitalhub.com.eg',
    telephone: '+201555553064',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Pearl des Rois Administrative Building, B07, Unit 311, Fifth Settlement',
      addressLocality: 'New Cairo',
      addressRegion: 'Cairo Governorate',
      addressCountry: 'EG',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'sales@digitalhub.com.eg',
      telephone: '+201555553064',
      availableLanguage: ['en', 'ar'],
    },
    knowsAbout: [
      'Digital Employee Experience',
      'Enterprise Software Development',
      'Data Analytics',
      'Artificial Intelligence Automation',
      'IT Outsourcing',
      'Digital Transformation',
    ],
    sameAs: [
      'https://www.linkedin.com/company/digital-hub-eg',
      'https://www.facebook.com/DigitalHub19/',
      'https://www.instagram.com/digitalhub_eg/',
      'https://www.amcham.org.eg/recruitment/employers/6284/digital-hub',
      'https://wuzzuf.net/jobs/careers/Digital-Hub-Egypt-22501',
    ],
  };
  let entity;
  if (collection === 'jobs') {
    let employmentType = 'FULL_TIME';
    if (/intern/i.test(item.type || '')) employmentType = 'INTERN';
    else if (/part/i.test(item.type || '')) employmentType = 'PART_TIME';
    else if (/contract|project/i.test(item.type || '')) employmentType = 'CONTRACTOR';
    entity = {
      '@type': 'JobPosting',
      '@id': `${canonical}#job`,
      title: name,
      description: item.summary,
      datePosted: String(item.updatedAt || new Date().toISOString()).slice(0, 10),
      employmentType,
      directApply: true,
      hiringOrganization: { '@id': `${SITE_URL}/#organization` },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: item.location || 'New Cairo',
          addressCountry: 'EG',
        },
      },
      url: canonical,
    };
  } else if (collection === 'services') {
    entity = { '@type': 'Service', '@id': `${canonical}#service`, name, description: item.summary, url: canonical, provider: { '@id': `${SITE_URL}/#organization` } };
  } else if (collection === 'blogs') {
    entity = { '@type': 'BlogPosting', '@id': `${canonical}#article`, headline: name, description: item.summary, image: imageUrl, url: canonical, datePublished: String(item.updatedAt || new Date().toISOString()).slice(0, 10), author: { '@id': `${SITE_URL}/#organization` }, publisher: { '@id': `${SITE_URL}/#organization` } };
  } else if (collection === 'caseStudies') {
    entity = { '@type': 'Article', '@id': `${canonical}#case-study`, headline: name, description: item.summary, image: imageUrl, url: canonical, author: { '@id': `${SITE_URL}/#organization` }, publisher: { '@id': `${SITE_URL}/#organization` } };
  } else {
    entity = { '@type': 'WebPage', '@id': `${canonical}#webpage`, name, description: item.summary, url: canonical, about: { '@id': `${SITE_URL}/#organization` } };
  }
  return { '@context': 'https://schema.org', '@graph': [organization, entity] };
}

function postedAgoLabel(iso) {
  const stamp = Date.parse(iso || '') || Date.now();
  const days = Math.max(0, Math.floor((Date.now() - stamp) / 86400000));
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'Posted 1 month ago';
  if (months < 12) return `Posted ${months} months ago`;
  return 'Posted over a year ago';
}

function jobSectionHtml(title, html) {
  const content = String(html || '').trim();
  if (!content) return '';
  return `<section class="careers-detail__block careers-detail__body"><h2>${htmlEscape(title)}</h2>${blogPages.sanitizeHtml(content)}</section>`;
}

function renderJobDetail(item) {
  const name = item.title || 'Open role';
  const href = publicItemHref('jobs', item);
  const canonical = absolutePublicUrl(href);
  const imageUrl = absolutePublicUrl('/assets/careers/hero.webp');
  const schema = generatedDetailSchema('jobs', item, canonical, imageUrl);
  const roleSlug = path.basename(String(href || ''), path.extname(String(href || ''))) || 'role';
  const applyHref = `/careers/apply.html?role=${encodeURIComponent(roleSlug)}`;
  const tags = [item.type, item.location, item.department].filter(Boolean);
  const sectionsHtml = [
    jobSectionHtml('About the Role', item.aboutRole),
    jobSectionHtml('Key Responsibilities', item.keyResponsibilities),
    jobSectionHtml('Required Skills & Experience', item.requiredSkills),
    jobSectionHtml('Nice to Have', item.niceToHave),
    jobSectionHtml('What This Role Offers', item.roleOffers),
  ].join('') || (item.body
    ? `<section class="careers-detail__block careers-detail__body">${blogPages.sanitizeHtml(item.body)}</section>`
    : `<section class="careers-detail__block"><p>${htmlEscape(item.summary || '')}</p></section>`);
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en" class="nav-shown">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${htmlEscape(name)} | Careers | Digital Hub S.A.E</title>
<meta name="description" content="${htmlEscape(item.summary || name)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${htmlEscape(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Digital Hub S.A.E" />
<meta property="og:title" content="${htmlEscape(name)} | Careers | Digital Hub S.A.E" />
<meta property="og:description" content="${htmlEscape(item.summary || name)}" />
<meta property="og:url" content="${htmlEscape(canonical)}" />
<meta property="og:image" content="${htmlEscape(imageUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${htmlEscape(name)} | Careers | Digital Hub S.A.E" />
<meta name="twitter:description" content="${htmlEscape(item.summary || name)}" />
<meta name="twitter:image" content="${htmlEscape(imageUrl)}" />
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
<meta name="theme-color" content="#0A1628" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css" />
<link rel="stylesheet" href="/css/service-page.css?v=svc24" />
<link rel="stylesheet" href="/css/hub-pages.css?v=29" />
<link rel="stylesheet" href="/css/careers-page.css?v=29" />
<link rel="stylesheet" href="/css/tv.css?v=9" />
<link rel="stylesheet" href="/css/responsive.css?v=30" />
</head>
<body class="page-hub page-careers">
<div class="site-bg" aria-hidden="true">
  <div class="site-grid"></div>
  <div class="site-waves">
    <div class="wave wave-1"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1800,200 C2000,100 2200,300 2400,200" fill="none" stroke="#1A9AD6" stroke-opacity="0.16" stroke-width="1.5"/></svg></div>
    <div class="wave wave-2"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,320 C300,260 500,380 800,320 C1100,260 1300,380 1600,320 C1900,260 2100,380 2400,320" fill="none" stroke="#1A9AD6" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
    <div class="wave wave-3"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,420 C240,300 480,560 720,420 C960,280 1200,560 1440,420 C1680,280 1920,560 2160,420 C2280,360 2340,400 2400,420" fill="none" stroke="#36B0E5" stroke-opacity="0.10" stroke-width="1.25"/></svg></div>
    <div class="wave wave-4"><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,540 C300,480 500,600 800,540 C1100,480 1300,600 1600,540 C1900,480 2100,600 2400,540" fill="none" stroke="#F4970B" stroke-opacity="0.12" stroke-width="1.25"/></svg></div>
  </div>
</div>
<nav class="nav" id="nav" aria-label="Primary">
  <div class="nav-inner glass-surface">
    <a href="/" class="brand" aria-label="Digital Hub home"><img class="brand-logo" src="/assets/digital-hub-logo.png" alt="Digital Hub" decoding="async" width="180" height="48" loading="eager"></a>
    <ul class="nav-links" role="menubar">
      <li class="has-dd" role="none">
        <a class="nav-link" role="menuitem" tabindex="0">Services <i class="ti ti-chevron-down"></i></a>
        <div class="dd" role="menu">
          <a href="/services/enterprise-software.html"><i class="ti ti-code"></i> Enterprise Software Solutions</a>
          <a href="/services/data-analytics.html"><i class="ti ti-chart-bar"></i> Data &amp; Analytics Solutions</a>
          <a href="/services/ai-automation.html"><i class="ti ti-brain"></i> AI &amp; Intelligent Automation</a>
          <a href="/services/outsourcing.html"><i class="ti ti-users"></i> Outsourcing Technical Talents</a>
        </div>
      </li>
      <li class="has-dd" role="none">
        <a class="nav-link" role="menuitem" tabindex="0">Partners <i class="ti ti-chevron-down"></i></a>
        <div class="dd" role="menu">
          <a href="/partners/microsoft.html"><i class="ti ti-brand-windows"></i> Microsoft</a>
          <a href="/partners/huawei.html"><i class="ti ti-cloud"></i> Huawei</a>
          <a href="/partners/nexthink.html"><i class="ti ti-device-desktop-analytics"></i> Nexthink</a>
          <a href="/partners/efinance.html"><i class="ti ti-credit-card"></i> eFinance</a>
          <a href="/partners/vodafone.html"><i class="ti ti-antenna-bars-5"></i> Vodafone</a>
        </div>
      </li>
      <li><a class="nav-link" href="/cases/">Case Studies</a></li>
      <li><a class="nav-link" href="/blogs/">Blogs</a></li>
      <li><a class="nav-link" href="/about-us.html">About Us</a></li>
      <li><a class="nav-link is-active" href="/careers/" aria-current="page">Careers</a></li>
    </ul>
    <a class="nav-cta" href="/get-in-touch.html">Get in touch <i class="ti ti-arrow-right"></i></a>
    <button class="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false"><i class="ti ti-menu-2"></i></button>
  </div>
</nav>
<div class="mobile-nav" id="mobileNav" aria-hidden="true">
  <details>
    <summary>Services <i class="ti ti-chevron-down"></i></summary>
    <div class="sub">
      <a href="/services/enterprise-software.html">Enterprise Software Solutions</a>
      <a href="/services/data-analytics.html">Data &amp; Analytics Solutions</a>
      <a href="/services/ai-automation.html">AI &amp; Intelligent Automation</a>
      <a href="/services/outsourcing.html">Outsourcing Technical Talents</a>
    </div>
  </details>
  <details>
    <summary>Partners <i class="ti ti-chevron-down"></i></summary>
    <div class="sub">
      <a href="/partners/">All partners</a>
      <a href="/partners/microsoft.html">Microsoft</a>
      <a href="/partners/huawei.html">Huawei</a>
      <a href="/partners/nexthink.html">Nexthink</a>
      <a href="/partners/efinance.html">eFinance</a>
      <a href="/partners/vodafone.html">Vodafone</a>
    </div>
  </details>
  <a href="/cases/">Case Studies</a>
  <a href="/blogs/">Blogs</a>
  <a href="/about-us.html">About Us</a>
  <a href="/careers/">Careers</a>
  <a class="mn-cta" href="/get-in-touch.html">Get in Touch</a>
</div>
<main>
  <section class="careers-detail-hero" aria-label="Careers">
    <p class="careers-detail-hero__title">Careers</p>
  </section>
  <section class="careers-detail">
    <div class="careers-detail__inner">
      <nav class="careers-crumb" aria-label="Breadcrumb">
        <a href="/"><i class="ti ti-home" aria-hidden="true"></i> Home</a>
        <span class="careers-crumb__sep" aria-hidden="true">/</span>
        <a href="/careers/">Careers</a>
        <span class="careers-crumb__sep" aria-hidden="true">/</span>
        <span class="careers-crumb__current">${htmlEscape(name)}</span>
      </nav>
      <header class="careers-detail__meta">
        <div>
          <h1>${htmlEscape(name)}</h1>
          ${tags.length ? `<div class="careers-detail__tags">${tags.map((tag) => `<span>${htmlEscape(tag)}</span>`).join('')}</div>` : ''}
        </div>
        <p class="careers-detail__posted"><i class="ti ti-calendar" aria-hidden="true"></i> ${htmlEscape(postedAgoLabel(item.updatedAt))}</p>
      </header>
      ${sectionsHtml}
      <section class="careers-apply" id="apply">
        <p>All the above requirements and responsibilities are crucial for you to be able to take on in this role. We are looking for someone who has the energy and passion to bring together new ideas.</p>
        <a class="btn-pill" href="${htmlEscape(applyHref)}">Apply Now <i class="ti ti-arrow-right" aria-hidden="true"></i></a>
      </section>
    </div>
  </section>
</main>
<footer class="footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div>
        <img class="footer-logo" src="/assets/digital-hub-logo.png" alt="Digital Hub" width="180" height="48" loading="eager" decoding="async">
        <p class="footer-tagline">Empowering Digital Evolution</p>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h4>Services</h4>
          <a href="/services/enterprise-software.html">Enterprise Software</a>
          <a href="/services/data-analytics.html">Data &amp; Analytics</a>
          <a href="/services/ai-automation.html">AI &amp; Automation</a>
          <a href="/services/outsourcing.html">Outsourcing</a>
        </div>
        <div class="footer-col">
          <h4>Company</h4>
          <a href="/about-us.html">About Us</a>
          <a href="/cases/">Case Studies</a>
          <a href="/blogs/">Blogs</a>
          <a href="/careers/">Careers</a>
        </div>
      </div>
      <div class="footer-contact">
        <h4>Contact</h4>
        <a href="mailto:careers@digitalhub.com.eg">careers@digitalhub.com.eg</a>
        <a href="tel:+201555553064">+20 155 555 3064</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${year} Digital Hub S.A.E. All rights reserved.</span>
      <span>Microsoft Partner &middot; Nexthink Authorized Reseller &middot; Huawei &middot; eFinance &middot; Vodafone</span>
    </div>
  </div>
</footer>
<script src="/js/shared.js?v=29"></script>
<script src="/js/nav-stay-on-page.js?v=29"></script>
<script src="/js/hub-pages.js?v=29"></script>
</body>
</html>`;
}

function renderGeneratedDetail(collection, item) {
  if (collection === 'jobs') return renderJobDetail(item);
  const labels = { services: 'Service', partners: 'Strategic Partner', caseStudies: 'Case Study', blogs: 'Insight', news: 'News', jobs: 'Career Opportunity' };
  const sections = { services: 'Services', partners: 'Partners', caseStudies: 'Case Studies', blogs: 'Blogs & Insights', news: 'Latest News', jobs: 'Careers' };
  const sectionPaths = { services: '/#services', partners: '/partners/', caseStudies: '/cases/', blogs: '/blogs/', news: '/news/', jobs: '/careers/' };
  const name = item.title || item.name;
  const href = publicItemHref(collection, item);
  const canonical = absolutePublicUrl(href);
  const imagePath = item.image ? `/${String(item.image).replace(/^\/+/, '')}` : '/assets/blog/transformation.webp';
  const imageUrl = absolutePublicUrl(imagePath);
  const schema = generatedDetailSchema(collection, item, canonical, imageUrl);
  const meta = [item.department, item.type, item.location, item.categoryLabel, item.category, item.metric, [item.month, item.year].filter(Boolean).join(' ')].filter(Boolean);
  const ctaHref = '/get-in-touch.html';
  const ctaText = 'Talk to our team';
  const ogType = collection === 'blogs' || collection === 'caseStudies' ? 'article' : 'website';
  const jobBody = `<p>${htmlEscape(item.summary || '')}</p>`;
  return `<!doctype html>
<html lang="en" class="nav-shown">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${htmlEscape(name)} | Digital Hub S.A.E</title>
<meta name="description" content="${htmlEscape(item.summary)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${htmlEscape(canonical)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="Digital Hub S.A.E" />
<meta property="og:title" content="${htmlEscape(name)} | Digital Hub S.A.E" />
<meta property="og:description" content="${htmlEscape(item.summary)}" />
<meta property="og:url" content="${htmlEscape(canonical)}" />
<meta property="og:image" content="${htmlEscape(imageUrl)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${htmlEscape(name)} | Digital Hub S.A.E" />
<meta name="twitter:description" content="${htmlEscape(item.summary)}" />
<meta name="twitter:image" content="${htmlEscape(imageUrl)}" />
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
<meta name="theme-color" content="#0A1628" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css" />
<link rel="stylesheet" href="/css/service-page.css?v=svc24" />
<link rel="stylesheet" href="/css/hub-pages.css?v=29" />
<link rel="stylesheet" href="/css/responsive.css?v=30" />
<style>
.generated-detail-main{padding:clamp(130px,16vw,190px) 0 90px;min-height:75vh}.generated-detail-card{max-width:920px;padding:clamp(28px,5vw,58px);border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(13,28,48,.78);box-shadow:0 24px 70px rgba(0,0,0,.28)}.generated-detail-card h1{max-width:19ch;margin:16px 0;font-size:clamp(34px,5vw,62px);line-height:1.08}.generated-detail-card>p,.generated-detail-body{max-width:760px;color:var(--text-2);font-size:clamp(15px,1.7vw,19px);line-height:1.8}.generated-detail-body p{margin:0 0 1em}.generated-detail-body h1{margin:0 0 .55em;font-size:clamp(28px,3.5vw,40px);line-height:1.15;color:#fff}.generated-detail-body h2{margin:1.2em 0 .5em;font-size:clamp(22px,2.6vw,30px);line-height:1.2;color:#fff}.generated-detail-body h3{margin:1.1em 0 .45em;font-size:clamp(18px,2vw,24px);line-height:1.25;color:#fff}.generated-detail-body ul,.generated-detail-body ol{margin:0 0 1em;padding-left:1.35em}.generated-detail-body li{margin:0.35em 0}.generated-detail-body strong,.generated-detail-body b{color:#fff;font-weight:700}.generated-detail-meta{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.generated-detail-meta span{padding:8px 12px;border:1px solid rgba(54,176,229,.22);border-radius:999px;background:rgba(54,176,229,.08);color:var(--text-2);font-size:12px}.generated-detail-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.generated-detail-back{display:inline-flex;align-items:center;gap:7px;color:var(--blue-light);text-decoration:none;font-weight:600}.generated-detail-back:hover{text-decoration:underline}
</style>
</head>
<body class="page-hub page-generated-detail">
<div class="site-bg" aria-hidden="true"><div class="site-grid"></div></div>
<nav class="nav" id="nav" aria-label="Primary"><div class="nav-inner glass-surface"><a href="/" class="brand" aria-label="Digital Hub home"><img class="brand-logo" src="/assets/digital-hub-logo.png" alt="Digital Hub" decoding="async"></a><ul class="nav-links"><li><a class="nav-link" href="/#services">Services</a></li><li><a class="nav-link" href="/partners/">Partners</a></li><li><a class="nav-link" href="/cases/">Case Studies</a></li><li><a class="nav-link" href="/blogs/">Blogs</a></li><li><a class="nav-link" href="/careers/">Careers</a></li></ul><a class="nav-cta" href="/get-in-touch.html">Get in Touch <i class="ti ti-arrow-right"></i></a></div></nav>
<main class="generated-detail-main"><section class="section-inner"><article class="generated-detail-card"><a class="generated-detail-back" href="${sectionPaths[collection]}"><i class="ti ti-arrow-left"></i> ${sections[collection]}</a><span class="label" style="display:block;margin-top:28px">${labels[collection]}</span><h1>${htmlEscape(name)}</h1>${meta.length ? `<div class="generated-detail-meta">${meta.map((value) => `<span>${htmlEscape(value)}</span>`).join('')}</div>` : ''}${jobBody}<div class="generated-detail-actions"><a class="btn-primary" href="${htmlEscape(ctaHref)}">${ctaText} <i class="ti ti-arrow-right"></i></a></div></article></section></main>
<footer class="footer"><div class="section-inner"><div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} Digital Hub S.A.E. All rights reserved.</span><a href="/">Digital Hub</a></div></div></footer>
<script src="/js/shared.js?v=29"></script><script src="/js/nav-stay-on-page.js?v=29"></script>
</body></html>`;
}

function isCompressible(type) {
  return /^(?:text\/|application\/(?:javascript|json|xml))/i.test(type) || type === 'image/svg+xml';
}

function sendBuffer(req, res, status, body, headers = {}) {
  let payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const responseHeaders = { ...headers };
  const type = String(responseHeaders['Content-Type'] || '');
  const accepted = String(req.headers['accept-encoding'] || '');
  if (payload.length > 1024 && isCompressible(type)) {
    responseHeaders.Vary = 'Accept-Encoding';
    if (/\bbr\b/.test(accepted)) {
      payload = zlib.brotliCompressSync(payload, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
      responseHeaders['Content-Encoding'] = 'br';
    } else if (/\bgzip\b/.test(accepted)) {
      payload = zlib.gzipSync(payload, { level: 6 });
      responseHeaders['Content-Encoding'] = 'gzip';
    }
  }
  responseHeaders['Content-Length'] = payload.length;
  res.writeHead(status, responseHeaders);
  if (req.method === 'HEAD') return res.end();
  return res.end(payload);
}

function isInsideContentDir(absPath) {
  const resolved = pathKey(absPath);
  return resolved === CONTENT_DIR_KEY || resolved.startsWith(`${CONTENT_DIR_KEY}${path.sep}`);
}

/** Default-deny: any resolved path under content/ except the public allowlist. */
function isDeniedContentTarget(absPath) {
  const resolved = pathKey(absPath);
  if (!isInsideContentDir(resolved)) return false;
  return !CONTENT_PUBLIC_ALLOW.has(resolved);
}

/**
 * Default-deny for everything else: a target is servable only if its first path
 * segment is an allowed directory, or it is an allowed file sitting at the root.
 * Anything outside that — dotfiles, source, tooling, gitignored scratch dirs —
 * is denied whether or not it exists.
 */
function isDeniedStaticTarget(absPath) {
  const resolved = path.resolve(absPath);
  if (resolved === ROOT) return true;
  const rel = path.relative(ROOT, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return true;
  const segments = rel.split(path.sep).filter(Boolean);
  if (!segments.length) return true;
  const first = segments[0];
  if (segments.length === 1 && !fsIsDirectory(resolved)) {
    return !PUBLIC_ROOT_FILES.has(first.toLowerCase());
  }
  if (first.toLowerCase() === 'book') {
    if (segments.length === 1) return false;
    return !(segments.length === 2 && segments[1].toLowerCase() === 'index.html');
  }
  return !PUBLIC_DIRS.has(first.toLowerCase());
}

function fsIsDirectory(absPath) {
  try {
    return fs.statSync(absPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function staticNotFound(req, res) {
  return sendBuffer(req, res, 404, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Page not found | Digital Hub</title></head><body><h1>404</h1><p>Page not found.</p></body></html>', {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  });
}

function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (_) {
    return sendBuffer(req, res, 400, 'Bad request', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  }
  if (pathname === '/sitemap.xml') {
    return sendBuffer(req, res, 200, sitemapXml(), {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
  }
  if (pathname === '/llms.txt') {
    const llmsPath = path.join(ROOT, 'llms.txt');
    if (!fs.existsSync(llmsPath)) {
      return sendBuffer(req, res, 404, 'Not found', {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    }
    return sendBuffer(req, res, 200, fs.readFileSync(llmsPath), {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
  }
  if (pathname === '/admin/email-preview.html' || pathname === '/admin/email-preview') {
    mail.loadEmailTemplates(true);
    const sampleApp = {
      fullName: 'Sara Hassan',
      role: 'Senior Backend Engineer',
      email: 'sara.hassan@example.com',
      phone: '+20 100 000 0000',
    };
    const sampleRound = {
      label: 'Technical',
      format: 'online',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      interviewer: 'Omar Farid',
      interviewerTitle: 'Engineering Manager',
      interviewerEmail: 'interviewer@digitalhub.com.eg',
      scheduledAt: '2026-08-21T11:00:00',
    };
    const when = new Date(sampleRound.scheduledAt);
    let variants = [
      { audience: 'interviewer', kind: 'schedule', to: 'interviewer@digitalhub.com.eg · CC: HR' },
      { audience: 'candidate', kind: 'schedule', to: 'sara.hassan@example.com' },
      { audience: 'interviewer', kind: 'reminder', to: 'interviewer@digitalhub.com.eg · CC: HR' },
      { audience: 'candidate', kind: 'reminder', to: 'sara.hassan@example.com' },
    ].map((entry) => {
      const body = mail.interviewEmailBodies({
        kind: entry.kind,
        audience: entry.audience,
        application: sampleApp,
        round: sampleRound,
        when,
        baseUrl: mail.publicBaseUrl(req.headers.host),
      });
      return Object.assign({}, entry, body);
    });
    const sampleBooking = mail.sampleInterviewPreviewData();
    const bookingBody = mail.bookingInvitationBodies({
      application: sampleBooking.application,
      round: sampleBooking.round,
      bookingUrl: sampleBooking.bookingUrl,
      expiresAt: sampleBooking.expiresAt,
      baseUrl: mail.publicBaseUrl(req.headers.host),
    });
    const reminderBody = mail.bookingInvitationBodies({
      application: sampleBooking.application,
      round: sampleBooking.round,
      bookingUrl: '',
      expiresAt: sampleBooking.expiresAt,
      baseUrl: mail.publicBaseUrl(req.headers.host),
      kind: 'bookingReminder',
    });
    const candidateSchedule = variants.find((entry) => entry.kind === 'schedule' && entry.audience === 'candidate');
    const bookingCard = {
      audience: 'candidate',
      kind: 'booking',
      to: 'sara.hassan@example.com',
      subject: bookingBody.subject,
      html: bookingBody.html,
    };
    const reminderCard = {
      audience: 'candidate',
      kind: 'bookingReminder',
      to: 'sara.hassan@example.com',
      subject: reminderBody.subject,
      html: reminderBody.html,
    };
    variants = [candidateSchedule, bookingCard, reminderCard].concat(variants.filter((entry) => entry !== candidateSchedule));
    const cards = variants.map((entry) => `
      <article class="card">
        <div class="card-meta">
          <span class="kind">${entry.kind === 'reminder' ? 'Day reminder' : (entry.kind === 'bookingReminder' ? 'Booking reminder' : (entry.kind === 'booking' ? 'Booking invite' : 'Schedule'))}</span>
          <div class="audience">To ${entry.audience}</div>
          <div class="subject">${String(entry.subject).replace(/</g, '&lt;')}</div>
          <div class="to">To: ${entry.to}${entry.kind === 'schedule' ? ' · + calendar.ics' : ''}${entry.kind === 'booking' ? ' · no calendar yet' : ''}${entry.kind === 'bookingReminder' ? ' · original link, once' : ''}</div>
        </div>
        <div class="inbox"><div class="mail">${entry.html}</div></div>
      </article>`).join('');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Interview email layout preview</title>
  <style>
    body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:linear-gradient(180deg,#dfe7ef,#e8edf2);color:#122033;padding:28px 20px 48px}
    .page-head{max-width:1120px;margin:0 auto 24px}
    .page-head h1{margin:0 0 6px;font-size:1.45rem}
    .page-head p{margin:0;color:#5b6b7c;max-width:70ch;font-size:.95rem}
    code{font-size:.85em;background:#fff;padding:1px 5px;border-radius:4px;border:1px solid #d5dde6}
    .grid{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
    @media (max-width:900px){.grid{grid-template-columns:1fr}}
    .card{background:#f7f9fb;border:1px solid #d5dde6;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(18,32,51,.06)}
    .card-meta{padding:14px 16px 12px;border-bottom:1px solid #d5dde6;background:#fff}
    .audience{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1A9AD6;margin-bottom:6px}
    .kind{float:right;font-size:.72rem;font-weight:650;color:#5b6b7c;background:#eef3f8;padding:3px 8px;border-radius:999px}
    .subject{clear:both;font-size:.92rem;font-weight:600;line-height:1.35}
    .to{margin-top:6px;font-size:.8rem;color:#5b6b7c}
    .inbox{background:#eceff3;padding:18px 14px 22px}
    .mail{max-width:560px;margin:0 auto}
    .note{max-width:1120px;margin:18px auto 0;font-size:.85rem;color:#5b6b7c}
  </style>
</head>
<body>
  <div class="page-head">
    <h1>Interview email layout preview</h1>
    <p>Live render from templates. Candidate schedule sits next to the booking invite so the shared layout can be compared. Fixtures: <code>lib/email-templates/fixtures/</code>. Sample interviewer: <code>Omar Farid · Engineering Manager</code>.</p>
  </div>
  <div class="grid">${cards}</div>
  <p class="note">No mail is sent from this page. SES must be configured before real sends.</p>
</body>
</html>`;
    return sendBuffer(req, res, 200, html, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  }
  if (pathname === '/') pathname = '/index.html';
  let target = path.resolve(ROOT, `.${pathname}`);
  if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
    return sendBuffer(req, res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  }
  if (isDeniedContentTarget(target) || isDeniedStaticTarget(target)) {
    return staticNotFound(req, res);
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(308, {
        Location: `${pathname}/${url.search || ''}`,
        'Cache-Control': 'no-store',
      });
      return res.end();
    }
    target = path.join(target, 'index.html');
    if (isDeniedContentTarget(target) || isDeniedStaticTarget(target)) {
      return staticNotFound(req, res);
    }
  }
  if (!path.extname(target) && fs.existsSync(`${target}.html`)) {
    res.writeHead(308, {
      Location: `${pathname}.html${url.search || ''}`,
      'Cache-Control': 'no-store',
    });
    return res.end();
  }
  // Prefer on-disk HTML for designed pages. CMS stubs are only for paths with no static file.
  // Service pages are never stubbed — CMS content is synced into the full HTML design instead.
  {
    const hasStaticHtml = fs.existsSync(target) && fs.statSync(target).isFile();
    const generated = hasStaticHtml ? null : findGeneratedDetail(pathname);
    if (generated) {
      return sendBuffer(req, res, 200, renderGeneratedDetail(generated.collection, generated.item), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
    }
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return staticNotFound(req, res);
  }
  const type = mime[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const noCache = target === PUBLIC_JS_FILE || target === PUBLIC_JSON_FILE || pathname.startsWith('/admin') || pathname.startsWith('/book');
  const stat = fs.statSync(target);
  const extension = path.extname(target).toLowerCase();
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': type,
    /* HTML is always revalidated so content updates show up on refresh; versioned assets stay cacheable. */
    'Cache-Control': noCache ? 'no-store' : (/^(?:\.png|\.jpe?g|\.webp|\.gif|\.svg|\.woff2?)$/.test(extension) ? 'public, max-age=2592000, immutable' : (extension === '.html' ? 'no-cache' : 'public, max-age=3600')),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Last-Modified': stat.mtime.toUTCString(),
    ETag: etag,
  };
  if (pathname.startsWith('/admin') || pathname.startsWith('/book')) headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  if (isCompressible(type)) return sendBuffer(req, res, 200, fs.readFileSync(target), headers);
  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(target).pipe(res);
}

ensureStorage();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    const requestHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (requestHost === 'www.digitalhub.com.eg') {
      res.writeHead(301, { Location: `${SITE_URL}${url.pathname}${url.search}`, 'Cache-Control': 'public, max-age=86400' });
      return res.end();
    }
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: 'SERVER_ERROR', message: error.status ? error.message : 'An unexpected server error occurred.' });
    else res.end();
    if (!error.status) console.error(error);
  }
});

async function startServer() {
  await hiringDb.openHiringDb();
  await hiringDb.ensureHiringSchema(hiringDb.getHiringDb());
  await ensureAdminBootstrap();
  server.listen(PORT, HOST, () => {
    console.log(`Digital Hub CMS running at http://${HOST}:${PORT}`);
    if (mail.mailEnabled() && mail.smtpConfigured()) {
      console.log(`[mail] Amazon SES enabled · day reminders at 10:00 ${mail.MAIL_TZ}`);
    } else {
      console.log('[mail] Disabled (set SES_SMTP_USER, SES_SMTP_PASS, SES_FROM, and AWS_REGION or SES_SMTP_HOST)');
    }
    startInterviewReminderJob();
  });
}

startServer().catch((error) => {
  console.error('[fatal] Server failed to start:', error.message || error);
  process.exit(1);
});
