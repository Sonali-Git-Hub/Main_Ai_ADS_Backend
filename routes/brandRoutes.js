const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

// Brand analysis & profile
router.post('/analyze', brandController.analyzeBrand);
router.get('/:workspaceId', brandController.getBrandProfile);
router.put('/:workspaceId', brandController.updateBrandProfile);
router.post('/regenerate-section', brandController.regenerateSection);

module.exports = router;
