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
 *
 * Edit interview email design / copy in:
 *   lib/email-templates/interview-layout.html
 *   lib/email-templates/copy.json
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const MAIL_TZ = process.env.MAIL_TZ || 'Africa/Cairo';
const TEMPLATE_DIR = path.join(__dirname, 'email-templates');
const LOGO_FILE = path.join(__dirname, '..', 'assets', 'digital-hub-logo.png');
const LOGO_CID = 'dh-logo@digitalhub.com.eg';
let warnedDisabled = false;
let transporter = null;
let templateCache = null;
let logoAttachmentCache = undefined;

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

function loadLogoCidAttachment(force) {
  if (logoAttachmentCache !== undefined && !force) return logoAttachmentCache;
  try {
    if (!fs.existsSync(LOGO_FILE)) {
      logoAttachmentCache = null;
      return logoAttachmentCache;
    }
    const content = fs.readFileSync(LOGO_FILE);
    if (!content || !content.length) {
      logoAttachmentCache = null;
      return logoAttachmentCache;
    }
    logoAttachmentCache = {
      filename: 'digital-hub-logo.png',
      content,
      cid: LOGO_CID,
      contentType: 'image/png',
      contentDisposition: 'inline',
    };
    return logoAttachmentCache;
  } catch (_) {
    logoAttachmentCache = null;
    return logoAttachmentCache;
  }
}

function resolveLogoSrc({ siteUrl, baseUrl, embedCid }) {
  if (embedCid) {
    const logo = loadLogoCidAttachment();
    if (logo) return `cid:${LOGO_CID}`;
  }
  const explicit = envFirst('MAIL_LOGO_URL');
  if (explicit) return explicit;
  // Prefer request/base URL so local preview can load /assets from the running CMS.
  const origin = String(baseUrl || siteUrl || 'https://digitalhub.com.eg').replace(/\/$/, '');
  return `${origin}/assets/digital-hub-logo.png`;
}

function stripHtmlComments(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

function loadEmailTemplates(force) {
  if (templateCache && !force) return templateCache;
  templateCache = {
    layout: stripHtmlComments(fs.readFileSync(path.join(TEMPLATE_DIR, 'interview-layout.html'), 'utf8')),
    copy: JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'copy.json'), 'utf8')),
  };
  return templateCache;
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

function detailCell(label, valueHtml, { first, last, strong } = {}) {
  // Stacked label-above-value: stays readable at ~320px without media queries.
  const padTop = first ? '14px' : '10px';
  const padBottom = last ? '14px' : '10px';
  const border = first ? '' : 'border-top:1px solid #E2E3E4;';
  const rowRuleClass = first ? '' : ' dh-row-rule';
  const valueSize = strong ? '16px' : '14px';
  const valueWeight = strong ? '700' : '500';
  return (
    `<tr>` +
    `<td class="${rowRuleClass.trim()}" style="padding:${padTop} 16px ${padBottom};${border}">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">` +
    `<tr><td class="dh-label" style="padding:0 0 3px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6B6B6B;">${label}</td></tr>` +
    `<tr><td class="dh-value" style="padding:0;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:${valueSize};font-weight:${valueWeight};line-height:1.35;color:#1A1A1A;"><span class="dh-value" style="color:#1A1A1A;">${valueHtml}</span></td></tr>` +
    `</table>` +
    `</td>` +
    `</tr>`
  );
}

