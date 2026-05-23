const mapService = require('../services/mapService');

const mapController = {
  getSites: async (req, res) => {
    try {
      const { region, severity, status } = req.query;
      const sites = await mapService.getAllSites({ region, severity, status });
      return res.status(200).json({ sites });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getSiteById: async (req, res) => {
    try {
      const site = await mapService.getSiteById(req.params.id);
      return res.status(200).json({ site });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },
};

module.exports = mapController;
