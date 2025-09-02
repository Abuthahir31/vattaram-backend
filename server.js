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

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
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

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// OTP Routes - PLACED BEFORE OTHER ROUTES
app.post('/api/send-otp', sendOTP);
app.post('/api/verify-otp', verifyOTP);

// Other Routes
app.use('/api/districts', districtRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/testimonials', testimonial);
app.use('/api/about-us', aboutus);
app.use('/api/deals', deals);
app.use('/api/cart', authenticateFirebase, cartRoutes); // Firebase auth for cart
app.use('/api/orders', authenticateFirebase, orderRoutes); // Firebase auth for orders
app.use('/api/users', require('./routes/users'));
app.use('/api/wishlist', wishlistRoutes);
app.use('/admin', require('./routes/admin'));

// Root route
app.get('/', (req, res) => {
  res.send('South Bay Mart API Running...');
});

// Error Handlers - MUST COME AFTER ALL ROUTES
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));