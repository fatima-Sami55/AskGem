const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { loadUser } = require('../middleware/singleUser');
const { requireClearAllConfirm } = require('../middleware/clearAllGuard');

router.use(loadUser);

router.get('/', settingsController.getSettings);
router.put('/tavily', settingsController.updateTavilyKey);
router.post('/clear-all', requireClearAllConfirm, settingsController.clearAllData);

module.exports = router;
