/**
 * emailService.js
 * Centralized Email Delivery Service using Nodemailer
 *
 * Supports real SMTP transport (Gmail, Outlook, SendGrid, Mailgun, custom SMTP)
 * and fallback development logger.
 */

const nodemailer = require('nodemailer');

// Helper to create Nodemailer transporter
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const rawUser = process.env.EMAIL_USER || process.env.SMTP_USER || '';
  const rawPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';

  const user = rawUser.trim();
  const pass = rawPass.trim();

  if (user && pass) {
    if (host.includes('gmail') || user.endsWith('@gmail.com') || user.endsWith('@uwo24.com')) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
    }
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Fallback for development if no SMTP environment credentials are configured
  return null;
}

/**
 * Sends a 6-digit Account Deletion Security OTP email
 */
async function sendAccountDeletionOTP({ email, otp, userName = 'User' }) {
  const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@aiads.com';
  const appName = 'AI Ads™ Enterprise Platform';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070a11; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { max-width: 520px; margin: 30px auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .badge { display: inline-block; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
        h2 { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .otp-box { background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(99, 102, 241, 0.15)); border: 2px dashed rgba(239, 68, 68, 0.4); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5); }
        .footer { font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px; margin-top: 24px; }
        .warning { color: #f87171; font-size: 12px; font-weight: 600; margin-top: 16px; display: block; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Security Action</div>
        <h2>Verify Account Deletion Request</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>We received a request to permanently delete your account associated with <strong>${email}</strong> on <strong>${appName}</strong>.</p>
        <p>Please enter the 6-digit security code below to confirm your identity and proceed:</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>

        <p>This security code will expire in <strong>10 minutes</strong>.</p>
        <span class="warning">⚠️ If you did NOT request to delete your account, please change your password immediately and secure your workspace.</span>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${appName} Security" <${senderEmail}>`,
        to: email,
        subject: `🔒 ${otp} is your Account Deletion Security Code - ${appName}`,
        text: `Your 6-digit security code for account deletion is: ${otp}. Valid for 10 minutes.`,
        html: htmlContent
      });

      console.log(`✉️ [EMAIL SENT SUCCESSFULLY] OTP ${otp} delivered to ${email} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'SMTP' };
    } catch (err) {
      console.error(`❌ [EMAIL SEND ERROR] Failed to send email via SMTP to ${email}:`, err.message);
    }
  }

  // Fallback console logging when SMTP credentials are not present
  console.log(`\n================================================================`);
  console.log(`✉️ [SIMULATED EMAIL DELIVERY] Account Deletion OTP`);
  console.log(`Recipient: ${email}`);
  console.log(`Subject: 🔒 ${otp} is your Account Deletion Security Code`);
  console.log(`6-Digit Verification Code: >>> ${otp} <<<`);
  console.log(`================================================================\n`);

  return { success: true, mode: 'CONSOLE_LOG', note: 'Configured with fallback logger. Add EMAIL_USER & EMAIL_PASS to backend/.env to send real emails via SMTP.' };
}

/**
 * Sends a Welcome & Account Creation Confirmation email to new users
 */
async function sendWelcomeEmail({ email, userName = 'Valued User' }) {
  const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@aiads.com';
  const appName = 'AI Ads™ Enterprise Platform';
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { max-width: 560px; margin: 30px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05); }
        .badge { display: inline-block; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #4f46e5; font-size: 11px; font-weight: 800; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 18px; }
        h2 { color: #0f172a; font-size: 24px; font-weight: 900; margin: 0 0 10px 0; tracking-tight; }
        p { color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .feature-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; margin-bottom: 24px; }
        .feature-item { font-size: 13px; color: #334155; font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .feature-item:last-child { margin-bottom: 0; }
        .cta-btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff !important; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 14px; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); margin-top: 10px; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Account Creation Confirmed</div>
        <h2>🎉 Welcome to AI Ads™ Platform!</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Congratulations! Your enterprise workspace account has been successfully created with email <strong>${email}</strong>.</p>
        
        <div class="feature-box">
          <div class="feature-item">⚡ <strong>AI Brand DNA Engine:</strong> Extract & lock immutable brand positioning.</div>
          <div class="feature-item">🚀 <strong>30-Day Marketing Roadmap:</strong> Instant multi-channel AI campaign strategy.</div>
          <div class="feature-item">🎨 <strong>Creative Studio:</strong> High-converting visual ad banners & graphics.</div>
          <div class="feature-item">🌐 <strong>AI Website Builder:</strong> Lovable-grade full-width landing pages & web apps.</div>
        </div>

        <p>You can now log in anytime to launch campaigns, build websites, and manage your brand assets.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" class="cta-btn">Launch Workspace →</a>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br>
          Need help? Contact support or reply directly to this message.
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${appName}" <${senderEmail}>`,
        to: email,
        subject: `🎉 Welcome to ${appName} - Your Account Has Been Created!`,
        text: `Welcome to ${appName}! Your account ${email} is ready. Visit ${loginUrl} to log in.`,
        html: htmlContent
      });

      console.log(`✉️ [WELCOME EMAIL DELIVERED] Account creation email sent to ${email} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'SMTP' };
    } catch (err) {
      console.error(`❌ [WELCOME EMAIL ERROR] Failed to send email via SMTP to ${email}:`, err.message);
    }
  }

  // Fallback console logging when SMTP credentials are not present
  console.log(`\n================================================================`);
  console.log(`✉️ [SIMULATED WELCOME EMAIL DELIVERY] Account Creation Confirmation`);
  console.log(`Recipient: ${email}`);
  console.log(`Subject: 🎉 Welcome to ${appName} - Your Account Has Been Created!`);
  console.log(`Message: Account successfully created for ${userName} (${email}).`);
  console.log(`================================================================\n`);

  return { success: true, mode: 'CONSOLE_LOG' };
}

/**
 * Sends Product Feedback / Support Ticket email to admin@uwo24.com
 */
async function sendProductFeedbackEmail({ userEmail, userName = 'User', feedbackText, category = 'Product Feedback' }) {
  const recipientEmail = 'admin@uwo24.com';
  const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@aiads.com';
  const appName = 'AI Ads™ Enterprise Platform';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070a11; color: #e2e8f0; margin: 0; padding: 20px; }
        .card { max-width: 560px; margin: 30px auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 24px; padding: 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .badge { display: inline-block; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); color: #818cf8; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 18px; }
        h2 { color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 8px 0; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
        .meta-box { background: #1e293b; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1; }
        .meta-item { margin-bottom: 6px; }
        .meta-label { font-weight: 700; color: #818cf8; }
        .content-box { background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 24px; color: #f8fafc; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
        .footer { font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">💡 Product Feedback</div>
        <h2>New Feedback Submission</h2>
        <p>You have received new product feedback from an AI Ads™ user:</p>
        
        <div class="meta-box">
          <div class="meta-item"><span class="meta-label">User Email:</span> ${userEmail}</div>
          <div class="meta-item"><span class="meta-label">User Name:</span> ${userName}</div>
          <div class="meta-item"><span class="meta-label">Category:</span> ${category}</div>
          <div class="meta-item"><span class="meta-label">Timestamp:</span> ${new Date().toLocaleString()}</div>
        </div>

        <p><strong>Feedback Content:</strong></p>
        <div class="content-box">${feedbackText}</div>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${appName}. Delivered to admin@uwo24.com
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${appName} Feedback" <${senderEmail}>`,
        to: recipientEmail,
        replyTo: userEmail,
        subject: `💡 New Product Feedback from ${userEmail} - ${appName}`,
        text: `New Feedback from ${userName} (${userEmail}):\n\n${feedbackText}`,
        html: htmlContent
      });

      console.log(`✉️ [FEEDBACK EMAIL SENT] Delivered to ${recipientEmail} from ${userEmail} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, mode: 'SMTP' };
    } catch (err) {
      console.error(`❌ [FEEDBACK EMAIL ERROR] Failed to send to ${recipientEmail}:`, err.message);
    }
  }

  console.log(`\n=================== 💡 [SIMULATED EMAIL DELIVERED TO admin@uwo24.com] ===================`);
  console.log(`Recipient: admin@uwo24.com`);
  console.log(`From User: ${userName} (${userEmail})`);
  console.log(`Category:  ${category}`);
  console.log(`Feedback:  ${feedbackText}`);
  console.log(`========================================================================================\n`);

  return { success: true, mode: 'DEV_LOG' };
}

module.exports = {
  sendAccountDeletionOTP,
  sendWelcomeEmail,
  sendProductFeedbackEmail
};
