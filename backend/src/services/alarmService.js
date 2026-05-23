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
    const [totalRaw, openEvents, criticalSites, allSites] = await Promise.all([
      alarmRepository.count(),
      correlationRepository.countOpen(),
      prisma.site.count({ where: { status: 'CRITICAL' } }),
      prisma.site.findMany({ select: { status: true } }),
    ]);

    // Severity breakdown (3-level)
    const severities = ['CRITICAL', 'MEDIUM', 'LOW'];
    const severityCounts = {};
    for (const s of severities) {
      severityCounts[s] = await alarmRepository.countBySeverity(s);
    }

    // Site status breakdown
    const siteStatuses = {
      CRITICAL: allSites.filter((s) => s.status === 'CRITICAL').length,
      WARNING:  allSites.filter((s) => s.status === 'WARNING').length,
      OK:       allSites.filter((s) => s.status === 'OK').length,
    };

    return {
      totalRaw,
      openEvents,
      criticalSites,
      criticalAlarms: severityCounts.CRITICAL,
      severityCounts,
      siteStatuses,
    };
  },

  // Returns alarm counts grouped by hour for the last 12 hours
  getAlarmTimeSeries: async () => {
    const now   = new Date();
    const hours = [];

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const end   = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = `${end.getHours().toString().padStart(2, '0')}:00`;

      const [total, critical, medium, low] = await Promise.all([
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end } } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'CRITICAL' } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'MEDIUM'   } }),
        prisma.rawAlarm.count({ where: { timestamp: { gte: start, lt: end }, severity: 'LOW'      } }),
      ]);

      hours.push({ hour: label, total, critical, medium, low });
    }

    return { series: hours };
  },
};

module.exports = alarmService;

