const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

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
