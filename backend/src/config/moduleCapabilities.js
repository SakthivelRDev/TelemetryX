/**
 * Which permission actions apply per module (telecom NOC semantics).
 */
const MODULE_CAPABILITIES = {
  ALARM: {
    actions: ['canRead', 'canWrite'],
    labels: { canRead: 'View', canWrite: 'Manage' },
    description: 'View alarms & dashboard; manage ingest/reset',
  },
  MAP: {
    actions: ['canRead', 'canWrite'],
    labels: { canRead: 'View', canWrite: 'Region View' },
    description: 'View network map & site topology; Region View = auto-filter by user location',
  },
  API: {
    actions: ['canRead', 'canWrite', 'canDelete'],
    labels: { canRead: 'View', canWrite: 'Configure', canDelete: 'Remove' },
    description: 'View, add/edit, and remove API sources',
  },
  USER: {
    actions: ['canRead', 'canWrite', 'canDelete'],
    labels: { canRead: 'View', canWrite: 'Edit', canDelete: 'Delete' },
    description: 'View users, edit roles/overrides, delete users',
  },
};

const MODULES = Object.keys(MODULE_CAPABILITIES);

function sanitizeModulePermissions(module, body) {
  const caps = MODULE_CAPABILITIES[module];
  if (!caps) throw new Error(`Unknown module: ${module}`);

  return {
    canRead:   caps.actions.includes('canRead')   ? Boolean(body.canRead)   : false,
    canWrite:  caps.actions.includes('canWrite')  ? Boolean(body.canWrite)  : false,
    canDelete: caps.actions.includes('canDelete') ? Boolean(body.canDelete) : false,
  };
}

function actionAllowed(module, action) {
  return MODULE_CAPABILITIES[module]?.actions.includes(action) ?? false;
}

module.exports = { MODULE_CAPABILITIES, MODULES, sanitizeModulePermissions, actionAllowed };
