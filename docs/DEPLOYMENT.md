# DEPLOYMENT GUIDE — PROJECT ETHERIA

## 1. RENDER CONFIGURATION (`render.yaml`)
Project Etheria is pre-configured for automated deployment to Render:

### Backend Service (`etheria-server`):
- **Service Type**: Node.js Web Service (Paid plan recommended for uninterrupted WebSocket connection persistence).
- **Build Command**:
  ```bash
  npm install -g pnpm && pnpm install && pnpm --filter @etheria/shared build && pnpm --filter @etheria/game-data build && pnpm --filter @etheria/protocol build && pnpm --filter @etheria/world-generator build && pnpm --filter @etheria/server build
  ```
- **Start Command**: `node apps/server/dist/index.js`
- **Health Check Endpoint**: `/health`

### Frontend Static Site (`etheria-web`):
- **Service Type**: Static Site
- **Build Command**:
  ```bash
  npm install -g pnpm && pnpm install && pnpm --filter @etheria/shared build && pnpm --filter @etheria/game-data build && pnpm --filter @etheria/protocol build && pnpm --filter @etheria/web build
  ```
- **Publish Directory**: `apps/web/dist`

---

## 2. ENVIRONMENT VARIABLES
### Server:
- `NODE_ENV`: `production`
- `PORT`: `3001`
- `SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret (backend only!)
- `SUPABASE_ANON_KEY`: Supabase anon public key
- `CLIENT_URL`: URL of the deployed frontend static site

### Web Client:
- `VITE_API_URL`: Backend service URL (`https://etheria-server.onrender.com`)
- `VITE_SOCKET_URL`: Backend WebSocket URL
- `VITE_SUPABASE_URL`: Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public key
