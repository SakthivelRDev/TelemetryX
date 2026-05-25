const { permissionRepository, userPermissionOverrideRepository } = require('../repositories/userRepository');
const { MODULES, sanitizeModulePermissions } = require('../config/moduleCapabilities');

/** Full access map for ADMIN (matches locked matrix in UI). */
const ADMIN_PERMISSIONS = Object.fromEntries(
  MODULES.map((m) => [m, { canRead: true, canWrite: true, canDelete: true }])
);

async function getPermissionsForRole(role) {
  if (role === 'ADMIN') return { ...ADMIN_PERMISSIONS };

  const rows = await permissionRepository.findAll();
  const map = Object.fromEntries(
    MODULES.map((m) => [m, { canRead: false, canWrite: false, canDelete: false }])
  );

  for (const p of rows.filter((r) => r.role === role)) {
    map[p.module] = sanitizeModulePermissions(p.module, p);
  }

  return map;
}

async function getEffectivePermissions(userId, role) {
  if (role === 'ADMIN') return { ...ADMIN_PERMISSIONS };

  const rolePerms   = await getPermissionsForRole(role);
  const overrides   = await userPermissionOverrideRepository.findByUserId(userId);
  const effective   = { ...rolePerms };

  for (const o of overrides) {
    effective[o.module] = sanitizeModulePermissions(o.module, o);
  }

  return effective;
}

function canAccess(permissions, module, action = 'canRead') {
  if (!permissions || !module) return false;
  return Boolean(permissions[module]?.[action]);
}

module.exports = {
  getPermissionsForRole,
  getEffectivePermissions,
  canAccess,
  ADMIN_PERMISSIONS,
  MODULES,
};
