'use strict';

const path = require('path');
const mail = require('../lib/mail');

mail.loadEmailTemplates(true);
const result = mail.writeInterviewEmailFixtures();
console.log(JSON.stringify({
  ok: true,
  dir: path.relative(path.join(__dirname, '..'), result.dir),
  files: result.files,
  scheduleSubject: result.scheduleSubject,
  bookingSubject: result.bookingSubject,
}, null, 2));
