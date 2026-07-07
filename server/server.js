const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { connectDB, isHealthy } = require('./db');
const AppError = require('./utils/appError');
const { getAiServerUrl, getAiServerHeaders } = require('./utils/aiServerClient');
const { getEffectiveTavilyKey } = require('./controllers/settingsController');

const app = express();
const HOST = '127.0.0.1';
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const AI_HEALTH_TIMEOUT_MS = Number(process.env.AI_HEALTH_TIMEOUT_MS) || 20000;

app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '100kb', strict: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', {
    skip: (req) => req.path === '/api/v1/ai/queue' || req.path === '/api/v1/health',
  }));
}

const chatRoutes = require('./routes/chatRoutes');
const profileRoutes = require('./routes/profileRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

app.get('/api/v1/health', async (req, res) => {
  const dbOk = isHealthy();
  let ai = {
    serverReachable: false,
    serverError: null,
    status: 'degraded',
    ollama: false,
    model: false,
    chroma: false,
  };

  try {
    const aiResponse = await fetch(`${getAiServerUrl()}/health`, {
      signal: AbortSignal.timeout(AI_HEALTH_TIMEOUT_MS),
    });
    if (aiResponse.ok) {
      const fastApiHealth = await aiResponse.json();
      ai = {
        serverReachable: true,
        serverError: null,
        status: fastApiHealth.status || 'degraded',
        ollama: Boolean(fastApiHealth.ollama),
        model: Boolean(fastApiHealth.model),
        chroma: Boolean(fastApiHealth.chroma),
      };
    } else {
      ai.serverReachable = true;
      ai.serverError = `HTTP ${aiResponse.status}`;
    }
  } catch (err) {
    ai.serverReachable = false;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      ai.serverError = 'timeout';
    } else if (err.cause?.code === 'ECONNREFUSED' || String(err.message).includes('ECONNREFUSED')) {
      ai.serverError = 'ECONNREFUSED';
    } else {
      ai.serverError = err.message;
    }
    console.warn('[Health] AI server unreachable:', ai.serverError);
  }

  const coreOk = dbOk && ai.serverReachable && ai.ollama && ai.model;
  const status = coreOk && ai.chroma ? 'ok' : 'degraded';

  res.status(coreOk ? 200 : 503).json({
    status,
    db: dbOk,
    ai,
  });
});

app.get('/api/v1/ai/queue', async (req, res) => {
  try {
    const aiResponse = await fetch(`${getAiServerUrl()}/health/queue`, {
      headers: getAiServerHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (aiResponse.ok) {
      const data = await aiResponse.json();
      return res.status(200).json({ status: 'success', data });
    }
    return res.status(503).json({ status: 'error', message: 'AI queue status unavailable' });
  } catch (err) {
    console.warn('[AI Queue] Unreachable:', err.message);
    return res.status(503).json({ status: 'error', message: 'AI queue status unavailable' });
  }
});

app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/settings', settingsRoutes);

if (isProduction) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.get('/', (req, res) => {
  if (isProduction) {
    return res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }
  res.status(200).json({ status: 'success', message: 'AskPeri local backend is running' });
});

app.use((req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV !== 'production') {
    console.error('ERROR 💥', err);
  }

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

if (require.main === module) {
  connectDB();
  const tavilyKey = getEffectiveTavilyKey();
  if (tavilyKey) {
    process.env.TAVILY_API_KEY = tavilyKey;
  }
  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`✅ Server running on http://${HOST}:${PORT}${isProduction ? ' (production)' : ''}`);
  });
  httpServer.on('error', (err) => {
    console.error(`[server] Failed to bind ${HOST}:${PORT}:`, err.message);
    process.exit(1);
  });
}

module.exports = app;
