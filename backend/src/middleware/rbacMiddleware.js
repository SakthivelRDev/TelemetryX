const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * RBAC Middleware Factory
 * Usage: rbac('ALARM', 'canRead')
 * Queries permissions table dynamically — not hardcoded by role.
 */
const rbac = (module, action) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user context' });
    }

    try {
      const permission = await prisma.permission.findUnique({
        where: {
          role_module: {
            role: req.user.role,
            module: module,
          },
        },
      });

      if (!permission || !permission[action]) {
        return res.status(403).json({
          error: `Forbidden: Role '${req.user.role}' does not have '${action}' on module '${module}'`,
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
