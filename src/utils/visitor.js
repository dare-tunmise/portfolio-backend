const crypto = require('crypto');
const geoip = require('fast-geoip');

/**
 * Visitor fingerprinting for analytics, without retaining personal data.
 *
 * We never store the IP. It is combined with the user agent and a salt that
 * rotates daily, then hashed — enough to count the same reader twice in one day
 * as one person, but not reversible and not linkable across days.
 */

// Crawlers, previewers, uptime monitors and scripted clients. The client-side
// beacon already filters most of these (they don't run JS), so this is defence
// in depth for anything hitting the endpoint directly.
const BOT_PATTERN = new RegExp(
  [
    'bot', 'crawler', 'spider', 'crawling', 'slurp', 'headless', 'lighthouse',
    'facebookexternalhit', 'bingpreview', 'whatsapp', 'telegram', 'discord',
    'preview', 'pingdom', 'uptime', 'monitor',
    'curl', 'wget', 'python-requests', 'axios', 'node-fetch', 'go-http',
    'java/', 'okhttp', 'scrapy', 'httpie',
    'semrush', 'ahrefs', 'mj12', 'dotbot', 'petalbot', 'yandex', 'baidu',
    'duckduck', 'applebot', 'gptbot', 'claudebot', 'ccbot', 'perplexity',
    'bytespider', 'amazonbot',
  ].join('|'),
  'i'
);

const isBot = (userAgent = '') =>
  !userAgent || userAgent.length < 10 || BOT_PATTERN.test(userAgent);

/** Salt changes every day, so hashes can't be correlated across days. */
const dailySalt = (now = new Date()) => {
  const secret =
    process.env.ANALYTICS_SALT || process.env.SESSION_SECRET || 'daretunmise';
  return `${secret}:${now.toISOString().slice(0, 10)}`;
};

const visitorHash = (ip, userAgent = '') =>
  crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}|${dailySalt()}`)
    .digest('hex');

const deviceType = (userAgent = '') => {
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobi|android|iphone|ipod|phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
};

/** Reduce a referrer URL to a bare host — no paths, no query strings. */
const referrerHost = (referrer, selfHost) => {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (selfHost && host === String(selfHost).replace(/^www\./, '')) {
      return 'internal';
    }
    return host;
  } catch {
    return 'direct';
  }
};

/** Requires `trust proxy` for the real client address behind Render. */
const clientIp = (req) => String(req.ip || '').replace(/^::ffff:/, '');

/**
 * Country only — resolved at ingest, then the IP is dropped. Prefers a CDN
 * header when one is present, since that costs nothing.
 *
 * Takes the header value rather than the request: everything must be read off
 * the request synchronously, before the response ends and the socket goes away.
 */
const lookupCountry = async (ip, headerCountry) => {
  if (headerCountry && headerCountry !== 'XX') return headerCountry.toUpperCase();
  if (!ip || ip === '::1' || ip.startsWith('127.')) return null;
  try {
    const result = await geoip.lookup(ip);
    return result?.country || null;
  } catch {
    return null;
  }
};

module.exports = {
  isBot,
  visitorHash,
  deviceType,
  referrerHost,
  clientIp,
  lookupCountry,
};
