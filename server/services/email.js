const fs = require('fs');
const path = require('path');

async function getGraphToken(tenantId, clientId, clientSecret) {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  });
  const res = await fetch(url, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`Graph token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function sendViaGraph({ tenantId, clientId, clientSecret, fromAddress, to, subject, htmlBody, attachments }) {
  const token = await getGraphToken(tenantId, clientId, clientSecret);
  const emailPayload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
      ccRecipients: cc ? [{ emailAddress: { address: cc } }] : [],
      attachments: (attachments || []).map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: 'application/pdf',
        contentBytes: fs.existsSync(att.path) ? fs.readFileSync(att.path).toString('base64') : ''
      }))
    },
    saveToSentItems: true
  };
  const url = `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailPayload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph sendMail error: ${res.status} ${err}`);
  }
  return { ok: true };
}

async function sendViaSmtp({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, fromAddress, fromName, to, cc, subject, htmlBody, attachments }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || 587),
    secure: smtpSecure === 'true' || smtpPort === '465',
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined
  });
  const mailOptions = {
    from: `${fromName} <${fromAddress}>`,
    to, subject,
    html: htmlBody,
    attachments: (attachments || []).filter(a => fs.existsSync(a.path)).map(a => ({
      filename: a.filename,
      path: a.path
    }))
  };
  await transporter.sendMail(mailOptions);
  return { ok: true };
}

async function sendDevEmail({ to, subject, htmlBody, attachments, practiceName }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  const info = await transporter.sendMail({
    from: practiceName, to, subject, html: htmlBody,
    attachments: (attachments || []).filter(a => fs.existsSync(a.path)).map(a => ({ filename: a.filename, path: a.path }))
  });
  const dir = path.join(__dirname, '..', '..', 'pdfs', 'emails');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `email_${Date.now()}_${to.replace(/[^a-z0-9]/gi, '_')}.json`);
  fs.writeFileSync(file, info.message);
  console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject} | Saved: ${file}`);
  return { ok: true, devFile: file };
}

async function dispatchEmail({ settings, to, cc, subject, htmlBody, attachments }) {
  const method = settings.email_method || 'dev';
  const practiceName = settings.practice_name || "'t Hart";

  if (method === 'graph') {
    return sendViaGraph({
      tenantId: settings.graph_tenant_id,
      clientId: settings.graph_client_id,
      clientSecret: settings.graph_client_secret,
      fromAddress: settings.practice_email,
      to, subject, htmlBody, attachments
    });
  }
  if (method === 'smtp') {
    return sendViaSmtp({
      smtpHost: settings.smtp_host,
      smtpPort: settings.smtp_port,
      smtpUser: settings.smtp_user,
      smtpPass: settings.smtp_pass,
      smtpSecure: settings.smtp_secure,
      fromAddress: settings.practice_email,
      fromName: practiceName,
      to, cc, subject, htmlBody, attachments
    });
  }
  // Default: dev mode (save to file)
  return sendDevEmail({ to, subject, htmlBody, attachments, practiceName });
}

async function sendAgreementEmail({ client, pdfPath, settings }) {
  const subject = `Uitleenovereenkomst bevallingsbad — ${settings.practice_name}`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#237062;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">${settings.practice_name}</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Beste ${client.name},</p>
        <p style="margin-top:12px">Bijgevoegd vindt u de uitleenovereenkomst voor het bevallingsbad.</p>
        <p style="margin-top:12px">Bewaar dit document goed. Bij ophalen kunt u eventuele vragen stellen aan de praktijkassistente.</p>
        <p style="margin-top:20px;color:#666;font-size:12px">Met vriendelijke groet,<br><strong>${settings.practice_name}</strong></p>
      </div>
    </div>`;
  const attachments = pdfPath ? [{ filename: 'Uitleenovereenkomst.pdf', path: pdfPath }] : [];
  return dispatchEmail({ settings, to: client.email, subject, htmlBody, attachments });
}

async function sendInvoiceEmail({ client, pdfPath, settings }) {
  const subject = `Factuur bevallingsbad — ${settings.practice_name}`;
  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#237062;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">${settings.practice_name}</h2>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px">
        <p>Beste ${client.name},</p>
        <p style="margin-top:12px">Bijgevoegd vindt u de factuur voor de huur van het bevallingsbad.</p>
        <p style="margin-top:20px;color:#666;font-size:12px">Met vriendelijke groet,<br><strong>${settings.practice_name}</strong></p>
      </div>
    </div>`;
  const attachments = pdfPath ? [{ filename: 'Factuur.pdf', path: pdfPath }] : [];
  return dispatchEmail({ settings, to: client.email, subject, htmlBody, attachments });
}

module.exports = { dispatchEmail, sendAgreementEmail, sendInvoiceEmail };
