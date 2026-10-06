module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({
      error: 'MISSING_CREDENTIALS',
      message: 'Variables d\'environnement STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquantes sur Vercel.'
    });
  }

  const { code, refresh_token, grant_type = 'authorization_code' } = req.body || {};

  // Liste blanche stricte : on ne relaie jamais un grant_type arbitraire à Strava
  if (grant_type !== 'authorization_code' && grant_type !== 'refresh_token') {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'grant_type invalide.' });
  }

  const payload = { client_id: clientId, client_secret: clientSecret, grant_type };

  if (grant_type === 'refresh_token') {
    if (typeof refresh_token !== 'string' || !refresh_token) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'refresh_token manquant.' });
    }
    payload.refresh_token = refresh_token;
  } else {
    if (typeof code !== 'string' || !code) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'code manquant.' });
    }
    payload.code = code;
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Strava est injoignable.' });
  }
};
