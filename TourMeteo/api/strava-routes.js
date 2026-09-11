export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.query.token;

  const athleteId = req.query.athlete_id;

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token Strava manquant.' });
  }

  try {
    const url = athleteId
      ? `https://www.strava.com/api/v3/athletes/${athleteId}/routes?per_page=30`
      : 'https://www.strava.com/api/v3/athlete/routes?per_page=30';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Erreur lors de la récupération des itinéraires Strava.'
    });
  }
}
