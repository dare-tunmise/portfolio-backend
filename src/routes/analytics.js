const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Blog = require('../models/Blog');
const PageView = require('../models/PageView');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Views / unique visitors / engaged reads, grouped by whatever `by` names. */
const totalsStage = (by = '$blog') => [
  {
    $group: {
      _id: by,
      views: { $sum: 1 },
      visitors: { $addToSet: '$visitorHash' },
      engaged: { $sum: { $cond: ['$engaged', 1, 0] } },
      lastViewedAt: { $max: '$createdAt' },
    },
  },
  {
    $project: {
      views: 1,
      engaged: 1,
      lastViewedAt: 1,
      visitors: { $size: '$visitors' },
    },
  },
];

/** Top values of a field, e.g. country or referrer. */
const breakdown = (match, field, limit = 8) =>
  PageView.aggregate([
    { $match: { ...match, [field]: { $nin: [null, ''] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, name: '$_id', count: 1 } },
  ]);

/**
 * GET /api/dashboard/analytics
 * One row per post for the dashboard list, plus site-wide totals.
 */
router.get('/', async (req, res) => {
  try {
    const [blogs, perBlog, siteTotals] = await Promise.all([
      Blog.find({}, 'title slug category published date').lean(),
      PageView.aggregate(totalsStage('$blog')),
      PageView.aggregate(totalsStage(null)),
    ]);

    const byBlog = new Map(perBlog.map((row) => [String(row._id), row]));

    const posts = blogs
      .map((blog) => {
        const stats = byBlog.get(String(blog._id)) || {};
        return {
          _id: blog._id,
          title: blog.title,
          slug: blog.slug,
          category: blog.category,
          published: blog.published,
          views: stats.views || 0,
          visitors: stats.visitors || 0,
          engaged: stats.engaged || 0,
          lastViewedAt: stats.lastViewedAt || null,
        };
      })
      .sort((a, b) => b.views - a.views);

    res.json({
      posts,
      totals: siteTotals[0]
        ? {
            views: siteTotals[0].views,
            visitors: siteTotals[0].visitors,
            engaged: siteTotals[0].engaged,
          }
        : { views: 0, visitors: 0, engaged: 0 },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/analytics/:id
 * Detail for one post: totals, a 30-day daily series, and breakdowns.
 */
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid blog id' });
    }

    const blog = await Blog.findById(req.params.id)
      .select('title slug category published date')
      .lean();
    if (!blog) return res.status(404).json({ error: 'Blog not found' });

    const match = { blog: blog._id };
    const since = daysAgo(30);

    const [totals, series, countries, referrers, devices] = await Promise.all([
      PageView.aggregate([{ $match: match }, ...totalsStage(null)]),
      PageView.aggregate([
        { $match: { ...match, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            views: { $sum: 1 },
            visitors: { $addToSet: '$visitorHash' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            views: 1,
            visitors: { $size: '$visitors' },
          },
        },
        { $sort: { date: 1 } },
      ]),
      breakdown(match, 'country'),
      breakdown(match, 'referrer'),
      breakdown(match, 'device', 3),
    ]);

    // Fill gaps so the chart has one point per day rather than jumping.
    const bySeriesDate = new Map(series.map((d) => [d.date, d]));
    const filled = [];
    for (let i = 29; i >= 0; i -= 1) {
      const key = daysAgo(i).toISOString().slice(0, 10);
      filled.push(bySeriesDate.get(key) || { date: key, views: 0, visitors: 0 });
    }

    res.json({
      blog,
      totals: totals[0]
        ? {
            views: totals[0].views,
            visitors: totals[0].visitors,
            engaged: totals[0].engaged,
            lastViewedAt: totals[0].lastViewedAt,
          }
        : { views: 0, visitors: 0, engaged: 0, lastViewedAt: null },
      series: filled,
      countries,
      referrers,
      devices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
