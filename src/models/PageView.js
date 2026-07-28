const mongoose = require('mongoose');

/**
 * One document per page open. No IP is stored — see utils/visitor.js.
 *
 * `engaged` is set by a second beacon after the reader has been on the page for
 * a while, which is what separates "opened it" from "actually read it".
 */
const pageViewSchema = new mongoose.Schema({
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true
  },
  // Denormalized so a view still makes sense if the post is renamed or removed.
  slug: {
    type: String,
    required: true
  },
  visitorHash: {
    type: String,
    required: true
  },
  // 30-minute bucket the visit falls in. Combined with visitorHash + slug in a
  // unique index, this is what makes "one view per reader per half hour"
  // race-proof — two simultaneous requests can't both pass a check-then-write.
  bucket: {
    type: Number,
    required: true
  },
  country: String,
  referrer: String,
  device: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop']
  },
  engaged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

pageViewSchema.index({ blog: 1, createdAt: -1 });
// Enforces the refresh guard in the database rather than in application code.
pageViewSchema.index({ visitorHash: 1, slug: 1, bucket: 1 }, { unique: true });
// Backs the engagement update, which looks up the reader's most recent view.
pageViewSchema.index({ visitorHash: 1, slug: 1, createdAt: -1 });

// Raw events expire after a year. Totals therefore mean "the last 12 months",
// which is the more useful number for a blog anyway. Drop this index if you
// ever want lifetime figures.
pageViewSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 }
);

module.exports = mongoose.model('PageView', pageViewSchema);
