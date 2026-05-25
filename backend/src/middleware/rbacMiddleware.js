const { getEffectivePermissions } = require('../services/permissionService');
const { actionAllowed } = require('../config/moduleCapabilities');

/**
 * RBAC Middleware — checks effective permissions (role + per-user overrides).
 */
const rbac = (module, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    if (!actionAllowed(module, action)) {
      return res.status(403).json({
        error: `Action '${action}' is not applicable to module '${module}'`,
      });
    }

    try {
      const permissions = await getEffectivePermissions(req.user.id, req.user.role);

      if (!permissions[module]?.[action]) {
        return res.status(403).json({
          error: `Forbidden: You do not have '${action}' on module '${module}'`,
        });
      }

      next();
    } catch (err) {
      console.error('[RBAC] Permission check error:', err);
      return res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

module.exports = rbac;
