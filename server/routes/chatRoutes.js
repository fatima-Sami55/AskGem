const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { loadUser } = require('../middleware/singleUser');
const { chatLimiter } = require('../middleware/rateLimiter');

router.use(loadUser);

router.get('/sessions', chatController.getSessions);
router.post('/session', chatController.createSession);
router.get('/session/:id', chatController.getSession);
router.post('/session/:id/message', chatLimiter, chatController.sendMessage);
router.post('/session/:id/stream', chatLimiter, chatController.sendMessageStream);
router.post('/session/:id/generate-roadmap', chatController.generateRoadmap);
router.delete('/session/:id', chatController.deleteSession);

module.exports = router;
