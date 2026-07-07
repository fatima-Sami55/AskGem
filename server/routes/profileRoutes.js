const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { loadUser } = require('../middleware/singleUser');

router.use(loadUser);

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.get('/score', profileController.getProfileScore);
router.get('/recommendations/universities', profileController.getUniversityRecommendations);
router.get('/recommendations/scholarships', profileController.getScholarshipRecommendations);

module.exports = router;
