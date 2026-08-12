'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);
const HOST = process.env.HOST || '127.0.0.1';
const SITE_URL = 'https://www.digitalhub.com.eg';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'DigitalHub@2026';
const DATA_FILE = path.join(ROOT, 'content', 'admin-content.json');
const USERS_FILE = path.join(ROOT, 'content', 'admin-users.json');
const PUBLIC_JSON_FILE = path.join(ROOT, 'content', 'site-content.json');
const PUBLIC_JS_FILE = path.join(ROOT, 'content', 'site-content.js');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const APPLICATIONS_FILE = path.join(ROOT, 'content', 'job-applications.json');
const APPLICATION_FILES_DIR = path.join(ROOT, 'content', 'application-files');
const CONTACT_REQUESTS_FILE = path.join(ROOT, 'content', 'contact-requests.json');
const MAX_JSON_BYTES = 7 * 1024 * 1024;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_APPLICATION_BYTES = MAX_RESUME_BYTES + (512 * 1024);
const SESSION_TTL = 8 * 60 * 60 * 1000;
const CONTACT_SITUATIONS = {
  gov: 'Government / public sector digital services',
  dx: 'Enterprise digital transformation',
  dex: 'Nexthink DEX (200+ endpoints)',
  other: 'Something else',
};
const COLLECTIONS = new Set(['services', 'partners', 'caseStudies', 'blogs', 'jobs', 'team']);
const PAGES = new Set(['home', 'blogs', 'cases', 'partners', 'careers', 'about']);

const fields = {
  services: ['title', 'summary', 'href', 'icon', 'visual', 'status', 'featured', 'order'],
  partners: ['name', 'summary', 'href', 'image', 'variant', 'status', 'featured', 'order'],
  caseStudies: ['title', 'summary', 'href', 'image', 'alt', 'categories', 'metric', 'status', 'featured', 'order'],
  blogs: ['title', 'summary', 'href', 'image', 'category', 'categoryLabel', 'readTime', 'accent', 'status', 'featured', 'order'],
  jobs: ['title', 'summary', 'href', 'department', 'location', 'type', 'status', 'featured', 'order'],
  team: ['name', 'role', 'image', 'email', 'linkedin', 'status', 'featured', 'order'],
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
const loginAttempts = new Map();
const applicationAttempts = new Map();
const contactAttempts = new Map();

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

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function readApplications() {
  if (!fs.existsSync(APPLICATIONS_FILE)) return { version: 1, updatedAt: null, applications: [] };
  return JSON.parse(fs.readFileSync(APPLICATIONS_FILE, 'utf8'));
}

function writeApplications(data) {
  const temp = `${APPLICATIONS_FILE}.tmp`;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temp, APPLICATIONS_FILE);
  fs.unlinkSync(temp);
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

function writeUsers(data) {
  const temp = `${USERS_FILE}.tmp`;
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temp, USERS_FILE);
  fs.unlinkSync(temp);
}

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

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function permissionsFor(role) {
  const admin = role === 'admin';
  return {
    collections: admin ? Array.from(COLLECTIONS) : ['jobs'],
    pages: admin ? Array.from(PAGES) : ['careers'],
    canManageUsers: admin,
    canUseTools: admin,
  };
}

