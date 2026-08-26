const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

// Save Asset to Library & Trigger Telemetry
router.post('/save-asset', contentController.saveAsset);

// Social content
router.post('/social/generate', contentController.generateSocialPost);

// Blog
router.post('/blog/draft', contentController.generateBlogDraft);

// Email
router.post('/email/generate', contentController.generateEmailCopy);

// Ad copy
router.post('/ad-copy/generate', contentController.generateAdCopy);

// Repurpose
router.post('/repurpose', contentController.repurposeContent);

// Fact check
router.post('/fact-check', contentController.factCheckContent);

module.exports = router;
