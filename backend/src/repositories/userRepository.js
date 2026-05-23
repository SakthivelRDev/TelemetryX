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

module.exports = { userRepository, permissionRepository };
