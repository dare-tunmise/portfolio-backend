const mongoose = require('mongoose');
const slugify = require('slugify');
const readingTime = require('reading-time');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  body: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['writings', 'projects'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  readTime: {
    type: String
  },
  githubLink: {
    type: String,
    trim: true
  },
  published: {
    type: Boolean,
    default: false
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate slug before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { 
      lower: true, 
      strict: true 
    });
  }
  next();
});

// Calculate reading time before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('body')) {
    const stats = readingTime(this.body);
    this.readTime = stats.text;
  }
  next();
});

// Index for better query performance
blogSchema.index({ slug: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ published: 1 });
blogSchema.index({ date: -1 });

module.exports = mongoose.model('Blog', blogSchema);