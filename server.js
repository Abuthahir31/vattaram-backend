require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const admin = require('./firebaseAdmin');
const jwt = require('jsonwebtoken');

// Import routes
const districtRoutes = require('./routes/districtRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/ProductRoutes');
const testimonial = require('./routes/testimonialRoutes');
const aboutus = require('./routes/aboutUsRoutes');
const deals = require('./routes/dealsRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');

// Import OTP controller
const { sendOTP, verifyOTP } = require('./controllers/otpController');

// Import User model
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced MongoDB connection function
const connectDB = async () => {
  try {
    // Validate that MONGO_URI exists
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    
    // Connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    // Establish connection
    await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log('MongoDB connected successfully');
    
    // Listen to connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Close connection on app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    
    // In production, exit process; in development, continue
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Initialize database connection
connectDB();

// Middleware
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://vattaram-8cn5.vercel.app/', 'https://vattaram-backend.onrender.com'] 
    : 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Firebase Authentication Middleware
const authenticateFirebase = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// JWT Authentication Middleware for Phone OTP
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No JWT provided' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid JWT' });
  }
};

// OTP Routes
app.post('/api/send-otp', sendOTP);
app.post('/api/verify-otp', verifyOTP);

// Other Routes
app.use('/api/districts', districtRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/testimonials', testimonial);
app.use('/api/about-us', aboutus);
app.use('/api/deals', deals);
app.use('/api/cart', authenticateFirebase, cartRoutes);
app.use('/api/orders', authenticateFirebase, orderRoutes);
app.use('/api/users', require('./routes/users'));
app.use('/api/wishlist', wishlistRoutes);
app.use('/admin', require('./routes/admin'));

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({ 
    status: 'OK', 
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('South Bay Mart API Running...');
});

// Error Handlers
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server only if MongoDB connection is successful
mongoose.connection.once('open', () => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

// Handle MongoDB connection errors
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (process.env.NODE_ENV === 'production') {
    console.log('Exiting process due to MongoDB connection failure');
    process.exit(1);
  }
});