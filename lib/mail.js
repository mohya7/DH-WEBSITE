'use strict';

/**
 * Internal mail helper (Amazon SES SMTP via nodemailer).
 *
 * Preferred Amazon / SES env (EC2, Elastic Beanstalk, etc.):
 *   MAIL_ENABLED=true|false
 *   AWS_REGION or SES_REGION          — e.g. eu-west-1 (builds SMTP host if SES_SMTP_HOST unset)
 *   SES_SMTP_HOST                    — optional override (default email-smtp.{region}.amazonaws.com)
 *   SES_SMTP_PORT                    — default 587
 *   SES_SMTP_USER                    — SES SMTP username
 *   SES_SMTP_PASS                    — SES SMTP password
 *   SES_FROM                         — verified From address (or "Name <email@domain>")
 *   HR_NOTIFY_EMAILS                 — comma-separated CC
 *   MAIL_TZ                          — default Africa/Cairo
 *   PUBLIC_BASE_URL                  — admin links in email bodies
 *
 * Legacy aliases still accepted: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const nodemailer = require('nodemailer');

const MAIL_TZ = process.env.MAIL_TZ || 'Africa/Cairo';
let warnedDisabled = false;
let transporter = null;

function envFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function sesRegion() {
  return envFirst('SES_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION') || 'eu-west-1';
}

function smtpHost() {
  const explicit = envFirst('SES_SMTP_HOST', 'SMTP_HOST');
  if (explicit) return explicit;
  const region = sesRegion();
  return region ? `email-smtp.${region}.amazonaws.com` : '';
}

function smtpPort() {
  return Number(envFirst('SES_SMTP_PORT', 'SMTP_PORT') || 587);
}

function smtpUser() {
  return envFirst('SES_SMTP_USER', 'SMTP_USER');
}

function smtpPass() {
  return envFirst('SES_SMTP_PASS', 'SMTP_PASS');
}

function smtpFrom() {
  return envFirst('SES_FROM', 'SMTP_FROM', 'MAIL_FROM');
}

function mailEnabled() {
  const flag = envFirst('MAIL_ENABLED', 'SES_ENABLED');
  if (flag) return flag.toLowerCase() === 'true' || flag === '1';
  // On Amazon hosts, treat SES as enabled when credentials + from are present.
  return Boolean(smtpUser() && smtpPass() && smtpFrom());
}

function smtpConfigured() {
  return Boolean(smtpHost() && smtpFrom() && smtpUser() && smtpPass());
}

function hrNotifyEmails() {
  return String(process.env.HR_NOTIFY_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function publicBaseUrl(fallbackHost) {
  const fromEnv = envFirst('PUBLIC_BASE_URL', 'APP_BASE_URL').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (fallbackHost) return `http://${fallbackHost}`;
  return '';
}

function getTransporter() {
  if (!mailEnabled() || !smtpConfigured()) return null;
  if (transporter) return transporter;
  const port = smtpPort();
  transporter = nodemailer.createTransport({
    host: smtpHost(),
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: smtpUser(),
      pass: smtpPass(),
    },
  });
  return transporter;
}

async function sendMail({ to, cc, subject, html, text, attachments }) {
  if (!mailEnabled() || !smtpConfigured()) {
    if (!warnedDisabled) {
      console.warn('[mail] Disabled or Amazon SES SMTP not configured (set SES_SMTP_USER / SES_SMTP_PASS / SES_FROM, and AWS_REGION or SES_SMTP_HOST).');
      warnedDisabled = true;
    }
    return { sent: false, skipped: true, reason: 'mail_disabled' };
  }
  const list = Array.isArray(to) ? to : [to];
  const recipients = list.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (!recipients.length) {
    return { sent: false, skipped: true, reason: 'no_recipients' };
  }
  const transport = getTransporter();
  if (!transport) {
    return { sent: false, skipped: true, reason: 'mail_disabled' };
  }
  const ccList = (Array.isArray(cc) ? cc : (cc ? [cc] : []))
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  try {
    await transport.sendMail({
      from: smtpFrom(),
      to: recipients.join(', '),
      cc: ccList.length ? ccList.join(', ') : undefined,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      attachments,
    });
    return { sent: true, skipped: false, to: recipients };
  } catch (error) {
    console.error('[mail] Send failed:', error.message || error);
    return { sent: false, skipped: false, error: error.message || 'Send failed' };
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInZone(date, options) {
  try {
    return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: MAIL_TZ }, options)).format(date);
  } catch (_) {
    return date.toISOString();
  }
}

function zonedYmd(date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: MAIL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

function zonedHm(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: MAIL_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === 'hour')?.value || '00';
    const minute = parts.find((part) => part.type === 'minute')?.value || '00';
    return { hour: Number(hour), minute: Number(minute), label: `${hour}:${minute}` };
  } catch (_) {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes(), label: date.toISOString().slice(11, 16) };
  }
}

function buildIcs({ uid, start, end, summary, description, location }) {
  const stamp = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Digital Hub//HR Interviews//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${String(summary || 'Interview').replace(/\n/g, ' ')}`,
    `DESCRIPTION:${String(description || '').replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${String(location).replace(/\n/g, ' ')}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}

function interviewEmailBodies({ kind, application, round, when, baseUrl }) {
  const candidate = application.fullName || 'Candidate';
  const role = application.role || 'Role';
  const stage = round.label || 'Interview';
  const format = round.format === 'onsite' ? 'Onsite' : 'Online';
  const whenLabel = when
    ? `${formatInZone(when, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ${zonedHm(when).label}`
    : 'TBD';
  const portal = baseUrl ? `${baseUrl}/admin/#hrPortal` : '/admin/#hrPortal';
  const isReminder = kind === 'reminder';
  const subject = isReminder
    ? `Reminder: interview today — ${candidate} at ${when ? zonedHm(when).label : 'TBD'}`
    : `Interview scheduled: ${candidate} — ${stage} (${whenLabel})`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#122033;line-height:1.5">
      <p>${isReminder ? 'Reminder: you have an interview <strong>today</strong>.' : 'An interview has been scheduled.'}</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px">
        <tr><td style="padding:4px 0;color:#5b6b7c">Candidate</td><td style="padding:4px 0"><strong>${escapeHtml(candidate)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">Role</td><td style="padding:4px 0">${escapeHtml(role)}</td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">Stage</td><td style="padding:4px 0">${escapeHtml(stage)}</td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">When</td><td style="padding:4px 0">${escapeHtml(whenLabel)}</td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">Format</td><td style="padding:4px 0">${escapeHtml(format)}</td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">Candidate email</td><td style="padding:4px 0">${escapeHtml(application.email || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#5b6b7c">Candidate phone</td><td style="padding:4px 0">${escapeHtml(application.phone || '—')}</td></tr>
      </table>
      <p style="margin-top:16px"><a href="${escapeHtml(portal)}">Open Active Hiring Process</a></p>
    </div>
  `;

  return { subject, html };
}

async function sendInterviewScheduleEmail({ application, round, baseUrl }) {
  const to = round.interviewerEmail || '';
  const when = round.scheduledAt ? new Date(round.scheduledAt) : null;
  const { subject, html } = interviewEmailBodies({
    kind: 'schedule',
    application,
    round,
    when,
    baseUrl,
  });
  const start = when && !Number.isNaN(when.getTime()) ? when : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const ics = buildIcs({
    uid: `${round.id || 'interview'}@digitalhub.com.eg`,
    start,
    end,
    summary: `Interview: ${application.fullName || 'Candidate'} (${round.label || 'Round'})`,
    description: `${application.role || ''}\\n${application.email || ''}\\n${application.phone || ''}`,
    location: round.format === 'onsite' ? 'Onsite' : 'Online',
  });
  return sendMail({
    to,
    cc: hrNotifyEmails(),
    subject,
    html,
    attachments: [{
      filename: 'interview.ics',
      content: ics,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    }],
  });
}

async function sendInterviewReminderEmail({ application, round, baseUrl }) {
  const to = round.interviewerEmail || '';
  const when = round.scheduledAt ? new Date(round.scheduledAt) : null;
  const { subject, html } = interviewEmailBodies({
    kind: 'reminder',
    application,
    round,
    when,
    baseUrl,
  });
  return sendMail({
    to,
    cc: hrNotifyEmails(),
    subject,
    html,
  });
}

module.exports = {
  MAIL_TZ,
  mailEnabled,
  smtpConfigured,
  hrNotifyEmails,
  publicBaseUrl,
  sendMail,
  sendInterviewScheduleEmail,
  sendInterviewReminderEmail,
  zonedYmd,
  zonedHm,
};
