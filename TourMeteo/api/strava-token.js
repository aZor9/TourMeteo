export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'MISSING_CREDENTIALS',
      message: 'Variables d\'environnement STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET manquantes sur Vercel.'
    });
  }

  try {
    const { code, refresh_token, grant_type = 'authorization_code' } = req.body || {};

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grant_type
    };

    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'Missing refresh_token' });
      }
      payload.refresh_token = refresh_token;
    } else {
      if (!code) {
        return res.status(400).json({ error: 'Missing code' });
      }
      payload.code = code;
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Erreur lors de l\'échange de jeton Strava.'
    });
  }
}
