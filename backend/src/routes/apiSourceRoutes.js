const express              = require('express');
const apiSourceController  = require('../controllers/apiSourceController');
const authMiddleware       = require('../middleware/authMiddleware');
const rbac                 = require('../middleware/rbacMiddleware');

const router = express.Router();

router.get('/',           authMiddleware, rbac('API', 'canRead'),   apiSourceController.getAll);
router.post('/',          authMiddleware, rbac('API', 'canWrite'),  apiSourceController.create);
router.post('/:id/poll',  authMiddleware, rbac('API', 'canRead'),   apiSourceController.poll);
router.delete('/:id',     authMiddleware, rbac('API', 'canDelete'), apiSourceController.delete);

module.exports = router;
