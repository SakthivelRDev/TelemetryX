const bcrypt = require('bcryptjs');
const { userRepository, permissionRepository } = require('../repositories/userRepository');

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

  updatePermission: async (role, module, { canRead, canWrite, canDelete }) => {
    return permissionRepository.upsert(role, module, { canRead, canWrite, canDelete });
  },
};

module.exports = userService;
