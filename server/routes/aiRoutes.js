const express = require('express');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/next-question', aiController.getNextQuestion);
router.post('/recommend', aiController.getRecommendations);
router.post('/roadmap', aiController.getRoadmap);

module.exports = router;
