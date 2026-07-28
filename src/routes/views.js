const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const PageView = require('../models/PageView');
const {
  isBot,
  visitorHash,
  deviceType,
  referrerHost,
  clientIp,
  lookupCountry,
} = require('../utils/visitor');

// A reader reloading or navigating back within this window is the same visit,
// not a new view.
const REFRESH_WINDOW_MS = 30 * 60 * 1000;
// How far back the engagement beacon may reach to mark its own view.
const ENGAGE_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Read everything off the request *now*.
 *
 * These handlers answer 204 immediately and finish their work afterwards, and
 * once the response ends the socket can be torn down — at which point req.ip
 * reads back empty. Capturing up front also keeps the visitor hash
 * deterministic between the view and engage calls.
 */
const captureRequest = (req) => ({
  slug: typeof req.body?.slug === 'string' ? req.body.slug : null,
  ip: clientIp(req),
  userAgent: req.get('user-agent') || '',
  referrer: req.body?.referrer || req.get('referer') || '',
  host: req.hostname,
  headerCountry: req.get('cf-ipcountry') || req.get('x-vercel-ip-country') || '',
});

/**
 * POST /api/views  { slug }
 *
 * Always answers 204. Analytics must never surface an error to a reader or
 * reveal whether a slug exists, and the client ignores the response anyway.
 */
router.post('/', async (req, res) => {
  const ctx = captureRequest(req);
  res.status(204).end();

  try {
    if (!ctx.slug || isBot(ctx.userAgent)) return;

    const blog = await Blog.findOne({ slug: ctx.slug, published: true })
      .select('_id slug')
      .lean();
    if (!blog) return;

    const hash = visitorHash(ctx.ip, ctx.userAgent);

    try {
      await PageView.create({
        blog: blog._id,
        slug: blog.slug,
        visitorHash: hash,
        bucket: Math.floor(Date.now() / REFRESH_WINDOW_MS),
        country: await lookupCountry(ctx.ip, ctx.headerCountry),
        referrer: referrerHost(ctx.referrer, ctx.host),
        device: deviceType(ctx.userAgent),
      });
    } catch (error) {
      // Duplicate key: this reader already has a view in the current bucket.
      // That's the refresh guard doing its job, not a failure.
      if (error.code !== 11000) throw error;
    }
  } catch (error) {
    // Never let analytics break a page load.
    console.error('View tracking failed:', error.message);
  }
});

/**
 * POST /api/views/engage  { slug }
 *
 * Fired once the reader has stayed a while. Marks the visit this same visitor
 * already opened, so it can't invent a view of its own.
 */
router.post('/engage', async (req, res) => {
  const ctx = captureRequest(req);
  res.status(204).end();

  try {
    if (!ctx.slug || isBot(ctx.userAgent)) return;

    const hash = visitorHash(ctx.ip, ctx.userAgent);

    await PageView.findOneAndUpdate(
      {
        visitorHash: hash,
        slug: ctx.slug,
        createdAt: { $gte: new Date(Date.now() - ENGAGE_WINDOW_MS) },
      },
      { $set: { engaged: true } },
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    console.error('Engagement tracking failed:', error.message);
  }
});

module.exports = router;
