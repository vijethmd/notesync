import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1); // 1=form, 2=otp
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, sendOTP, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        navigate('/');
      } else {
        await sendOTP(form.username, form.email, form.password);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await verifyOTP(form.username, form.email, form.password, otp);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const switchMode = m => { setMode(m); setStep(1); setError(''); setOtp(''); setForm({ username: '', email: '', password: '' }); };

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">✦</span>
          <span className="auth-logo-text">NoteSync</span>
        </div>
        <p className="auth-subtitle">Real-time collaborative writing</p>

        {step === 1 ? (
          <>
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
              <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Create Account</button>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className="auth-field">
                  <label>Username</label>
                  <input name="username" type="text" placeholder="yourname" value={form.username} onChange={handleChange} required minLength={3} />
                </div>
              )}
              <div className="auth-field">
                <label>Email</label>
                <input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} required minLength={6} />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button className="auth-submit" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Send Verification Code'}
              </button>
            </form>
            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleVerifyOTP}>
            <div className="otp-sent-notice">
              <span className="otp-sent-icon">✉</span>
              <div>
                <p className="otp-sent-title">Check your inbox</p>
                <p className="otp-sent-sub">We sent a 6-digit code to <strong>{form.email}</strong></p>
              </div>
            </div>
            <div className="auth-field">
              <label>Verification Code</label>
              <input
                className="otp-input"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                required
                maxLength={6}
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={loading || otp.length < 6}>
              {loading ? <span className="spinner" /> : 'Verify & Create Account'}
            </button>
            <button type="button" className="auth-back-btn" onClick={() => { setStep(1); setError(''); }}>
              ← Change email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
