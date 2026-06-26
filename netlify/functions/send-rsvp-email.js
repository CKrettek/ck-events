const { google } = require('googleapis');

exports.handler = async function(event) {

  if (event.httpMethod !== 'POST') {

    return { statusCode: 405, body: 'Method not allowed' };

  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

  const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

  if (!RESEND_API_KEY) return { statusCode: 500, body: 'Missing RESEND_API_KEY' };

  if (!GOOGLE_SHEET_ID) return { statusCode: 500, body: 'Missing GOOGLE_SHEET_ID' };

  if (!GOOGLE_SERVICE_ACCOUNT) return { statusCode: 500, body: 'Missing GOOGLE_SERVICE_ACCOUNT' };

  let data;

  try {

    data = JSON.parse(event.body || '{}');

  } catch {

    return { statusCode: 400, body: 'Invalid JSON' };

  }

  const name = data.name || 'Guest';

  const email = (data.email || '').trim().toLowerCase();

  const status = data.status === 'attending' ? 'attending' : 'declined';

  const guestCount = data.guest_count || 1;

  const dietary = data.dietary_requirements || 'None';

  try {

    await upsertRsvp({

      name,

      email,

      status,

      guestCount,

      dietary

    });

    const messages = [];

    messages.push(sendEmail({

      from: 'CK Events <onboarding@resend.dev>',

      to: ['krettek@hotmail.com'],

      subject: `New RSVP: ${name} — ${status}`,

      html: hostHtml({ name, email, status, guestCount, dietary })

    }, RESEND_API_KEY));

    if (email) {

      messages.push(sendEmail({

        from: 'CK Events <onboarding@resend.dev>',

        to: [email],

        subject: 'Thank you for your RSVP',

        html: guestHtml({ name, status, guestCount, dietary })

      }, RESEND_API_KEY));

    }

    const results = await Promise.all(messages);

    return {

      statusCode: 200,

      body: JSON.stringify({ ok: true, savedToSheet: true, results })

    };

  } catch (err) {

    console.error(err);

    return {

      statusCode: 500,

      body: JSON.stringify({ ok: false, error: err.message })

    };

  }

};

async function getSheetsClient() {

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({

    credentials,

    scopes: ['https://www.googleapis.com/auth/spreadsheets']

  });

  return google.sheets({ version: 'v4', auth });

}

async function upsertRsvp({ name, email, status, guestCount, dietary }) {

  const sheets = await getSheetsClient();

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const now = new Date().toISOString();

  const read = await sheets.spreadsheets.values.get({

    spreadsheetId,

    range: 'A:G'

  });

  const rows = read.data.values || [];

  const existingRowIndex = rows.findIndex((row, index) => {

    if (index === 0) return false;

    return String(row[2] || '').trim().toLowerCase() === email;

  });

  const values = [

    now,

    name,

    email,

    status,

    guestCount,

    dietary,

    now

  ];

  if (email && existingRowIndex > 0) {

    const sheetRowNumber = existingRowIndex + 1;

    await sheets.spreadsheets.values.update({

      spreadsheetId,

      range: `A${sheetRowNumber}:G${sheetRowNumber}`,

      valueInputOption: 'USER_ENTERED',

      requestBody: {

        values: [values]

      }

    });

  } else {

    await sheets.spreadsheets.values.append({

      spreadsheetId,

      range: 'A:G',

      valueInputOption: 'USER_ENTERED',

      insertDataOption: 'INSERT_ROWS',

      requestBody: {

        values: [values]

      }

    });

  }

}

async function sendEmail(payload, apiKey) {

  const res = await fetch('https://api.resend.com/emails', {

    method: 'POST',

    headers: {

      'Authorization': `Bearer ${apiKey}`,

      'Content-Type': 'application/json'

    },

    body: JSON.stringify(payload)

  });

  const text = await res.text();

  if (!res.ok) {

    console.error('Resend error:', res.status, text);

    throw new Error(text);

  }

  return text ? JSON.parse(text) : {};

}

function guestHtml({ name, status, guestCount, dietary }) {

  return `

    <div style="font-family:Arial,Helvetica,sans-serif;color:#08245b;background:#fff8ee;padding:28px;border-radius:18px">

      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 16px">Another Birthday</h1>

      <p>Dear ${escapeHtml(name)},</p>

      <p>Thank you for your RSVP.</p>

      <div style="background:#c8bef2;border-radius:14px;padding:18px;margin:20px 0">

        <p><strong>Status:</strong> ${status === 'attending' ? 'Attending' : 'Sorry, can’t make it'}</p>

        <p><strong>Date:</strong> Monday, 20 July 2026, 6:00 PM</p>

        <p><strong>Location:</strong> Carlton Wine Room, 172–174 Faraday Street, Carlton VIC 3053</p>

        ${status === 'attending' ? `<p><strong>Guests:</strong> ${guestCount}</p><p><strong>Dietary requirements:</strong> ${escapeHtml(dietary)}</p>` : ''}

      </div>

      <p>Warm regards,<br><strong>Christian</strong></p>

    </div>

  `;

}

function hostHtml({ name, email, status, guestCount, dietary }) {

  return `

    <div style="font-family:Arial,Helvetica,sans-serif;color:#08245b;background:#fff8ee;padding:24px;border-radius:16px">

      <h2 style="margin-top:0">New RSVP</h2>

      <p><strong>Name:</strong> ${escapeHtml(name)}</p>

      <p><strong>Email:</strong> ${escapeHtml(email || 'not provided')}</p>

      <p><strong>Status:</strong> ${status}</p>

      <p><strong>Guests:</strong> ${guestCount}</p>

      <p><strong>Dietary requirements:</strong> ${escapeHtml(dietary)}</p>

    </div>

  `;

}

function escapeHtml(value) {

  return String(value || '').replace(/[&<>"']/g, function(ch) {

    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })

    