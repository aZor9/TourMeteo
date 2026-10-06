const { proxyStrava } = require('./_strava');

module.exports = async function handler(req, res) {
  return proxyStrava(req, res, '/athlete/activities?per_page=30');
};
