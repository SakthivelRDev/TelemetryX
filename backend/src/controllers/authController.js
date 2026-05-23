const authService = require('../services/authService');

const authController = {
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const result = await authService.login(email, password);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  },

  logout: (req, res) => {
    // JWT is stateless — client deletes the token
    return res.status(200).json({ message: 'Logged out successfully' });
  },

  me: (req, res) => {
    return res.status(200).json({ user: req.user });
  },
};

module.exports = authController;
