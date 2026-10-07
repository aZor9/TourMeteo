// Expose le Client ID Strava (public par nature : il apparaît dans l'URL d'autorisation).
// Évite de demander à l'utilisateur de le saisir dans un prompt() comme avant.
// Le Client Secret, lui, ne quitte jamais le serveur (cf. strava-token.js).
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  // trim : une variable d'environnement collée avec un retour à la ligne casse l'URL OAuth
  const clientId = (process.env.STRAVA_CLIENT_ID || '').trim();
  if (!clientId) {
    return res.status(503).json({
      error: 'MISSING_CREDENTIALS',
      message: 'STRAVA_CLIENT_ID n\'est pas configuré sur le serveur.'
    });
  }
  return res.status(200).json({ clientId });
};
