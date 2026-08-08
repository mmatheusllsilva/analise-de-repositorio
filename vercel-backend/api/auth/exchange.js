export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, redirect_uri } = req.body || {};
  if (!code || !redirect_uri) {
    res.status(400).json({ error: 'Missing code or redirect_uri in request body' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server environment not configured for Supabase auth exchange' });
    return;
  }

  const tokenUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: body.toString(),
  });

  const tokenData = await response.json();
  if (!response.ok) {
    res.status(response.status).json({ error: tokenData?.error || 'Failed to exchange code with Supabase', details: tokenData });
    return;
  }

  if (!tokenData?.user) {
    res.status(500).json({ error: 'Invalid token response from Supabase', details: tokenData });
    return;
  }

  res.status(200).json({
    session: {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      provider_token: tokenData.provider_token,
      provider_refresh_token: tokenData.provider_refresh_token,
    },
    user: {
      id: tokenData.user.id ?? null,
      email: tokenData.user.email ?? null,
      name: tokenData.user.user_metadata?.full_name || tokenData.user.email || null,
      avatar_url: tokenData.user.user_metadata?.avatar_url || null,
      raw: tokenData.user,
    },
    github_token: tokenData.provider_token,
  });
}