function buildSummaryBlock(audience, vars) {
  // 2-second hierarchy: primary who, then when, then what (stage · role / interviewer).
  const primary = audience === 'candidate' ? vars.role : vars.candidate;
  const secondary = audience === 'candidate'
    ? `${vars.stage} · ${vars.format} · with ${vars.interviewer_display}`
    : `${vars.stage} · ${vars.role} · ${vars.format}`;
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">` +
    `<tr>` +
    `<td style="padding:0 0 0 12px;border-left:3px solid #F4970B;">` +
    `<p class="dh-value" style="margin:0 0 6px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.25;color:#1A1A1A;">${primary}</p>` +
    `<p class="dh-primary" style="margin:0 0 4px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;line-height:1.35;color:#1270A0;">${vars.when}</p>` +
    `<p class="dh-muted" style="margin:0;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;font-weight:400;line-height:1.4;color:#5A5A5A;">${secondary}</p>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
}

function buildInterviewDetailRows(audience, vars) {
  const meetingRow = vars.meeting_link_html
    ? [detailCell('Meeting link', vars.meeting_link_html, { strong: true })]
    : [];
  if (audience === 'candidate') {
    return [
      detailCell('Role', vars.role, { first: true, strong: true }),
      detailCell('Stage', vars.stage),
      detailCell('When', vars.when, { strong: true }),
      detailCell('Format', vars.format),
      ...meetingRow,
      detailCell('Interviewer', vars.interviewer_display, { last: true, strong: true }),
    ].join('');
  }
  return [
    detailCell('Candidate', vars.candidate, { first: true, strong: true }),
    detailCell('Role', vars.role),
    detailCell('Stage', vars.stage),
    detailCell('When', vars.when, { strong: true }),
    detailCell('Format', vars.format),
    ...meetingRow,
    detailCell(
      'Email',
      `<a class="dh-link" href="mailto:${vars.candidate_email}" style="color:#1270A0;text-decoration:none;">${vars.candidate_email}</a>`,
    ),
    detailCell('Phone', vars.candidate_phone, { last: true }),
  ].join('');
}

function formatInterviewerDisplay(round) {
  const name = String((round && round.interviewer) || '').trim() || 'Interviewer';
  const title = String((round && round.interviewerTitle) || '').trim();
  return title ? `${name} · ${title}` : name;
}

function meetingLinkOf(round) {
  if (!round || round.format === 'onsite') return '';
  const link = String(round.meetingLink || '').trim();
  if (!/^https?:\/\/\S+$/i.test(link)) return '';
  return link;
}

function interviewEmailBodies({ kind, audience, application, round, when, baseUrl, embedLogo }) {
  const templates = loadEmailTemplates();
  const forCandidate = audience === 'candidate';
  const copyRoot = forCandidate ? templates.copy.candidate : templates.copy.interviewer;
  const copy = copyRoot[kind === 'reminder' ? 'reminder' : 'schedule'] || {};
  const candidate = application.fullName || 'Candidate';
  const role = application.role || 'Role';
  const stage = round.label || 'Interview';
  const format = round.format === 'onsite' ? 'Onsite' : 'Online';
  const interviewer = round.interviewer || 'Interviewer';
  const interviewerDisplay = formatInterviewerDisplay(round);
  const meetingLink = meetingLinkOf(round);
  const whenLabel = when
    ? `${formatInZone(when, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ${zonedHm(when).label}`
    : 'TBD';
  const timeLabel = when ? zonedHm(when).label : 'TBD';
  const portal = baseUrl ? `${baseUrl}/admin/#hrPortal` : '/admin/#hrPortal';
  const siteUrl = (envFirst('PUBLIC_SITE_URL', 'PUBLIC_BASE_URL', 'APP_BASE_URL') || 'https://digitalhub.com.eg').replace(/\/$/, '');
  const logoUrl = resolveLogoSrc({ siteUrl, baseUrl, embedCid: Boolean(embedLogo) });

  const vars = {
    candidate: escapeHtml(candidate),
    role: escapeHtml(role),
    stage: escapeHtml(stage),
    when: escapeHtml(whenLabel),
    time: escapeHtml(timeLabel),
    format: escapeHtml(format),
    interviewer: escapeHtml(interviewer),
    interviewer_display: escapeHtml(interviewerDisplay),
    meeting_link: escapeHtml(meetingLink),
    meeting_link_html: meetingLink
      ? `<a class="dh-link" href="${escapeHtml(meetingLink)}" style="color:#1270A0;text-decoration:none;word-break:break-all;">${escapeHtml(meetingLink)}</a>`
      : '',
    meeting_link_block: meetingLink ? `Meeting link:\n${meetingLink}\n` : '',
    candidate_email: escapeHtml(application.email || '—'),
    candidate_phone: escapeHtml(application.phone || '—'),
    portal: escapeHtml(portal),
    site_url: escapeHtml(siteUrl),
    logo_url: escapeHtml(logoUrl),
    eyebrow: escapeHtml(copy.eyebrow || ''),
  };

  // intro / subject may include intentional HTML (<strong>) or {{placeholders}}
  vars.intro = renderTemplate(copy.intro || '', vars);
  const footerLabel = renderTemplate(copyRoot.footerHtml || '', vars).trim();
  // Candidate: closing copy. Interviewer: no pipeline CTA.
  vars.footer = forCandidate ? footerLabel : '';
  vars.footer_block = vars.footer
    ? (
      `<tr>` +
      `<td class="dh-surface dh-text" style="padding:18px 28px 28px;background-color:#FFFFFF;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1A1A1A;">` +
      vars.footer +
      `</td>` +
      `</tr>`
    )
    : (
      `<tr>` +
      `<td class="dh-surface" style="padding:0 0 28px;background-color:#FFFFFF;font-size:0;line-height:0;">&nbsp;</td>` +
      `</tr>`
    );
  vars.summary_block = buildSummaryBlock(forCandidate ? 'candidate' : 'interviewer', vars);
  vars.detail_rows = buildInterviewDetailRows(forCandidate ? 'candidate' : 'interviewer', vars);

  const subject = renderTemplate(copy.subject || 'Interview update', {
    candidate,
    role,
    stage,
    when: whenLabel,
    time: timeLabel,
    format,
    interviewer,
    interviewer_display: interviewerDisplay,
  });

  const plainVars = {
    candidate,
    role,
    stage,
    when: whenLabel,
    time: timeLabel,
    format,
    interviewer,
    interviewer_display: interviewerDisplay,
    meeting_link: meetingLink,
    meeting_link_block: meetingLink ? `Meeting link:\n${meetingLink}\n` : '',
    candidate_email: application.email || '—',
    candidate_phone: application.phone || '—',
    portal,
    site_url: siteUrl,
    logo_url: logoUrl,
    eyebrow: copy.eyebrow || '',
  };
  const text = copy.text
    ? renderTemplate(copy.text, plainVars).replace(/\r\n/g, '\n').trim() + '\n'
    : '';

  /* The document title mirrors the subject so the layout is not tied to one
     kind of message. Not shown by mail clients, but it is what a browser or a
     "view in browser" link displays. */
  vars.title = escapeHtml(subject);
  const html = renderTemplate(templates.layout, vars);
  return { subject, html, text };
}

function interviewCalendarAttachment(application, round, when) {
  const start = when && !Number.isNaN(when.getTime()) ? when : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const meetingLink = meetingLinkOf(round);
  const ics = buildIcs({
    uid: `${round.id || 'interview'}@digitalhub.com.eg`,
    start,
    end,
    summary: `Interview: ${application.fullName || 'Candidate'} (${round.label || 'Round'})`,
    description: `${application.role || ''}\\n${application.email || ''}\\n${application.phone || ''}\\nInterviewer: ${formatInterviewerDisplay(round)}${meetingLink ? `\\nMeeting: ${meetingLink}` : ''}`,
    location: meetingLink || (round.format === 'onsite' ? 'Onsite' : 'Online'),
  });
  return {
    filename: 'interview.ics',
    content: ics,
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  };
}

function aggregateSideResults(sides) {
  const sentSides = sides.filter((entry) => entry.sent);
  return {
    sent: sentSides.length > 0,
    skipped: sides.length > 0 && sides.every((entry) => entry.skipped),
    failed: sides.some((entry) => !entry.sent && !entry.skipped),
    sides,
    to: sentSides.flatMap((entry) => entry.to || []),
  };
}

async function sendInterviewEmailsToBothSides({ kind, application, round, baseUrl, includeCalendar }) {
  const when = round.scheduledAt ? new Date(round.scheduledAt) : null;
  const logo = loadLogoCidAttachment();
  const attachments = [];
  if (logo) attachments.push(logo);
  if (includeCalendar) attachments.push(interviewCalendarAttachment(application, round, when));
  const mailAttachments = attachments.length ? attachments : undefined;
  const sides = [];

  const interviewerTo = String(round.interviewerEmail || '').trim();
  if (interviewerTo) {
    const { subject, html, text } = interviewEmailBodies({
      kind,
      audience: 'interviewer',
      application,
      round,
      when,
      baseUrl,
      embedLogo: Boolean(logo),
    });
    const outcome = await sendMail({
      to: interviewerTo,
      cc: hrNotifyEmails(),
      subject,
      html,
      text,
      attachments: mailAttachments,
    });
    sides.push(Object.assign({ side: 'interviewer' }, outcome));
  } else {
    sides.push({ side: 'interviewer', sent: false, skipped: true, reason: 'no_interviewer_email' });
  }

  const candidateTo = String(application.email || '').trim();
  if (candidateTo) {
    const { subject, html, text } = interviewEmailBodies({
      kind,
      audience: 'candidate',
      application,
      round,
      when,
      baseUrl,
      embedLogo: Boolean(logo),
    });
    const outcome = await sendMail({
      to: candidateTo,
      subject,
      html,
      text,
      attachments: mailAttachments,
    });
    sides.push(Object.assign({ side: 'candidate' }, outcome));
  } else {
    sides.push({ side: 'candidate', sent: false, skipped: true, reason: 'no_candidate_email' });
  }

  return aggregateSideResults(sides);
}

async function sendInterviewScheduleEmail({ application, round, baseUrl }) {
  return sendInterviewEmailsToBothSides({
    kind: 'schedule',
    application,
    round,
    baseUrl,
    includeCalendar: true,
  });
}

async function sendInterviewReminderEmail({ application, round, baseUrl }) {
  return sendInterviewEmailsToBothSides({
    kind: 'reminder',
    application,
    round,
    baseUrl,
    includeCalendar: false,
  });
}

const ROLE_LABELS = {
  hr: 'HR',
  marketing: 'Marketing',
  interviewer: 'Interviewer',
  admin: 'Administrator',
};

function roleLabel(role) {
  return ROLE_LABELS[String(role || '').toLowerCase()] || 'Digital Hub';
}

/**
 * Invite mail for a new account. Uses the same shared layout, brand colours and
 * CID logo as the interview mails so every message from the system looks alike.
 *
 * `inviteUrl` carries a live, single-use token, so it appears in the message
 * body only — never logged, never echoed by any listing endpoint.
 */
function accountInviteBodies({ account, inviteUrl, expiresAt, baseUrl, embedLogo }) {
  const templates = loadEmailTemplates();
  const label = roleLabel(account.role);
  const name = String(account.name || account.username || '').trim();
  const username = String(account.username || '').trim();
  const expires = expiresAt && !Number.isNaN(Date.parse(expiresAt))
    ? `${formatInZone(new Date(expiresAt), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ${zonedHm(new Date(expiresAt)).label}`
    : '';
  const siteUrl = (envFirst('PUBLIC_SITE_URL', 'PUBLIC_BASE_URL', 'APP_BASE_URL') || 'https://digitalhub.com.eg').replace(/\/$/, '');
  const logoUrl = resolveLogoSrc({ siteUrl, baseUrl, embedCid: Boolean(embedLogo) });

  const button =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td bgcolor="#1270A0" style="background-color:#1270A0;border-radius:999px;">` +
    `<a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:13px 26px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Set your password</a>` +
    `</td></tr></table>`;

  const summaryBlock =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">` +
    `<tr><td style="padding:0 0 0 12px;border-left:3px solid #F4970B;">` +
    `<p class="dh-value" style="margin:0 0 6px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.25;color:#1A1A1A;">${escapeHtml(name)}</p>` +
    `<p class="dh-primary" style="margin:0 0 4px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;line-height:1.35;color:#1270A0;">${escapeHtml(label)} account</p>` +
    `<p class="dh-muted" style="margin:0;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;font-weight:400;line-height:1.4;color:#5A5A5A;">Digital Hub workspace</p>` +
    `</td></tr></table>`;

  const rows = [
    detailCell('Username', escapeHtml(username), { first: true, strong: true }),
    detailCell('Set your password', button),
  ];
  if (expires) rows.push(detailCell('Link expires', escapeHtml(expires)));
  rows.push(detailCell('Link', `<a class="dh-link" href="${escapeHtml(inviteUrl)}" style="color:#1270A0;text-decoration:none;word-break:break-all;">${escapeHtml(inviteUrl)}</a>`, { last: true }));

  const footerBlock =
    `<tr><td class="dh-surface dh-text" style="padding:18px 28px 28px;background-color:#FFFFFF;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1A1A1A;">` +
    `<span class="dh-muted" style="color:#5A5A5A;">The link can be used once. If you were not expecting this, you can ignore this message.</span>` +
    `</td></tr>`;

  const vars = {
    eyebrow: escapeHtml(`${label} account setup`),
    intro: `An administrator has created a Digital Hub <strong>${escapeHtml(label)}</strong> account for you. Choose a password to finish setting it up, then sign in with your username.`,
    summary_block: summaryBlock,
    detail_rows: rows.join(''),
    footer_block: footerBlock,
    site_url: escapeHtml(siteUrl),
    logo_url: escapeHtml(logoUrl),
  };

  const subject = `Set up your Digital Hub ${label} account`;
  const text = [
    `Hi ${name},`,
    '',
    `An administrator has created a Digital Hub ${label} account for you.`,
    `Username: ${username}`,
    '',
    'Set your password:',
    inviteUrl,
    expires ? `This link expires on ${expires} and can be used once.` : 'This link can be used once.',
    '',
    'If you were not expecting this, you can ignore this message.',
  ].filter(Boolean).join('\n') + '\n';

  vars.title = escapeHtml(subject);
  return { subject, html: renderTemplate(templates.layout, vars), text };
}

function bookingInvitationBodies({
  application,
  round,
  bookingUrl,
  expiresAt,
  baseUrl,
  embedLogo,
  kind = 'booking',
}) {
  const templates = loadEmailTemplates();
  const isReminder = kind === 'bookingReminder';
  const copy = (templates.copy.candidate && templates.copy.candidate[isReminder ? 'bookingReminder' : 'booking']) || {};
  const candidate = application.fullName || 'Candidate';
  const role = application.role || 'Role';
  const stage = (round && round.label) || 'Interview';
  const interviewerDisplay = formatInterviewerDisplay(round);
  const expires = expiresAt && !Number.isNaN(Date.parse(expiresAt))
    ? `${formatInZone(new Date(expiresAt), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} ${zonedHm(new Date(expiresAt)).label}`
    : '';
  const siteUrl = (envFirst('PUBLIC_SITE_URL', 'PUBLIC_BASE_URL', 'APP_BASE_URL') || 'https://digitalhub.com.eg').replace(/\/$/, '');
  const logoUrl = resolveLogoSrc({ siteUrl, baseUrl, embedCid: Boolean(embedLogo) });
  const button = isReminder || !bookingUrl
    ? ''
    : (
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td bgcolor="#1270A0" style="background-color:#1270A0;border-radius:999px;">` +
      `<a href="${escapeHtml(bookingUrl)}" style="display:inline-block;padding:13px 26px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;">Choose a time</a>` +
      `</td></tr></table>`
    );

  const vars = {
    candidate: escapeHtml(candidate),
    role: escapeHtml(role),
    stage: escapeHtml(stage),
    interviewer_display: escapeHtml(interviewerDisplay),
    booking_url: escapeHtml(bookingUrl || ''),
    expires: escapeHtml(expires),
    site_url: escapeHtml(siteUrl),
    logo_url: escapeHtml(logoUrl),
    eyebrow: escapeHtml(copy.eyebrow || (isReminder ? 'Careers · Booking reminder' : 'Careers · Book your interview')),
  };
  vars.intro = renderTemplate(copy.intro || '', vars);
  vars.summary_block = (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">` +
    `<tr>` +
    `<td style="padding:0 0 0 12px;border-left:3px solid #F4970B;">` +
    `<p class="dh-value" style="margin:0 0 6px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.25;color:#1A1A1A;">${vars.role}</p>` +
    `<p class="dh-primary" style="margin:0 0 4px;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;line-height:1.35;color:#1270A0;">${isReminder ? 'Please book your interview time' : 'Choose your interview time'}</p>` +
    `<p class="dh-muted" style="margin:0;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;font-weight:400;line-height:1.4;color:#5A5A5A;">${vars.stage} · with ${vars.interviewer_display}</p>` +
    `</td>` +
    `</tr>` +
    `</table>`
  );
  vars.detail_rows = [
    detailCell('Role', vars.role, { first: true, strong: true }),
    detailCell('Stage', vars.stage),
    detailCell('Interviewer', vars.interviewer_display, { strong: true }),
    isReminder
      ? detailCell('Next step', 'Please use the booking link in the email we sent you.')
      : detailCell('Book a time', button),
    detailCell('Link expires', vars.expires || '—', { last: true }),
  ].join('');
  vars.footer_block =
    `<tr>` +
    `<td class="dh-surface dh-text" style="padding:18px 28px 28px;background-color:#FFFFFF;font-family:Poppins,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1A1A1A;">` +
    (isReminder
      ? 'If you cannot find the original email, reply to this message and our HR team will send a new link.'
      : (templates.copy.candidate.footerHtml || '')) +
    `</td>` +
    `</tr>`;

  const subject = renderTemplate(copy.subject || (isReminder
    ? 'Reminder: choose your Digital Hub interview time'
    : 'Choose your interview time at Digital Hub'), {
    candidate,
    role,
    stage,
    interviewer_display: interviewerDisplay,
    expires,
  });
  const text = copy.text
    ? renderTemplate(copy.text, {
      candidate,
      role,
      stage,
      interviewer_display: interviewerDisplay,
      booking_url: bookingUrl || '',
      expires,
      site_url: siteUrl,
      eyebrow: copy.eyebrow || '',
    }).replace(/\r\n/g, '\n').trim() + '\n'
    : '';
  vars.title = escapeHtml(subject);
  return { subject, html: renderTemplate(templates.layout, vars), text };
}

async function sendBookingInvitationEmail({ application, round, bookingUrl, expiresAt, baseUrl }) {
  const to = String((application && application.email) || '').trim();
  if (!to) return { sent: false, skipped: true, reason: 'no_candidate_email' };
  const logo = loadLogoCidAttachment();
  const bodies = bookingInvitationBodies({
    application,
    round,
    bookingUrl,
    expiresAt,
    baseUrl,
    embedLogo: Boolean(logo),
  });
  return sendMail({
    to,
    subject: bodies.subject,
    html: bodies.html,
    text: bodies.text,
    attachments: logo ? [logo] : undefined,
  });
}

async function sendBookingReminderEmail({ application, round, expiresAt, baseUrl }) {
  const to = String((application && application.email) || '').trim();
  if (!to) return { sent: false, skipped: true, reason: 'no_candidate_email' };
  const logo = loadLogoCidAttachment();
  const bodies = bookingInvitationBodies({
    application,
    round,
    bookingUrl: '',
    expiresAt,
    baseUrl,
    embedLogo: Boolean(logo),
    kind: 'bookingReminder',
  });
  return sendMail({
    to,
    subject: bodies.subject,
    html: bodies.html,
    text: bodies.text,
    attachments: logo ? [logo] : undefined,
  });
}

function sampleInterviewPreviewData() {
  return {
    application: {
      fullName: 'Sara Hassan',
      role: 'Senior Backend Engineer',
      email: 'sara.hassan@example.com',
      phone: '+20 100 000 0000',
    },
    round: {
      label: 'Technical',
      format: 'online',
      meetingLink: 'https://meet.google.com/abc-defg-hij',
      interviewer: 'Omar Farid',
      interviewerTitle: 'Engineering Manager',
      interviewerEmail: 'interviewer@digitalhub.com.eg',
      scheduledAt: '2026-08-21T11:00:00',
    },
    expiresAt: '2026-09-07T21:00:00.000Z',
    bookingUrl: 'https://digitalhub.com.eg/book/?k=sample-not-a-real-token',
  };
}

function writeInterviewEmailFixtures(dir) {
  const target = dir || path.join(TEMPLATE_DIR, 'fixtures');
  fs.mkdirSync(target, { recursive: true });
  const sample = sampleInterviewPreviewData();
  const when = new Date(sample.round.scheduledAt);
  const schedule = interviewEmailBodies({
    kind: 'schedule',
    audience: 'candidate',
    application: sample.application,
    round: sample.round,
    when,
    baseUrl: 'https://digitalhub.com.eg',
    embedLogo: false,
  });
  const booking = bookingInvitationBodies({
    application: sample.application,
    round: sample.round,
    bookingUrl: sample.bookingUrl,
    expiresAt: sample.expiresAt,
    baseUrl: 'https://digitalhub.com.eg',
    embedLogo: false,
  });
  const reminder = bookingInvitationBodies({
    application: sample.application,
    round: sample.round,
    bookingUrl: '',
    expiresAt: sample.expiresAt,
    baseUrl: 'https://digitalhub.com.eg',
    embedLogo: false,
    kind: 'bookingReminder',
  });
  fs.writeFileSync(path.join(target, 'candidate-schedule.html'), schedule.html);
  fs.writeFileSync(path.join(target, 'candidate-booking.html'), booking.html);
  fs.writeFileSync(path.join(target, 'candidate-booking-reminder.html'), reminder.html);
  return {
    dir: target,
    files: ['candidate-schedule.html', 'candidate-booking.html', 'candidate-booking-reminder.html'],
    scheduleSubject: schedule.subject,
    bookingSubject: booking.subject,
    reminderSubject: reminder.subject,
  };
}

async function sendAccountInviteEmail({ account, inviteUrl, expiresAt, baseUrl }) {
  const to = String((account && account.email) || '').trim();
  if (!to) return { sent: false, skipped: true, reason: 'no_recipients' };
  const logo = loadLogoCidAttachment();
  const bodies = accountInviteBodies({ account, inviteUrl, expiresAt, baseUrl, embedLogo: Boolean(logo) });
  return sendMail({
    to,
    subject: bodies.subject,
    html: bodies.html,
    text: bodies.text,
    attachments: logo ? [logo] : undefined,
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
  sendAccountInviteEmail,
  sendBookingInvitationEmail,
  sendBookingReminderEmail,
  accountInviteBodies,
  bookingInvitationBodies,
  writeInterviewEmailFixtures,
  sampleInterviewPreviewData,
  roleLabel,
  interviewEmailBodies,
  loadEmailTemplates,
  loadLogoCidAttachment,
  zonedYmd,
  zonedHm,
};
