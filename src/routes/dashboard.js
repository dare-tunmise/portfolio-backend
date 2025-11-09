const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { isAuthenticated } = require('../middleware/auth');

// Apply authentication middleware to all dashboard routes
router.use(isAuthenticated);

// Get all blogs (including drafts) for dashboard
router.get('/blogs', async (req, res) => {
  try {
    const { category, status, page = 1, limit = 20 } = req.query;
    const query = {};

    // Filter by category
    if (category && ['writings', 'projects'].includes(category)) {
      query.category = category;
    }

    // Filter by status
    if (status === 'published') {
      query.published = true;
    } else if (status === 'draft') {
      query.published = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
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

// Create new blog
router.post('/blogs', async (req, res) => {
  try {
    const { title, body, category, date, githubLink, published } = req.body;

    // Validation
    if (!title || !body || !category) {
      return res.status(400).json({ 
        error: 'Title, body, and category are required' 
      });
    }

    if (!['writings', 'projects'].includes(category)) {
      return res.status(400).json({ 
        error: 'Category must be either "writings" or "projects"' 
      });
    }

    const blog = new Blog({
      title,
      body,
      category,
      date: date || new Date(),
      githubLink: githubLink || undefined,
      published: published || false,
      author: req.user._id
    });

    await blog.save();
    await blog.populate('author', 'name email');

    res.status(201).json({
      message: 'Blog created successfully',
      blog
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'A blog with this title already exists. Please use a different title.' 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update blog
router.put('/blogs/:id', async (req, res) => {
  try {
    const { title, body, category, date, githubLink, published } = req.body;

    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Update fields
    if (title) blog.title = title;
    if (body) blog.body = body;
    if (category && ['writings', 'projects'].includes(category)) {
      blog.category = category;
    }
    if (date) blog.date = date;
    if (githubLink !== undefined) blog.githubLink = githubLink;
    if (published !== undefined) blog.published = published;

    await blog.save();
    await blog.populate('author', 'name email');

    res.json({
      message: 'Blog updated successfully',
      blog
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: 'A blog with this title already exists. Please use a different title.' 
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete blog
router.delete('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json({ 
      message: 'Blog deleted successfully',
      deletedBlog: {
        id: blog._id,
        title: blog.title
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish/unpublish blog
router.patch('/blogs/:id/publish', async (req, res) => {
  try {
    const { published } = req.body;

    if (typeof published !== 'boolean') {
      return res.status(400).json({ 
        error: 'Published field must be a boolean' 
      });
    }

    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    blog.published = published;
    await blog.save();
    await blog.populate('author', 'name email');

    res.json({
      message: `Blog ${published ? 'published' : 'unpublished'} successfully`,
      blog
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;