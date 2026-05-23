const express         = require('express');
const alarmController = require('../controllers/alarmController');
const authMiddleware  = require('../middleware/authMiddleware');
const rbac            = require('../middleware/rbacMiddleware');

const router = express.Router();

// Dashboard stats (all authenticated users can read)
router.get('/stats',          authMiddleware, rbac('ALARM', 'canRead'), alarmController.getDashboardStats);

// Raw alarms
router.get('/raw',            authMiddleware, rbac('ALARM', 'canRead'),  alarmController.getRaw);
router.get('/raw/:id',        authMiddleware, rbac('ALARM', 'canRead'),  alarmController.getRawById);

// Manual ingestion trigger (write permission required)
router.post('/ingest',        authMiddleware, rbac('ALARM', 'canWrite'), alarmController.ingest);

// Correlated events
router.get('/correlated',     authMiddleware, rbac('ALARM', 'canRead'),  alarmController.getCorrelated);
router.get('/correlated/:id', authMiddleware, rbac('ALARM', 'canRead'),  alarmController.getCorrelatedById);

module.exports = router;
