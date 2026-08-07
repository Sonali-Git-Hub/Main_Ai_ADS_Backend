const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Campaign CRUD
router.get('/', campaignController.listCampaigns);
router.get('/:id', campaignController.getCampaign);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Campaign posts
router.get('/:id/posts', campaignController.getCampaignPosts);
router.post('/:id/generate-plan', campaignController.generateCampaignPlan);
router.post('/posts/:postId/generate-content', campaignController.generatePostContent);
router.patch('/posts/:postId/status', campaignController.updatePostStatus);

// Utility
router.post('/dates/calculate', campaignController.calculateDates);

module.exports = router;
