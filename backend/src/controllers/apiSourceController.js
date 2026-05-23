const apiSourceRepository = require('../repositories/apiSourceRepository');
const { runIngestion }    = require('../services/apiIngestionService');

const apiSourceController = {
  getAll: async (req, res) => {
    try {
      const sources = await apiSourceRepository.findAll();
      return res.status(200).json({ sources });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { name, url, type } = req.body;
      if (!name || !url || !type) {
        return res.status(400).json({ error: 'name, url, and type are required' });
      }
      const source = await apiSourceRepository.create({ name, url, type });
      return res.status(201).json({ source });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  poll: async (req, res) => {
    try {
      const source = await apiSourceRepository.findById(req.params.id);
      if (!source) return res.status(404).json({ error: 'Source not found' });

      // Trigger ingestion and update timestamp
      runIngestion(); // async, non-blocking
      await apiSourceRepository.updatePolled(req.params.id);

      return res.status(202).json({ message: `Polling triggered for '${source.name}'` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      await apiSourceRepository.delete(req.params.id);
      return res.status(200).json({ message: 'Source deleted' });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};

module.exports = apiSourceController;
