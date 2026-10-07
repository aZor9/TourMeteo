const { proxyStrava } = require('./_strava');

module.exports = async function handler(req, res) {
  // athlete_id vient du client : on n'accepte que des chiffres, sinon on pourrait
  // injecter un chemin arbitraire dans l'URL appelée côté serveur (ex: "../../oauth/...").
  const raw = req.query.athlete_id;
  const athleteId = typeof raw === 'string' && /^\d{1,20}$/.test(raw) ? raw : null;
  if (raw !== undefined && !athleteId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'athlete_id invalide.' });
  }

  const path = athleteId
    ? `/athletes/${athleteId}/routes?per_page=30`
    : '/athlete/routes?per_page=30';
  return proxyStrava(req, res, path);
};
