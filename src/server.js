require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const connectDB = require('./config/database');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'https://daretunmise.com', 'https://www.daretunmise.com'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Session configuration - MUST come before passport
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production',
//     maxAge: 24 * 60 * 60 * 1000 // 24 hours
//   }
// }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Add this - important for Render
  cookie: {
    secure: true, // Always true in production
    sameSite: 'none', // Required for cross-domain
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
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

// Routes
app.use('/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
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
