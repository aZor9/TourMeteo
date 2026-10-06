// Helpers partagés des fonctions Strava (le préfixe "_" empêche Vercel d'en faire un endpoint).
// Le front et l'API sont servis sur la même origine : aucun header CORS n'est nécessaire,
// et on n'en envoie volontairement pas (l'ancien "Access-Control-Allow-Origin: *" permettait
// à n'importe quel site d'utiliser ces endpoints comme proxy Strava).

const STRAVA_API = 'https://www.strava.com/api/v3';

/** Extrait le Bearer token (header uniquement : un token en query string finit dans les logs). */
function getBearer(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Appelle l'API Strava avec le token de l'utilisateur et relaie la réponse. */
async function proxyStrava(req, res, path) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token Strava manquant.' });
  }

  try {
    const response = await fetch(`${STRAVA_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.status).json(data);
  } catch (err) {
    // On ne renvoie pas err.message brut (peut contenir des détails internes)
    return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Strava est injoignable.' });
  }
}

module.exports = { getBearer, proxyStrava };
