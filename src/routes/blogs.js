const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');

// Get all published blogs with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 10, search } = req.query;
    const query = { published: true };

    // Filter by category
    if (category && ['writings', 'projects'].includes(category)) {
      query.category = category;
    }

    // Search in title and body
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'name email')
        .lean(),
      Blog.countDocuments(query)
    ]);

    res.json({
      blogs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single blog by slug
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ 
      slug: req.params.slug,
      published: true 
    })
    .populate('author', 'name email')
    .lean();

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json(blog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get blogs by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!['writings', 'projects'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { category, published: true };

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'name email')
        .lean(),
      Blog.countDocuments(query)
    ]);

    res.json({
      category,
      blogs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;