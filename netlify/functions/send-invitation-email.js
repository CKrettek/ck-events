exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method not allowed' };
    }
  
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || "https://ubeaqemmnibtfichxhwt.supabase.co";
    const SUPABASE_KEY = process.env.CK_EVENTS_DB_SECRET;
  
    if (!RESEND_API_KEY) {
      return { statusCode: 500, body: 'Missing RESEND_API_KEY' };
    }
  
    if (!SUPABASE_KEY) {
      return { statusCode: 500, body: 'Missing CK_EVENTS_DB_SECRET' };
    }
  
    let data;
    try {
      data = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: 'Invalid JSON' };
    }
  
    const guestId = data.guest_id;
    if (!guestId) {
      return { statusCode: 400, body: 'Missing guest_id' };
    }
  
    try {
      const guest = await getGuest(guestId, SUPABASE_URL, SUPABASE_KEY);
  
      if (!guest) {
        return { statusCode: 404, body: 'Guest not found' };
      }
  
      if (!guest.email) {
        return { statusCode: 400, body: 'Guest has no email address' };
      }
  
      const token = guest.invitation_token || makeToken();
  
      if (!guest.invitation_token) {
        await updateGuest(guestId, { invitation_token: token }, SUPABASE_URL, SUPABASE_KEY);
      }
  
      const invitationUrl = `https://leafy-souffle-2d901b.netlify.app/?token=${encodeURIComponent(token)}`;
  
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#08245b;background:#fff8ee;padding:28px;border-radius:18px">
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 16px">You’re invited</h1>
  
          <p style="font-size:17px;line-height:1.5">Dear ${escapeHtml(guest.display_name || 'Guest')},</p>
  
          <p style="font-size:17px;line-height:1.5">
            I would be very happy if you could join me for dinner, drinks and good company.
          </p>
  
          <div style="background:#c8bef2;border-radius:14px;padding:18px;margin:20px 0">
            <p><strong>Event:</strong> Another Birthday — by Christian</p>
            <p><strong>Date:</strong> Monday, 20 July 2026, 6:00 PM</p>
            <p><strong>Location:</strong> Carlton Wine Room, 172–174 Faraday Street, Carlton VIC 3053</p>
          </div>
  
          <p style="font-size:17px;line-height:1.5">
            Please respond using your personal RSVP link:
          </p>
  
          <p style="margin:28px 0">
            <a href="${invitationUrl}" style="background:#08245b;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">
              Open invitation
            </a>
          </p>
  
          <p style="font-size:13px;line-height:1.5;color:#555">
            If the button does not work, copy this link:<br>
            ${escapeHtml(invitationUrl)}
          </p>
  
          <p style="font-size:17px;line-height:1.5">Warm regards,<br><strong>Christian</strong></p>
        </div>
      `;
  
      const result = await sendEmail({
        from: 'CK Events <onboarding@resend.dev>',
        to: [guest.email],
        subject: 'You’re invited — Another Birthday',
        html
      }, RESEND_API_KEY);
  
      await updateGuest(guestId, {
        invite_status: 'sent',
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, SUPABASE_URL, SUPABASE_KEY);
  
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, result, invitation_url: invitationUrl })
      };
  
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
    }
  };
  
  async function getGuest(id, supabaseUrl, apiKey) {
    const res = await fetch(`${supabaseUrl}/rest/v1/guests?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
  
    const text = await res.text();
    if (!res.ok) throw new Error(text);
  
    const rows = text ? JSON.parse(text) : [];
    return rows[0] || null;
  }
  
  async function updateGuest(id, payload, supabaseUrl, apiKey) {
    const res = await fetch(`${supabaseUrl}/rest/v1/guests?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
  
    const text = await res.text();
    if (!res.ok) throw new Error(text);
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
      throw new Error(text);
    }
    return text ? JSON.parse(text) : {};
  }
  
  function makeToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }
