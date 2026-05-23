const alarmService       = require('../services/alarmService');
const { runIngestion }   = require('../services/apiIngestionService');

const alarmController = {
  getRaw: async (req, res) => {
    try {
      const { page = 1, limit = 20, severity, siteId, source } = req.query;
      const result = await alarmService.getRawAlarms({
        page: parseInt(page),
        limit: parseInt(limit),
        severity,
        siteId,
        source,
      });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getRawById: async (req, res) => {
    try {
      const alarm = await alarmService.getRawAlarmById(req.params.id);
      return res.status(200).json({ alarm });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  ingest: async (req, res) => {
    try {
      // Trigger manual ingestion run
      runIngestion(); // non-blocking, runs in background
      return res.status(202).json({ message: 'Ingestion triggered successfully' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getCorrelated: async (req, res) => {
    try {
      const { page = 1, limit = 20, severity, status, siteId } = req.query;
      const result = await alarmService.getCorrelatedEvents({
        page: parseInt(page),
        limit: parseInt(limit),
        severity,
        status,
        siteId,
      });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getCorrelatedById: async (req, res) => {
    try {
      const event = await alarmService.getCorrelatedEventById(req.params.id);
      return res.status(200).json({ event });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  getDashboardStats: async (req, res) => {
    try {
      const stats = await alarmService.getDashboardStats();
      return res.status(200).json(stats);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};

module.exports = alarmController;
