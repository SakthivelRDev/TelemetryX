const express        = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const rbac           = require('../middleware/rbacMiddleware');

const router = express.Router();

// ⚠️ Specific routes MUST come before parameterized /:id routes
// otherwise /permissions/all is matched by /:id (id = 'permissions')

// Permissions management
router.get('/permissions/all',              authMiddleware, rbac('USER', 'canRead'),   userController.getPermissions);
router.put('/permissions/:role/:module',    authMiddleware, rbac('USER', 'canWrite'),  userController.updatePermission);
router.get('/permissions/user/:userId',     authMiddleware, rbac('USER', 'canRead'),   userController.getUserEffectivePermissions);

// CRUD routes (parameterized — must come AFTER specific paths)
router.get('/',       authMiddleware, rbac('USER', 'canRead'),   userController.getAll);
router.get('/:id',    authMiddleware, rbac('USER', 'canRead'),   userController.getById);
router.post('/',      authMiddleware, rbac('USER', 'canWrite'),  userController.create);
router.put('/:id',    authMiddleware, rbac('USER', 'canWrite'),  userController.update);
router.delete('/:id', authMiddleware, rbac('USER', 'canDelete'), userController.delete);

module.exports = router;
