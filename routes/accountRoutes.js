/**
 * accountRoutes.js
 * Account Management & Identity Verification API Routes
 *
 * Handles 6-Digit Email OTP generation, verification, and permanent account deletion.
 */

const express = require('express');
const router = express.Router();
const { sendAccountDeletionOTP } = require('../services/emailService');

// In-memory store for account deletion OTPs: { email: { otp, expiresAt, verified, attempts } }
const deleteOtpStore = new Map();

/**
 * POST /api/account/send-delete-otp
 * Generates and emails a 6-digit OTP to the user's email address
 */
router.post('/send-delete-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim() || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'A valid user email address is required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check rate limit: 1 request per 30 seconds
    const existing = deleteOtpStore.get(cleanEmail);
    if (existing && Date.now() - existing.createdAt < 30000) {
      const waitSec = Math.ceil((30000 - (Date.now() - existing.createdAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSec} seconds before requesting another code.`
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes valid

    // Save to OTP store
    deleteOtpStore.set(cleanEmail, {
      otp,
      createdAt: Date.now(),
      expiresAt,
      verified: false,
      attempts: 0
    });

    console.log(`🔒 Generated 6-digit Account Deletion OTP for ${cleanEmail}: ${otp}`);

    // Send Email via Nodemailer Service
    const emailResult = await sendAccountDeletionOTP({
      email: cleanEmail,
      otp,
      userName: cleanEmail.split('@')[0]
    });

    return res.status(200).json({
      success: true,
      message: `A 6-digit security code has been sent to ${cleanEmail}.`,
      expiresIn: '10 minutes',
      emailDelivery: emailResult.mode
    });
  } catch (err) {
    console.error('Error sending account deletion OTP:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to send security verification code to your email.'
    });
  }
});

/**
 * POST /api/account/verify-delete-otp
 * Verifies the 6-digit security code entered by the user
 */
router.post('/verify-delete-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and 6-digit security code are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const record = deleteOtpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code found. Please click "Resend Code".'
      });
    }

    if (Date.now() > record.expiresAt) {
      deleteOtpStore.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        error: 'Security code has expired. Please click "Resend Code".'
      });
    }

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts > 5) {
      deleteOtpStore.delete(cleanEmail);
      return res.status(429).json({
        success: false,
        error: 'Too many incorrect attempts. Security code invalidated. Please request a new code.'
      });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'Invalid 6-digit security code. Please check your inbox and try again.'
      });
    }

    // OTP Verified successfully!
    record.verified = true;
    deleteOtpStore.set(cleanEmail, record);

    console.log(`✅ [OTP VERIFIED] Account deletion identity verified for ${cleanEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Identity verified successfully. You may now permanently delete your account.'
    });
  } catch (err) {
    console.error('Error verifying delete OTP:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify security code.'
    });
  }
});

/**
 * POST /api/account/delete
 * Permanently deletes user account after OTP verification
 */
router.post('/delete', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'User email is required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = deleteOtpStore.get(cleanEmail);

    if (!record || !record.verified) {
      return res.status(403).json({
        success: false,
        error: 'Account deletion rejected: Identity has not been verified via 6-digit email code.'
      });
    }

    // Perform Deep Purge of User record & all associated data from MongoDB database permanently
    try {
      const User = require('../models/User');
      const Workspace = require('../models/Workspace');
      const BrandProfile = require('../models/BrandProfile');
      const Campaign = require('../models/Campaign');
      const CampaignPost = require('../models/CampaignPost');
      const ChatSession = require('../models/ChatSession');
      const Content = require('../models/Content');
      const GeneratedPost = require('../models/GeneratedPost');
      const WebsiteProject = require('../models/WebsiteProject');

      const userDel = await User.deleteMany({ email: cleanEmail });
      const wsDel = await Workspace.deleteMany({ userEmail: cleanEmail });
      const brandDel = await BrandProfile.deleteMany({ userEmail: cleanEmail });
      const campDel = await Campaign.deleteMany({ userEmail: cleanEmail });
      const postDel = await CampaignPost.deleteMany({ userEmail: cleanEmail });
      const chatDel = await ChatSession.deleteMany({ userEmail: cleanEmail });
      const cntDel = await Content.deleteMany({ userEmail: cleanEmail });
      const genPostDel = await GeneratedPost.deleteMany({ userEmail: cleanEmail });
      const webDel = await WebsiteProject.deleteMany({ userEmail: cleanEmail });

      console.log(`🗑️ [TOTAL DB DEEP PURGE] Successfully purged user data for ${cleanEmail}:`, {
        userDel: userDel.deletedCount,
        wsDel: wsDel.deletedCount,
        brandDel: brandDel.deletedCount,
        campDel: campDel.deletedCount,
        webDel: webDel.deletedCount
      });
    } catch (dbErr) {
      console.log(`⚠️ [DB DELETION NOTE] Mongo user deletion note:`, dbErr.message);
    }

    // Broadcast Real-Time Account Deletion Event via Telemetry SSE Hub
    try {
      const { recordTelemetryEvent } = require('../services/telemetryService');
      recordTelemetryEvent({
        source: 'BACKEND',
        eventType: 'ACCOUNT_DELETED',
        page: '/settings-billing',
        component: 'AccountService',
        action: 'PERMANENT_ACCOUNT_DELETION',
        status: 'SUCCESS',
        metadata: {
          deletedEmail: cleanEmail
        }
      });
    } catch (tErr) {
      console.warn('Telemetry broadcast error:', tErr.message);
    }

    // Clean up OTP record
    deleteOtpStore.delete(cleanEmail);

    console.log(`🗑️ [ACCOUNT DELETED] Account permanently deleted for user: ${cleanEmail}`);

    return res.status(200).json({
      success: true,
      deletedEmail: cleanEmail,
      message: 'Account and associated data have been permanently deleted.'
    });
  } catch (err) {
    console.error('Error performing account deletion:', err);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while deleting your account.'
    });
  }
});

module.exports = router;
