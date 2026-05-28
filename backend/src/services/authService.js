const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { userRepository } = require('../repositories/userRepository');
const { getEffectivePermissions } = require('./permissionService');

const authService = {
  login: async (email, password) => {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const permissions = await getEffectivePermissions(user.id, user.role);

    return {
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
      permissions,
    };
  },

  getMe: async (userId, role) => {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    const permissions = await getEffectivePermissions(user.id, role);
    return {
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
      permissions,
    };
  },

  updateMe: async (userId, body) => {
    const currentUser = await userRepository.findById(userId);
    if (!currentUser) throw new Error('User not found');

    const updateData = {};

    if (body.name && body.name.trim()) updateData.name = body.name.trim();

    if (body.email && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      const existing = await userRepository.findByEmail(email);
      if (existing && existing.id !== userId) {
        throw new Error('Email already in use');
      }
      updateData.email = email;
    }

    if (body.password && body.password.trim()) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      const permissions = await getEffectivePermissions(currentUser.id, currentUser.role);
      return { user: currentUser, permissions };
    }

    const user = await userRepository.update(userId, updateData);
    const permissions = await getEffectivePermissions(userId, currentUser.role);

    return { user, permissions };
  },
};

module.exports = authService;
