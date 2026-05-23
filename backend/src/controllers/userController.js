const userService = require('../services/userService');

const userController = {
  getAll: async (req, res) => {
    try {
      const users = await userService.getAllUsers();
      return res.status(200).json({ users });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const user = await userService.getUserById(req.params.id);
      return res.status(200).json({ user });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const user = await userService.createUser(req.body);
      return res.status(201).json({ user });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      return res.status(200).json({ user });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      await userService.deleteUser(req.params.id);
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  getPermissions: async (req, res) => {
    try {
      const permissions = await userService.getAllPermissions();
      return res.status(200).json({ permissions });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  updatePermission: async (req, res) => {
    try {
      const { role, module } = req.params;
      const permission = await userService.updatePermission(role, module, req.body);
      return res.status(200).json({ permission });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};

module.exports = userController;
