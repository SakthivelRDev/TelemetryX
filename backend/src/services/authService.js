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
};

module.exports = authService;
