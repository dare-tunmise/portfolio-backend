require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const connectDB = require('./config/database');
// Shared with analytics, so CORS and internal-referrer detection can't drift.
const { ALLOWED_ORIGINS } = require('./config/origins');

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// The frontend and API live on different hosts, so the session cookie is
// cross-site. Browsers only send a SameSite=None cookie when it is also
// Secure, and Secure cookies are dropped over plain http (localhost dev).
// Key both flags off the frontend's actual protocol so dev and prod work
// without editing code — hardcoding secure:true breaks local login, and
// hardcoding false breaks production.
const isSecureFrontend = FRONTEND_URL.startsWith('https://');

// Connect to MongoDB
connectDB();

// Render (and most PaaS) terminate TLS at a proxy, so Express needs to trust
// X-Forwarded-Proto or it will refuse to set a Secure cookie.
if (isSecureFrontend) {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Session configuration - MUST come before passport
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust X-Forwarded-Proto behind Render's TLS-terminating proxy
  cookie: {
    secure: isSecureFrontend,
    sameSite: isSecureFrontend ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport AFTER session
app.use(passport.initialize());
app.use(passport.session());

// Load passport config AFTER passport is initialized
require('./config/passport');

// Import routes AFTER passport is configured
const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blogs');
const dashboardRoutes = require('./routes/dashboard');
const viewRoutes = require('./routes/views');
const analyticsRoutes = require('./routes/analytics');

// Routes
app.use('/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/views', viewRoutes);
// More specific mount first, so it doesn't fall through the /api/dashboard
// router (and run isAuthenticated twice) on the way here.
app.use('/api/dashboard/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Blog API is running',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: process.env.FRONTEND_URL,
    env: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasAllowedEmail: !!process.env.ALLOWED_EMAIL,
      callbackUrl: process.env.CALLBACK_URL
    }
  });
});

// Test endpoint to check passport setup
app.get('/test-auth', (req, res) => {
  res.json({
    passportInitialized: !!req.session,
    googleClientId: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 10) + '...' : 'MISSING',
    callbackUrl: process.env.CALLBACK_URL
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
