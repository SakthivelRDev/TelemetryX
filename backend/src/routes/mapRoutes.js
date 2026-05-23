const express       = require('express');
const mapController = require('../controllers/mapController');
const authMiddleware = require('../middleware/authMiddleware');
const rbac          = require('../middleware/rbacMiddleware');

const router = express.Router();

router.get('/sites',     authMiddleware, rbac('MAP', 'canRead'), mapController.getSites);
router.get('/sites/:id', authMiddleware, rbac('MAP', 'canRead'), mapController.getSiteById);

module.exports = router;
