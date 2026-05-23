const alarmRepository       = require('../repositories/alarmRepository');
const correlationRepository = require('../repositories/correlationRepository');
const { PrismaClient }      = require('@prisma/client');
const prisma                = new PrismaClient();

const alarmService = {
  getRawAlarms: async ({ page, limit, severity, siteId, source } = {}) => {
    const [alarms, total] = await Promise.all([
      alarmRepository.findAll({ page, limit, severity, siteId, source }),
      alarmRepository.count({ ...(severity && { severity }), ...(siteId && { siteId }) }),
    ]);
    return { alarms, total, page, limit };
  },

  getRawAlarmById: async (id) => {
    const alarm = await alarmRepository.findById(id);
    if (!alarm) throw new Error('Alarm not found');
    return alarm;
  },

  getCorrelatedEvents: async ({ page, limit, severity, status, siteId } = {}) => {
    const [events, total] = await Promise.all([
      correlationRepository.findAll({ page, limit, severity, status, siteId }),
      correlationRepository.count({
        ...(severity && { severity }),
        ...(status   && { status }),
        ...(siteId   && { siteId }),
      }),
    ]);
    return { events, total, page, limit };
  },

  getCorrelatedEventById: async (id) => {
    const event = await correlationRepository.findById(id);
    if (!event) throw new Error('Correlated event not found');

    // Fetch the actual raw alarms for drill-down
    const rawAlarms = await prisma.rawAlarm.findMany({
      where: { id: { in: event.alarmIds } },
      orderBy: { timestamp: 'desc' },
    });

    // Fetch site info
    const site = await prisma.site.findUnique({ where: { id: event.siteId } });

    return { ...event, rawAlarms, site };
  },

  getDashboardStats: async () => {
    const [totalRaw, openEvents, criticalSites, criticalAlarms] = await Promise.all([
      alarmRepository.count(),
      correlationRepository.countOpen(),
      prisma.site.count({ where: { status: 'CRITICAL' } }),
      alarmRepository.countBySeverity('CRITICAL'),
    ]);

    return { totalRaw, openEvents, criticalSites, criticalAlarms };
  },
};

module.exports = alarmService;