function adminView(data, session) {
  if (session.role === 'admin') return data;
  return {
    meta: {
      ...data.meta,
      audit: (data.meta.audit || []).filter((event) => event.by === session.username).slice(0, 20),
    },
    pages: { careers: data.pages.careers },
    collections: { jobs: data.collections.jobs || [] },
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

function writeDerivedFiles(data) {
  const published = publicView(data);
  fs.writeFileSync(PUBLIC_JSON_FILE, `${JSON.stringify(published, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    PUBLIC_JS_FILE,
    `/* Generated by the Digital Hub CMS. Do not edit directly. */\nwindow.DH_CONTENT = ${JSON.stringify(published)};\n`,
    'utf8'
  );
}

function writeData(data) {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.copyFileSync(temp, DATA_FILE);
  fs.unlinkSync(temp);
  writeDerivedFiles(data);
}

function ensureStorage() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(APPLICATION_FILES_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) throw new Error(`Missing content store: ${DATA_FILE}`);
  if (!fs.existsSync(USERS_FILE)) {
    const now = new Date().toISOString();
    writeUsers({
      version: 1,
      updatedAt: now,
      users: [{
        id: `user-${crypto.randomUUID()}`,
        username: ADMIN_USER.toLowerCase(),
        name: 'Administrator',
        role: 'admin',
        active: true,
        passwordHash: passwordHash(ADMIN_PASSWORD),
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      }],
    });
  }
  if (!fs.existsSync(APPLICATIONS_FILE)) writeApplications({ version: 1, updatedAt: null, applications: [] });
  if (!fs.existsSync(CONTACT_REQUESTS_FILE)) writeContactRequests({ version: 1, updatedAt: null, requests: [] });
  writeDerivedFiles(readData());
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

function getSession(req) {
  const token = parseCookies(req).dh_admin_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  const account = readUsers().users.find((user) => user.id === session.userId);
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

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: 'AUTH_REQUIRED', message: 'Please sign in again.' });
    return null;
  }
  return session;
}

function requireMutationAuth(req, res) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!safeEqual(req.headers['x-csrf-token'] || '', session.csrf)) {
    json(res, 403, { error: 'INVALID_CSRF', message: 'Your session could not be verified.' });
    return null;
  }
  return session;
}

function requireAdmin(req, res, mutation = false) {
  const session = mutation ? requireMutationAuth(req, res) : requireAuth(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Administrator access is required.' });
    return null;
  }
  return session;
}

function canEditCollection(session, collection) {
  return session.role === 'admin' || (session.role === 'hr' && collection === 'jobs');
}

function canEditPage(session, page) {
  return session.role === 'admin' || (session.role === 'hr' && page === 'careers');
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
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw Object.assign(new Error('Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores.'), { status: 422 });
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
  for (const key of fields[collection]) {
    const value = input[key];
    if (key === 'href') output[key] = text(value, 1000) || existing.href || '';
    else if (key === 'featured') output[key] = Boolean(value);
    else if (key === 'order' || key === 'readTime') output[key] = Math.max(0, Number(value) || 0);
    else if (key === 'categories') {
      const raw = Array.isArray(value) ? value : String(value || '').split(',');
      output[key] = raw.map((entry) => text(entry, 80)).filter(Boolean).slice(0, 10);
    } else if (key === 'status') output[key] = value === 'draft' ? 'draft' : 'published';
    else output[key] = text(value, key === 'summary' ? 5000 : 1000);
  }
  const title = output.title || output.name;
  if (!title) throw Object.assign(new Error('A title or name is required.'), { status: 422 });
  if (fields[collection].includes('href') && !output.href) output.href = automaticHref(collection, title, output.id);
  output.updatedAt = new Date().toISOString();
  return output;
}

function cleanPage(input) {
  const allowed = ['label', 'title', 'lead', 'sectionTitle', 'sectionLead', 'seoTitle'];
  return allowed.reduce((out, key) => {
    out[key] = text(input[key], key === 'lead' || key === 'sectionLead' ? 5000 : 1000);
    return out;
  }, {});
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

function canAttemptLogin(req) {
  const ip = clientAddress(req);
  const now = Date.now();
  const state = loginAttempts.get(ip) || { count: 0, resetAt: now + 10 * 60 * 1000 };
  if (state.resetAt < now) {
    state.count = 0;
    state.resetAt = now + 10 * 60 * 1000;
  }
  state.count += 1;
  loginAttempts.set(ip, state);
  return state.count <= 8;
}

function clearLoginAttempts(req) {
  loginAttempts.delete(clientAddress(req));
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

  const now = new Date().toISOString();
  const applicationUuid = crypto.randomUUID();
  const id = `application-${applicationUuid}`;
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
      resumeName: path.basename(file.name),
      resumeFile: `${id}${ext}`,
      status: 'new',
      submittedAt: now,
      updatedAt: now,
    },
    resume: file.buffer,
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
    const target = path.join(APPLICATION_FILES_DIR, result.application.resumeFile);
    fs.writeFileSync(target, result.resume, { flag: 'wx' });
    try {
      const data = readApplications();
      data.applications.unshift(result.application);
      writeApplications(data);
    } catch (error) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      throw error;
    }
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

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (!canAttemptLogin(req)) return json(res, 429, { error: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' });
    const body = await readBody(req);
    const users = readUsers();
    const username = text(body.username, 40).toLowerCase();
    const account = users.users.find((user) => user.username === username);
    if (!account || !account.active || !verifyPassword(body.password || '', account.passwordHash)) {
      return json(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect.' });
    }
    clearLoginAttempts(req);
    account.lastLoginAt = new Date().toISOString();
    writeUsers(users);
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { userId: account.id, csrf, expiresAt: Date.now() + SESSION_TTL });
    return json(
      res,
      200,
      { authenticated: true, user: safeUser(account), permissions: permissionsFor(account.role), csrf },
      { 'Set-Cookie': `dh_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}` }
    );
  }

  if (pathname === '/api/admin/session' && req.method === 'GET') {
    const session = getSession(req);
    return json(res, 200, session
      ? { authenticated: true, user: safeUser(session), permissions: permissionsFor(session.role), csrf: session.csrf }
      : { authenticated: false });
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    const session = requireMutationAuth(req, res);
    if (!session) return;
    sessions.delete(session.token);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'dh_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  if (!pathname.startsWith('/api/admin/')) return json(res, 404, { error: 'NOT_FOUND' });

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const users = readUsers();
    return json(res, 200, { updatedAt: users.updatedAt, users: users.users.map(safeUser) });
  }

  if (pathname === '/api/admin/users' && req.method === 'POST') {
    const session = requireAdmin(req, res, true);
    if (!session) return;
    const body = await readBody(req);
    const users = readUsers();
    const username = cleanUsername(body.username);
    if (users.users.some((user) => user.username === username)) {
      return json(res, 409, { error: 'USERNAME_EXISTS', message: 'This username is already in use.' });
    }
    const password = validatePassword(body.password, true);
    const now = new Date().toISOString();
    const account = {
      id: `user-${crypto.randomUUID()}`,
      username,
      name: text(body.name, 100) || username,
      role: 'hr',
      active: body.active !== false,
      passwordHash: passwordHash(password),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    users.users.push(account);
    writeUsers(users);
    return json(res, 201, { user: safeUser(account), users: users.users.map(safeUser) });
  }

  if (pathname.startsWith('/api/admin/users/') && ['PUT', 'DELETE'].includes(req.method)) {
    const session = requireAdmin(req, res, true);
    if (!session) return;
    const id = pathname.split('/').pop();
    const users = readUsers();
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
      writeUsers(users);
      return json(res, 200, { users: users.users.map(safeUser) });
    }

    const body = await readBody(req);
    const username = cleanUsername(body.username);
    if (users.users.some((user) => user.id !== account.id && user.username === username)) {
      return json(res, 409, { error: 'USERNAME_EXISTS', message: 'This username is already in use.' });
    }
    account.username = username;
    account.name = text(body.name, 100) || username;
    account.active = body.active !== false;
    const password = validatePassword(body.password, false);
    if (password) {
      account.passwordHash = passwordHash(password);
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
    writeUsers(users);
    return json(res, 200, { user: safeUser(account), users: users.users.map(safeUser) });
  }

  if (pathname === '/api/admin/content' && req.method === 'GET') {
    const session = requireAuth(req, res);
    if (!session) return;
    return json(res, 200, adminView(readData(), session));
  }

  if (pathname === '/api/admin/content' && req.method === 'PUT') {
    const session = requireAdmin(req, res, true);
    if (!session) return;
    const current = readData();
    if (!checkRevision(req, res, current)) return;
    const body = await readBody(req);
    if (!body.pages || !body.collections) return json(res, 422, { error: 'INVALID_IMPORT', message: 'The import file has an invalid structure.' });
    const next = { meta: current.meta, pages: {}, collections: {} };
    for (const page of PAGES) next.pages[page] = cleanPage(body.pages[page] || {});
    for (const collection of COLLECTIONS) {
      const items = Array.isArray(body.collections[collection]) ? body.collections[collection] : [];
      next.collections[collection] = items.slice(0, 500).map((item) => cleanItem(collection, item));
    }
    addAudit(next, 'import', 'Imported a complete content backup', session.username);
    writeData(next);
    return json(res, 200, next);
  }

  if (pathname === '/api/admin/applications' && req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    const data = readApplications();
    return json(res, 200, { updatedAt: data.updatedAt, applications: data.applications || [] });
  }

  const applicationMatch = pathname.match(/^\/api\/admin\/applications\/([^/]+)(?:\/(resume))?$/);
  if (applicationMatch && req.method === 'GET' && applicationMatch[2] === 'resume') {
    if (!requireAuth(req, res)) return;
    const id = decodeURIComponent(applicationMatch[1]);
    const application = readApplications().applications.find((entry) => entry.id === id);
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    const target = path.resolve(APPLICATION_FILES_DIR, application.resumeFile);
    if (!target.startsWith(`${APPLICATION_FILES_DIR}${path.sep}`) || !fs.existsSync(target)) {
      return json(res, 404, { error: 'RESUME_NOT_FOUND', message: 'CV file not found.' });
    }
    const ext = path.extname(target).toLowerCase();
    const resumeMime = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const downloadName = applicationDownloadName(application.resumeName);
    res.writeHead(200, {
      'Content-Type': resumeMime[ext] || 'application/octet-stream',
      'Content-Length': fs.statSync(target).size,
      'Content-Disposition': `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return fs.createReadStream(target).pipe(res);
  }

  if (applicationMatch && req.method === 'PUT' && !applicationMatch[2]) {
    if (!requireMutationAuth(req, res)) return;
    const allowedStatuses = new Set(['new', 'reviewing', 'contacted', 'rejected']);
    const body = await readBody(req);
    const status = text(body.status, 30);
    if (!allowedStatuses.has(status)) return json(res, 422, { error: 'INVALID_STATUS', message: 'Select a valid application status.' });
    const data = readApplications();
    const application = data.applications.find((entry) => entry.id === decodeURIComponent(applicationMatch[1]));
    if (!application) return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'Application not found.' });
    application.status = status;
    application.updatedAt = new Date().toISOString();
    writeApplications(data);
    return json(res, 200, { application, applications: data.applications });
  }

  if (pathname === '/api/admin/contact-requests' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const data = readContactRequests();
    return json(res, 200, { updatedAt: data.updatedAt, requests: data.requests || [] });
  }

  const contactMatch = pathname.match(/^\/api\/admin\/contact-requests\/([^/]+)$/);
  if (contactMatch && req.method === 'PUT') {
    if (!requireAdmin(req, res, true)) return;
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
    const session = requireMutationAuth(req, res);
    if (!session) return;
    const page = pathname.split('/').pop();
    if (!PAGES.has(page)) return json(res, 404, { error: 'UNKNOWN_PAGE' });
    if (!canEditPage(session, page)) return json(res, 403, { error: 'FORBIDDEN', message: 'You can only edit Careers page content.' });
    const data = readData();
    if (!checkRevision(req, res, data)) return;
    data.pages[page] = cleanPage(await readBody(req));
    addAudit(data, 'page-update', `Updated ${page} page content`, session.username);
    writeData(data);
    return json(res, 200, adminView(data, session));
  }

  if (pathname === '/api/admin/upload' && req.method === 'POST') {
    const session = requireAdmin(req, res, true);
    if (!session) return;
    const body = await readBody(req);
    const match = String(body.dataUrl || '').match(/^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/=]+)$/i);
    if (!match) return json(res, 422, { error: 'INVALID_IMAGE', message: 'Use a PNG, JPG, WEBP, or GIF image.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return json(res, 413, { error: 'IMAGE_TOO_LARGE', message: 'Image size must be under 5 MB.' });
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const base = path.basename(text(body.name || 'image', 100), path.extname(body.name || '')).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'image';
    const filename = `${Date.now()}-${base.toLowerCase()}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
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
    const session = requireMutationAuth(req, res);
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
      list.push(item);
      addAudit(data, 'create', `Created ${item.title || item.name}`, session.username);
      writeData(data);
      return json(res, 201, adminView(data, session));
    }

    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return json(res, 404, { error: 'ITEM_NOT_FOUND' });

    if (req.method === 'PUT') {
      const item = cleanItem(collection, await readBody(req), list[index]);
      list[index] = item;
      addAudit(data, 'update', `Updated ${item.title || item.name}`, session.username);
      writeData(data);
      return json(res, 200, adminView(data, session));
    }

    if (req.method === 'DELETE') {
      const [removed] = list.splice(index, 1);
      addAudit(data, 'delete', `Deleted ${removed.title || removed.name}`, session.username);
      writeData(data);
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

function sitemapXml() {
  const data = readData();
  const urls = new Map();
  const fixedPages = [
    'index.html', 'about-us.html',
    'services/enterprise-software.html', 'services/data-analytics.html', 'services/ai-automation.html', 'services/outsourcing.html',
    'cases/index.html', 'cases/ministry-planning.html', 'cases/data-center-transformation.html', 'cases/nexthink-dex-bank.html',
    'blogs/index.html', 'blogs/digital-employee-experience.html', 'blogs/digital-transformation-signs.html', 'blogs/azure-digital-egypt-2030.html', 'blogs/enterprise-ai-production.html', 'blogs/augment-vs-outsource-tech-team.html',
    'partners/index.html', 'partners/microsoft.html', 'partners/huawei.html', 'partners/nexthink.html', 'partners/efinance.html', 'partners/vodafone.html',
    'careers/index.html', 'careers/dotnet-backend-developer.html', 'careers/data-analyst.html', 'careers/full-stack-developer.html',
  ];
  fixedPages.forEach((relativePath) => {
    const target = path.join(ROOT, ...relativePath.split('/'));
    if (!fs.existsSync(target)) return;
    const canonical = relativePath.endsWith('/index.html')
      ? `${SITE_URL}/${relativePath.slice(0, -'index.html'.length)}`
      : absolutePublicUrl(relativePath);
    urls.set(canonical, fs.statSync(target).mtime.toISOString().slice(0, 10));
  });
  for (const collection of Object.keys(DETAIL_PATHS)) {
    for (const item of data.collections[collection] || []) {
      if (item.status !== 'published') continue;
      const href = publicItemHref(collection, item);
      if (!href || href.includes('#')) continue;
      urls.set(absolutePublicUrl(href), String(item.updatedAt || data.meta.updatedAt || new Date().toISOString()).slice(0, 10));
    }
  }
  const body = Array.from(urls.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([location, lastModified]) =>
    `  <url>\n    <loc>${xmlEscape(location)}</loc>\n    <lastmod>${xmlEscape(lastModified)}</lastmod>\n  </url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function findGeneratedDetail(pathname) {
  const cleanPath = pathname.replace(/^\/+/, '');
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
    name: 'Digital Hub S.A.E',
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/digital-hub-logo.png` },
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

function renderGeneratedDetail(collection, item) {
  const labels = { services: 'Service', partners: 'Strategic Partner', caseStudies: 'Case Study', blogs: 'Insight', jobs: 'Career Opportunity' };
  const sections = { services: 'Services', partners: 'Partners', caseStudies: 'Case Studies', blogs: 'Blogs & Insights', jobs: 'Careers' };
  const sectionPaths = { services: '/#services', partners: '/partners/', caseStudies: '/cases/', blogs: '/blogs/', jobs: '/careers/' };
  const name = item.title || item.name;
  const href = publicItemHref(collection, item);
  const canonical = absolutePublicUrl(href);
  const imagePath = item.image ? `/${String(item.image).replace(/^\/+/, '')}` : '/assets/blog/transformation.jpg';
  const imageUrl = absolutePublicUrl(imagePath);
  const schema = generatedDetailSchema(collection, item, canonical, imageUrl);
  const meta = [item.department, item.type, item.location, item.categoryLabel, item.metric].filter(Boolean);
  const ctaHref = collection === 'jobs' ? `/careers/apply.html?role=${encodeURIComponent(name)}` : '/get-in-touch.html';
  const ctaText = collection === 'jobs' ? 'Apply now' : 'Talk to our team';
  const ogType = collection === 'blogs' || collection === 'caseStudies' ? 'article' : 'website';
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
<link rel="stylesheet" href="/css/service-page.css" />
<link rel="stylesheet" href="/css/hub-pages.css" />
<link rel="stylesheet" href="/css/responsive.css" />
<style>
.generated-detail-main{padding:clamp(130px,16vw,190px) 0 90px;min-height:75vh}.generated-detail-card{max-width:920px;padding:clamp(28px,5vw,58px);border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(13,28,48,.78);box-shadow:0 24px 70px rgba(0,0,0,.28)}.generated-detail-card h1{max-width:19ch;margin:16px 0;font-size:clamp(34px,5vw,62px);line-height:1.08}.generated-detail-card>p{max-width:760px;color:var(--text-2);font-size:clamp(15px,1.7vw,19px);line-height:1.8}.generated-detail-meta{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.generated-detail-meta span{padding:8px 12px;border:1px solid rgba(54,176,229,.22);border-radius:999px;background:rgba(54,176,229,.08);color:var(--text-2);font-size:12px}.generated-detail-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.generated-detail-back{display:inline-flex;align-items:center;gap:7px;color:var(--blue-light);text-decoration:none;font-weight:600}.generated-detail-back:hover{text-decoration:underline}
</style>
</head>
<body class="page-hub page-generated-detail">
<div class="site-bg" aria-hidden="true"><div class="site-grid"></div></div>
<nav class="nav" id="nav" aria-label="Primary"><div class="nav-inner glass-surface"><a href="/" class="brand" aria-label="Digital Hub home"><img class="brand-logo" src="/assets/digital-hub-logo.png" alt="Digital Hub" decoding="async"></a><ul class="nav-links"><li><a class="nav-link" href="/#services">Services</a></li><li><a class="nav-link" href="/partners/">Partners</a></li><li><a class="nav-link" href="/cases/">Case Studies</a></li><li><a class="nav-link" href="/blogs/">Blogs</a></li><li><a class="nav-link" href="/careers/">Careers</a></li></ul><a class="nav-cta" href="/get-in-touch.html">Get in Touch <i class="ti ti-arrow-right"></i></a></div></nav>
<main class="generated-detail-main"><section class="section-inner"><article class="generated-detail-card"><a class="generated-detail-back" href="${sectionPaths[collection]}"><i class="ti ti-arrow-left"></i> ${sections[collection]}</a><span class="label" style="display:block;margin-top:28px">${labels[collection]}</span><h1>${htmlEscape(name)}</h1><p>${htmlEscape(item.summary)}</p>${meta.length ? `<div class="generated-detail-meta">${meta.map((value) => `<span>${htmlEscape(value)}</span>`).join('')}</div>` : ''}<div class="generated-detail-actions"><a class="btn-primary" href="${htmlEscape(ctaHref)}">${ctaText} <i class="ti ti-arrow-right"></i></a></div></article></section></main>
<footer class="footer"><div class="section-inner"><div class="footer-bottom"><span>&copy; ${new Date().getFullYear()} Digital Hub S.A.E. All rights reserved.</span><a href="/">Digital Hub</a></div></div></footer>
<script src="/js/shared.js"></script><script src="/js/nav-stay-on-page.js"></script>
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
  if (pathname === '/') pathname = '/index.html';
  if (/^\/content\/(?:admin-|job-applications|contact-requests|application-files(?:\/|$))/i.test(pathname)) {
    return sendBuffer(req, res, 404, '<h1>404</h1><p>Page not found.</p>', {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  }
  let target = path.resolve(ROOT, `.${pathname}`);
  if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
    return sendBuffer(req, res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
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
  }
  if (!path.extname(target) && fs.existsSync(`${target}.html`)) {
    res.writeHead(308, {
      Location: `${pathname}.html${url.search || ''}`,
      'Cache-Control': 'no-store',
    });
    return res.end();
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    const generated = findGeneratedDetail(pathname);
    if (generated) {
      return sendBuffer(req, res, 200, renderGeneratedDetail(generated.collection, generated.item), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
    }
    return sendBuffer(req, res, 404, '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Page not found | Digital Hub</title></head><body><h1>404</h1><p>Page not found.</p></body></html>', {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  }
  const type = mime[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const noCache = target === PUBLIC_JS_FILE || target === PUBLIC_JSON_FILE || pathname.startsWith('/admin');
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
  if (pathname.startsWith('/admin')) headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
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
    if (requestHost === 'digitalhub.com.eg') {
      res.writeHead(308, { Location: `${SITE_URL}${url.pathname}${url.search}`, 'Cache-Control': 'public, max-age=86400' });
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

server.listen(PORT, HOST, () => {
  console.log(`Digital Hub CMS running at http://${HOST}:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.log('Development login: admin / DigitalHub@2026 (set ADMIN_PASSWORD before production)');
});
