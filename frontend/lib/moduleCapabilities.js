/** Frontend mirror of backend module permission capabilities. */
export const MODULE_CAPABILITIES = {
  ALARM: {
    actions: ['canRead', 'canWrite'],
    labels: { canRead: 'View', canWrite: 'Manage' },
    description: 'View alarms & dashboard; manage ingest/reset',
  },
  MAP: {
    actions: ['canRead', 'canWrite'],
    labels: { canRead: 'View', canWrite: 'Region View' },
    description: 'View network map & site topology; Region View = auto-filter by location',
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

export const MODULES = Object.keys(MODULE_CAPABILITIES);

export const ALL_ACTIONS = ['canRead', 'canWrite', 'canDelete'];
