const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const alarmRepository = {
  createMany: (alarms) => prisma.rawAlarm.createMany({ data: alarms }),

  findAll: ({ page = 1, limit = 20, severity, siteId, source } = {}) => {
    const where = {};
    if (severity) where.severity = severity;
    if (siteId)   where.siteId   = siteId;
    if (source)   where.source   = source;

    return prisma.rawAlarm.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    });
  },

  findById: (id) => prisma.rawAlarm.findUnique({ where: { id } }),

  findBySiteAndDevice: (siteId, deviceId, since) =>
    prisma.rawAlarm.findMany({
      where: { siteId, deviceId, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    }),

  findBySiteInWindow: (siteId, since) =>
    prisma.rawAlarm.findMany({
      where: { siteId, timestamp: { gte: since }, severity: { in: ['CRITICAL', 'MAJOR'] } },
      orderBy: { timestamp: 'asc' },
    }),

  findUnprocessed: () =>
    prisma.rawAlarm.findMany({
      where: { normalized: true },
      orderBy: { timestamp: 'asc' },
    }),

  count: (where = {}) => prisma.rawAlarm.count({ where }),

  countBySeverity: (severity) => prisma.rawAlarm.count({ where: { severity } }),
};

module.exports = alarmRepository;
