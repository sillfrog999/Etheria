
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { validateEnv } from './config/env.js';
import { setupRoutes } from './routes/index.js';
import { setupSocketHandlers } from './socket/index.js';
import { GameStateManager } from './game/GameStateManager.js';

const env = validateEnv();

const app = express();

const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

const gameState = new GameStateManager();

setupRoutes(app, gameState, env);
setupSocketHandlers(io, gameState, env);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    players: gameState.getPlayerCount(),
  });
});

const PORT = env.PORT;

httpServer.listen(PORT, () => {
  console.log(`[Etheria Server] Running on port ${PORT} (${env.NODE_ENV})`);
  console.log(`[Etheria Server] Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
async function shutdown() {
  console.log('[Etheria Server] Shutting down gracefully...');
  await gameState.persistAll();

  httpServer.close(() => {
    console.log('[Etheria Server] HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
