/**
 * Recompute readTime for every existing blog.
 *
 * Existing posts stored a read time measured from raw Quill HTML, where runs of
 * `&nbsp;` collapsed the word count (see the note in models/Blog.js). The
 * pre-save hook only recalculates when a body is modified, so old rows need a
 * one-off pass.
 *
 * Dry run (default, writes nothing):  node scripts/backfill-read-time.js
 * Apply:                              node scripts/backfill-read-time.js --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const readingTime = require('reading-time');
const Blog = require('../src/models/Blog');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const blogs = await Blog.find({}, 'title readTime body').lean();
  let changed = 0;

  for (const blog of blogs) {
    const next = readingTime(Blog.toPlainText(blog.body)).text;
    if (next === blog.readTime) continue;

    changed += 1;
    console.log(
      `${(blog.title || '').slice(0, 40).padEnd(42)}` +
      `${String(blog.readTime || '—').padEnd(12)} ->  ${next}`
    );

    if (APPLY) {
      // Touch only readTime: no full save, so slug/date/body stay untouched.
      await Blog.updateOne({ _id: blog._id }, { $set: { readTime: next } });
    }
  }

  console.log(
    `\n${changed} of ${blogs.length} would change` +
    `${APPLY ? ' — APPLIED' : ' (dry run, nothing written)'}`
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
