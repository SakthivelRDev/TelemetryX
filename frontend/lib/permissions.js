/** Default: no access until permissions load from API. */
export const EMPTY_PERMISSIONS = {
  ALARM: { canRead: false, canWrite: false, canDelete: false },
  MAP:   { canRead: false, canWrite: false, canDelete: false },
  API:   { canRead: false, canWrite: false, canDelete: false },
  USER:  { canRead: false, canWrite: false, canDelete: false },
};

export function canAccessModule(permissions, module, action = 'canRead', role) {
  if (role === 'ADMIN') return true;
  return Boolean(permissions?.[module]?.[action]);
}
