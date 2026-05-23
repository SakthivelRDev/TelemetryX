const express        = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const rbac           = require('../middleware/rbacMiddleware');

const router = express.Router();

// All user routes require auth + USER module permission
router.get('/',                    authMiddleware, rbac('USER', 'canRead'),   userController.getAll);
router.get('/:id',                 authMiddleware, rbac('USER', 'canRead'),   userController.getById);
router.post('/',                   authMiddleware, rbac('USER', 'canWrite'),  userController.create);
router.put('/:id',                 authMiddleware, rbac('USER', 'canWrite'),  userController.update);
router.delete('/:id',              authMiddleware, rbac('USER', 'canDelete'), userController.delete);

// Permissions management (ADMIN only via canWrite on USER module)
router.get('/permissions/all',     authMiddleware, rbac('USER', 'canRead'),   userController.getPermissions);
router.put('/permissions/:role/:module', authMiddleware, rbac('USER', 'canWrite'), userController.updatePermission);

module.exports = router;
