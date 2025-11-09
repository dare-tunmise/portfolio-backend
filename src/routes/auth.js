const express = require('express');
const passport = require('passport');
const router = express.Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth routes working',
    hasPassport: !!passport,
    strategies: Object.keys(passport._strategies || {})
  });
});

// Initiate Google OAuth
router.get('/google', (req, res, next) => {
  console.log('=== Google OAuth Request ===');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'EXISTS' : 'MISSING');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'EXISTS' : 'MISSING');
  console.log('Passport strategies:', Object.keys(passport._strategies || {}));
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/admin/login?error=auth_failed`,
    failureMessage: true
  }),
  (req, res) => {
    // Successful authentication
    console.log('Authentication successful for:', req.user.email);
    res.redirect(`${process.env.FRONTEND_URL}/admin/dashboard`);
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;