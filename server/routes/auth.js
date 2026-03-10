const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const auth = require('../middleware/auth');
const { sendOTPEmail } = require('../services/email');

const router = express.Router();
const generateToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Step 1: Send OTP
router.post('/register/send-otp', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'Username or email already taken' });

    await OTP.deleteMany({ email, type: 'register' });
    const otp = generateOTP();
    await OTP.create({ email, otp, type: 'register' });
    await sendOTPEmail(email, otp, 'register');

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP. Check email config.' });
  }
});

// Step 2: Verify OTP and create account
router.post('/register/verify', async (req, res) => {
  try {
    const { username, email, password, otp } = req.body;
    if (!otp) return res.status(400).json({ message: 'OTP is required' });

    const record = await OTP.findOne({ email, otp, type: 'register' });
    if (!record) return res.status(400).json({ message: 'Invalid or expired OTP' });

    await OTP.deleteMany({ email, type: 'register' });
    const user = await User.create({ username, email, password, isVerified: true });
    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
