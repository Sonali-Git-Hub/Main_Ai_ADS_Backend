const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Session management
router.get('/sessions', chatController.listSessions);
router.get('/sessions/:sessionId', chatController.getSession);
router.delete('/sessions/:sessionId', chatController.deleteSession);
router.patch('/sessions/:sessionId/title', chatController.renameSession);

// Message sending
router.post('/', chatController.sendMessage);

module.exports = router;
