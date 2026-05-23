const { permissionRepository } = require('../repositories/userRepository');

const MODULES = ['ALARM', 'MAP', 'API', 'USER'];
const ACTIONS = ['canRead', 'canWrite', 'canDelete'];

/** Full access map for ADMIN (matches locked matrix in UI). */
const ADMIN_PERMISSIONS = Object.fromEntries(
  MODULES.map((m) => [m, { canRead: true, canWrite: true, canDelete: true }])
);

/**
 * Returns permissions for a role as { ALARM: { canRead, canWrite, canDelete }, ... }
 */
async function getPermissionsForRole(role) {
  if (role === 'ADMIN') return ADMIN_PERMISSIONS;

  const rows = await permissionRepository.findAll();
  const map = Object.fromEntries(
    MODULES.map((m) => [m, { canRead: false, canWrite: false, canDelete: false }])
  );

  for (const p of rows.filter((r) => r.role === role)) {
    map[p.module] = {
      canRead:   Boolean(p.canRead),
      canWrite:  Boolean(p.canWrite),
      canDelete: Boolean(p.canDelete),
    };
  }

  return map;
}

function canAccess(permissions, module, action = 'canRead') {
  if (!permissions || !module) return false;
  return Boolean(permissions[module]?.[action]);
}

module.exports = { getPermissionsForRole, canAccess, MODULES, ACTIONS };
