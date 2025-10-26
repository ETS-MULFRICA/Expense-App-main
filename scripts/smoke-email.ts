// Simple smoke test: login as admin, verify SMTP, and attempt a test send (if configured)
// Requires the dev server to be running at http://localhost:5001 and default admin credentials.

const BASE = 'http://localhost:5001';

async function main() {
  const username = process.env.SMOKE_ADMIN_USER || 'admin';
  const password = process.env.SMOKE_ADMIN_PASS || 'password';

  // Login
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual' as any,
  });
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie || !/connect\.sid=/.test(setCookie)) {
    console.error('Login failed. Status:', loginRes.status, await safeJson(loginRes));
    process.exit(1);
  }
  const cookie = setCookie.split(';')[0];
  console.log('Logged in. Cookie:', cookie.replace(/=.*/, '=<redacted>'));

  // Verify SMTP
  const verifyRes = await fetch(`${BASE}/api/admin/email/verify`, {
    headers: { Cookie: cookie },
  });
  const verifyJson: any = await safeJson(verifyRes);
  console.log('Verify:', verifyJson);

  // If configured, try a test send to the admin email address
  if (verifyRes.ok && verifyJson?.configured) {
    const toEmail = process.env.SMOKE_TO || 'admin@example.com';
    const emailRes = await fetch(`${BASE}/api/admin/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ toEmail, subject: 'Smoke Test Email', text: 'Hello from smoke test.' }),
    });
    const emailJson = await safeJson(emailRes);
    console.log('Send result:', emailJson);
  } else {
    console.log('SMTP not configured; skipping send test. Configure SMTP_* env to send real email.');
  }
}

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return { status: res.status, statusText: (res as any).statusText }; }
}

main().catch((e) => { console.error('Smoke test failed:', e); process.exit(1); });
