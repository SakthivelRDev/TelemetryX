const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const userRepository = {
  findAll: () => prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true } }),

  findById: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true } }),

  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),

  create: (data) => prisma.user.create({
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  }),

  update: (id, data) => prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, updatedAt: true },
  }),

  delete: (id) => prisma.user.delete({ where: { id } }),

  count: () => prisma.user.count(),
};

const permissionRepository = {
  findAll: () => prisma.permission.findMany({ orderBy: [{ role: 'asc' }, { module: 'asc' }] }),

  findByRoleModule: (role, module) => prisma.permission.findUnique({
    where: { role_module: { role, module } },
  }),

  upsert: (role, module, data) => prisma.permission.upsert({
    where: { role_module: { role, module } },
    update: data,
    create: { role, module, ...data },
  }),
};

const userPermissionOverrideRepository = {
  findByUserId: async (userId) => {
    try {
      if (!prisma.userPermissionOverride) {
        console.warn('[RBAC] userPermissionOverride model missing — run: npx prisma generate && npx prisma db push');
        return [];
      }
      return prisma.userPermissionOverride.findMany({ where: { userId }, orderBy: { module: 'asc' } });
    } catch (err) {
      console.error('[RBAC] findByUserId overrides:', err.message);
      return [];
    }
  },

  findByUserModule: async (userId, module) => {
    try {
      if (!prisma.userPermissionOverride) return null;
      return prisma.userPermissionOverride.findUnique({
        where: { userId_module: { userId, module } },
      });
    } catch {
      return null;
    }
  },

  upsert: async (userId, module, data) => {
    if (!prisma.userPermissionOverride) {
      throw new Error('User permission overrides not available. Restart backend after: npx prisma generate && npx prisma db push');
    }
    return prisma.userPermissionOverride.upsert({
      where: { userId_module: { userId, module } },
      update: data,
      create: { userId, module, ...data },
    });
  },

  delete: async (userId, module) => {
    try {
      if (!prisma.userPermissionOverride) return null;
      return await prisma.userPermissionOverride.delete({
        where: { userId_module: { userId, module } },
      });
    } catch {
      return null;
    }
  },
};

module.exports = { userRepository, permissionRepository, userPermissionOverrideRepository };
