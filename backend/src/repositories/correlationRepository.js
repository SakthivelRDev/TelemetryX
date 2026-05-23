const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const correlationRepository = {
  create: (data) => prisma.correlatedEvent.create({ data }),

  findAll: ({ page = 1, limit = 20, severity, status, siteId } = {}) => {
    const where = {};
    if (severity) where.severity = severity;
    if (status)   where.status   = status;
    if (siteId)   where.siteId   = siteId;

    return prisma.correlatedEvent.findMany({
      where,
      orderBy: { startTime: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
    });
  },

  findById: (id) => prisma.correlatedEvent.findUnique({ where: { id } }),

  findOpenByGroupKey: (groupKey) =>
    prisma.correlatedEvent.findFirst({
      where: { groupKey, status: 'OPEN' },
      orderBy: { startTime: 'desc' },
    }),

  update: (id, data) => prisma.correlatedEvent.update({ where: { id }, data }),

  updateByGroupKey: (groupKey, data) =>
    prisma.correlatedEvent.updateMany({ where: { groupKey, status: 'OPEN' }, data }),

  count: (where = {}) => prisma.correlatedEvent.count({ where }),

  countOpen: () => prisma.correlatedEvent.count({ where: { status: 'OPEN' } }),

  countBySeverityAndStatus: (severity, status) =>
    prisma.correlatedEvent.count({ where: { severity, status } }),
};

module.exports = correlationRepository;
