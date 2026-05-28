const bcrypt = require('bcryptjs');
const { userRepository, permissionRepository, userPermissionOverrideRepository } = require('../repositories/userRepository');
const { sanitizeModulePermissions } = require('../config/moduleCapabilities');
const { getPermissionsForRole, getEffectivePermissions } = require('./permissionService');

const userService = {
  getAllUsers: () => userRepository.findAll(),

  getUserById: async (id) => {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  },

  createUser: async ({ name, email, password, role }) => {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new Error('Email already in use');

    const hashedPassword = await bcrypt.hash(password, 10);
    return userRepository.create({ name, email, password: hashedPassword, role });
  },

  updateUser: async (id, { name, email, role, password }) => {
    const existing = await userRepository.findById(id);
    if (!existing) throw new Error('User not found');

    const updateData = {};
    if (name)  updateData.name  = name;
    if (email) updateData.email = email;
    if (role)  updateData.role  = role;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    return userRepository.update(id, updateData);
  },

  deleteUser: async (id) => {
    const existing = await userRepository.findById(id);
    if (!existing) throw new Error('User not found');
    return userRepository.delete(id);
  },

  getAllPermissions: () => permissionRepository.findAll(),

  updatePermission: async (role, module, body) => {
    if (role === 'ADMIN') {
      const alwaysOn = sanitizeModulePermissions(module, {
        canRead: true,
        canWrite: true,
        canDelete: true,
      });
      return permissionRepository.upsert(role, module, alwaysOn);
    }
    const sanitized = sanitizeModulePermissions(module, body);
    return permissionRepository.upsert(role, module, sanitized);
  },

  getUserPermissionDetail: async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    const rolePermissions = await getPermissionsForRole(user.role);
    const overrides       = await userPermissionOverrideRepository.findByUserId(userId);
    const effective       = await getEffectivePermissions(userId, user.role);

    const overrideMap = Object.fromEntries(overrides.map((o) => [o.module, o]));

    return {
      user,
      rolePermissions,
      overrides: overrideMap,
      effective,
    };
  },

  updateUserPermission: async (userId, module, body) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.role === 'ADMIN') throw new Error('Cannot override Admin permissions');

    const sanitized = sanitizeModulePermissions(module, body);
    const saved = await userPermissionOverrideRepository.upsert(userId, module, sanitized);
    const effective = await getEffectivePermissions(userId, user.role);
    return { override: saved, effective };
  },

  clearUserPermissionOverride: async (userId, module) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');

    await userPermissionOverrideRepository.delete(userId, module);
    const effective = await getEffectivePermissions(userId, user.role);
    return { effective };
  },
};

module.exports = userService;
