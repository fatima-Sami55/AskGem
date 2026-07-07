const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { loadUser } = require('../middleware/singleUser');

router.use(loadUser);

router.get('/', settingsController.getSettings);
router.put('/tavily', settingsController.updateTavilyKey);
router.post('/clear-all', settingsController.clearAllData);

module.exports = router;
