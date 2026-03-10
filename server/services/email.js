const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password from Google
  },
});

const sendOTPEmail = async (email, otp, type = 'register') => {
  const isRegister = type === 'register';
  const subject = isRegister ? 'Verify your NoteSync account' : 'Your NoteSync login code';
  const headline = isRegister ? 'Welcome to NoteSync' : 'Your login code';
  const subtext = isRegister
    ? 'Use the code below to verify your email address and complete your registration.'
    : 'Use this code to sign in to your NoteSync account.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0c0b09; font-family: 'Helvetica Neue', Arial, sans-serif; }
  </style>
</head>
<body style="background:#0c0b09; padding: 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; margin:0 auto;">
    <tr>
      <td>
        <!-- Logo -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="text-align:center; padding: 24px 0 0;">
              <span style="font-size:22px; color:#d4a853;">✦</span>
              <span style="font-family:Georgia,serif; font-size:22px; font-weight:700; color:#f0ead6; letter-spacing:1px; margin-left:8px;">NoteSync</span>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#131210; border:1px solid rgba(212,168,83,0.12); border-radius:16px; overflow:hidden;">
          <!-- Gold top bar -->
          <tr>
            <td style="height:3px; background:linear-gradient(90deg, transparent, #d4a853, transparent);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 32px;">
              <p style="font-family:Georgia,serif; font-size:26px; font-weight:700; color:#f0ead6; margin-bottom:12px; letter-spacing:-0.3px;">${headline}</p>
              <p style="font-size:15px; color:rgba(240,234,214,0.5); line-height:1.6; margin-bottom:36px; font-weight:300;">${subtext}</p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="text-align:center;">
                    <div style="display:inline-block; background:#1a1815; border:1px solid rgba(212,168,83,0.25); border-radius:12px; padding:24px 48px;">
                      <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:rgba(212,168,83,0.6); margin-bottom:12px;">Your verification code</p>
                      <p style="font-family:'Courier New', monospace; font-size:42px; font-weight:700; color:#d4a853; letter-spacing:12px; margin:0;">${otp}</p>
                      <p style="font-size:12px; color:rgba(240,234,214,0.3); margin-top:12px;">Expires in 10 minutes</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px; color:rgba(240,234,214,0.3); line-height:1.6; border-top:1px solid rgba(212,168,83,0.08); padding-top:24px;">
                If you didn't request this, you can safely ignore this email. Someone may have entered your email by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0f0e0c; padding:16px 40px; border-top:1px solid rgba(212,168,83,0.06);">
              <p style="font-size:12px; color:rgba(240,234,214,0.2); text-align:center;">
                © 2026 NoteSync · Real-time collaborative notes
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"NoteSync" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html,
  });
};

const sendInviteEmail = async (recipientEmail, senderName, noteTitle) => {
  const html = `
<!DOCTYPE html>
<html>
<body style="background:#0c0b09; padding:40px 20px; font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
        <tr><td style="text-align:center;padding:24px 0 0;">
          <span style="font-size:22px;color:#d4a853;">✦</span>
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#f0ead6;letter-spacing:1px;margin-left:8px;">NoteSync</span>
        </td></tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#131210;border:1px solid rgba(212,168,83,0.12);border-radius:16px;overflow:hidden;">
        <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#d4a853,transparent);"></td></tr>
        <tr><td style="padding:40px;">
          <p style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#f0ead6;margin-bottom:12px;">You've been invited!</p>
          <p style="font-size:15px;color:rgba(240,234,214,0.5);line-height:1.6;margin-bottom:24px;font-weight:300;">
            <strong style="color:#d4a853;">${senderName}</strong> has invited you to collaborate on a note.
          </p>
          <div style="background:#1a1815;border:1px solid rgba(212,168,83,0.15);border-radius:10px;padding:16px 20px;margin-bottom:28px;">
            <p style="font-size:12px;color:rgba(212,168,83,0.5);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Note</p>
            <p style="font-size:16px;color:#f0ead6;font-family:Georgia,serif;font-weight:600;">${noteTitle || 'Untitled Note'}</p>
          </div>
          <p style="font-size:13px;color:rgba(240,234,214,0.3);line-height:1.6;">Open NoteSync to accept or decline this invitation from your notifications.</p>
        </td></tr>
        <tr><td style="background:#0f0e0c;padding:16px 40px;border-top:1px solid rgba(212,168,83,0.06);">
          <p style="font-size:12px;color:rgba(240,234,214,0.2);text-align:center;">© 2026 NoteSync · Real-time collaborative notes</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"NoteSync" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `${senderName} invited you to collaborate on NoteSync`,
    html,
  });
};

module.exports = { sendOTPEmail, sendInviteEmail };
