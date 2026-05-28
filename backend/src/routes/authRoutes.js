const express        = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const rbac           = require('../middleware/rbacMiddleware');

const router = express.Router();

router.post('/login',  authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me',      authMiddleware, authController.me);
router.put('/me',      authMiddleware, rbac('PROFILE', 'canWrite'), authController.updateMe);

module.exports = router;
