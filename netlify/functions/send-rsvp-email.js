exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: 'Missing RESEND_API_KEY' };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const name = data.name || 'Guest';
  const email = data.email || '';
  const status = data.status === 'attending' ? 'attending' : 'declined';
  const guestCount = data.guest_count || 1;
  const dietary = data.dietary_requirements || 'None';

  const eventDetailsHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#08245b;background:#fff8ee;padding:28px;border-radius:18px">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 16px">Another Birthday</h1>
      <p style="font-size:17px;line-height:1.5">Dear ${escapeHtml(name)},</p>
      <p style="font-size:17px;line-height:1.5">Thank you for your RSVP.</p>
      <div style="background:#c8bef2;border-radius:14px;padding:18px;margin:20px 0">
        <p><strong>Status:</strong> ${status === 'attending' ? 'Attending' : 'Sorry, can’t make it'}</p>
        <p><strong>Date:</strong> Monday, 20 July 2026, 6:00 PM</p>
        <p><strong>Location:</strong> Carlton Wine Room, 172–174 Faraday Street, Carlton VIC 3053</p>
        ${status === 'attending' ? `<p><strong>Guests:</strong> ${guestCount}</p><p><strong>Dietary requirements:</strong> ${escapeHtml(dietary)}</p>` : ''}
      </div>
      <p style="font-size:17px;line-height:1.5">Warm regards,<br><strong>Christian</strong></p>
    </div>
  `;

  const hostHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#08245b;background:#fff8ee;padding:24px;border-radius:16px">
      <h2 style="margin-top:0">New RSVP</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email || 'not provided')}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Guests:</strong> ${guestCount}</p>
      <p><strong>Dietary requirements:</strong> ${escapeHtml(dietary)}</p>
    </div>
  `;

  const messages = [];

  // Notify host
  messages.push(sendEmail({
    from: 'CK <noreply@events.krettek.eu>',
    to: ['krettek@hotmail.com'],
    subject: `New RSVP: ${name} — ${status}`,
    html: hostHtml
  }, RESEND_API_KEY));

  // Confirm guest, if an email was entered.
  if (email) {
    messages.push(sendEmail({
      from: 'CK <noreply@events.krettek.eu>',
      to: [email],
      subject: 'Thank you for your RSVP',
      html: eventDetailsHtml
    }, RESEND_API_KEY));
  }

  try {
    const results = await Promise.all(messages);
    return { statusCode: 200, body: JSON.stringify({ ok: true, results }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

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
    throw new Error(text);
  }
  return text ? JSON.parse(text) : {};
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}
