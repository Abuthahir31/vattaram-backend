const axios = require('axios');
const bcrypt = require('bcryptjs');
const OTP = require('../models/otp');


// Send OTP
exports.sendOTP = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number required' });

  // Clean phone number (remove +91 and non-digits)
  const cleanPhone = phone.replace('+91', '').replace(/\D/g, '');
  
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);

  try {
    // Delete any existing OTP for this phone
    await OTP.deleteMany({ phone: cleanPhone });
    
    // Save OTP
    await OTP.create({ phone: cleanPhone, otpHash });

    console.log('Attempting to send OTP to:', cleanPhone);

    // Fast2SMS API call
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'otp',
        numbers: cleanPhone,
        variables_values: otp,
        flash: 0 // 0 for regular SMS, 1 for flash SMS
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY, // Remove 'Bearer' prefix
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('Fast2SMS API Response:', response.data);

    if (response.data.return) {
      res.json({ 
        success: true, 
        message: 'OTP sent successfully via SMS' 
      });
    } else {
      throw new Error(response.data.message || 'Failed to send OTP');
    }

  } catch (error) {
    console.error('SMS Sending Failed:', error.response?.data || error.message);
    
    // Even if SMS fails, OTP is saved for verification
    res.status(500).json({ 
      success: false,
      message: 'Failed to send SMS. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify OTP (unchanged)
exports.verifyOTP = async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP required' });

  try {
    const cleanPhone = phone.replace('+91', '').replace(/\D/g, '');
    const record = await OTP.findOne({ phone: cleanPhone }).sort({ createdAt: -1 });
    
    if (!record) return res.status(400).json({ message: 'OTP expired or invalid' });

    // Check if OTP is expired (10 minutes)
    const isExpired = (Date.now() - record.createdAt) > 10 * 60 * 1000;
    if (isExpired) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'OTP expired' });
    }

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (isValid) {
      await OTP.deleteOne({ _id: record._id });
      
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { phone: cleanPhone }, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
      );
      
      res.json({ 
        success: true, 
        message: 'OTP verified successfully',
        token: token
      });
    } else {
      res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('OTP Verify Error:', error);
    res.status(500).json({ message: error.message });
  }
};