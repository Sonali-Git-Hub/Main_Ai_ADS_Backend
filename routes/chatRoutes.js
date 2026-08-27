const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { optionalAuth } = require('../middleware/auth');

// Session management
router.get('/sessions', optionalAuth, chatController.listSessions);
router.get('/sessions/:sessionId', optionalAuth, chatController.getSession);
router.delete('/sessions/:sessionId', optionalAuth, chatController.deleteSession);
router.patch('/sessions/:sessionId/title', optionalAuth, chatController.renameSession);

// Message sending
router.post('/', optionalAuth, chatController.sendMessage);

module.exports = router;
