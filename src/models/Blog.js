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

// Bodies are Quill HTML, and the editor writes runs of `&nbsp;` between words.
// Those entities contain no actual whitespace, so counting the raw markup glues
// a whole post into a handful of "words" and everything comes out "1 min read".
// Reduce to plain text before measuring.
const toPlainText = (html = '') =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Calculate reading time before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('body')) {
    const stats = readingTime(toPlainText(this.body));
    this.readTime = stats.text;
  }
  next();
});

blogSchema.statics.toPlainText = toPlainText;

// Index for better query performance
// NOTE: no explicit slug index here — `unique: true` on the slug field already
// creates one, and declaring both makes Mongoose warn about a duplicate.
blogSchema.index({ category: 1 });
blogSchema.index({ published: 1 });
blogSchema.index({ date: -1 });

module.exports = mongoose.model('Blog', blogSchema);