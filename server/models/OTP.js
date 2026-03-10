const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  otp: { type: String, required: true },
  type: { type: String, enum: ['register', 'login'], default: 'register' },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // auto-delete after 10 min
});

module.exports = mongoose.model('OTP', otpSchema);
