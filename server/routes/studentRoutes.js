const express = require('express');
const studentController = require('../controllers/studentController');

const router = express.Router();

router.post('/profile', studentController.createProfile);
router.get('/:id', studentController.getProfile);

module.exports = router;
