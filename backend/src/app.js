require('dotenv').config();
const express    = require('express');
const cors       = require('cors');

const authRoutes      = require('./routes/authRoutes');
const userRoutes      = require('./routes/userRoutes');
const alarmRoutes     = require('./routes/alarmRoutes');
const mapRoutes       = require('./routes/mapRoutes');
const apiSourceRoutes = require('./routes/apiSourceRoutes');

const { runIngestion } = require('./services/apiIngestionService');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'App360 API',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/alarms',  alarmRoutes);
app.use('/api/map',     mapRoutes);
app.use('/api/sources', apiSourceRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 App360 Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api\n`);

  // ── Real-time Ingestion Loop (every 10 seconds) ───────────────────────────
  console.log('[INGEST] Starting ingestion pipeline (10s interval)...');

  // Run once immediately at startup
  setTimeout(() => {
    runIngestion();
  }, 2000);

  // Then every 10 seconds
  setInterval(() => {
    runIngestion();
  }, 10000);
});

module.exports = app;
