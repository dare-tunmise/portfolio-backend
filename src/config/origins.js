/**
 * Every origin allowed to call the API with credentials.
 *
 * Shared with analytics: a referrer pointing at any of these is internal
 * navigation, not traffic from elsewhere. Comparing against req.hostname would
 * be wrong — that is the API's own host (Render), never the frontend's.
 */
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'https://daretunmise.com',
  'https://www.daretunmise.com',
  'https://daretunmisee.onrender.com',
  'http://localhost:3000',
].filter(Boolean);

const normalizeHost = (host = '') =>
  String(host).toLowerCase().replace(/^www\./, '');

const OWN_HOSTS = new Set(
  ALLOWED_ORIGINS.map((origin) => {
    try {
      return normalizeHost(new URL(origin).hostname);
    } catch {
      return null;
    }
  }).filter(Boolean)
);

const isOwnHost = (host) => OWN_HOSTS.has(normalizeHost(host));

module.exports = { ALLOWED_ORIGINS, isOwnHost, normalizeHost };
