import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5173; 
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve static files from frontend
const distPath = join(__dirname, './dist');
app.use(express.static(distPath));

// Proxy middleware configuration
const proxyOptions = {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false,
  ws: true, // Enable WebSocket proxying
  pathRewrite: {
    '^/api': '/api',
    '^/auth': '/auth'
  },
  onProxyReq: (proxyReq, req) => {
    // Preserve cookies and headers
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }
  },
  onError: (err, req, res) => {
    console.error(`Proxy Error: ${err.message}`);
    res.status(500).send("Proxy Error");
  }
};

// Proxy API and auth requests to backend
app.use('/api', createProxyMiddleware(proxyOptions));
app.use('/auth', createProxyMiddleware(proxyOptions));

// Handle SPA routing
app.get('*', (req, res) => {
  // Skip API and auth routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.sendFile(join(distPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 Frontend Server running at http://localhost:${PORT}
📦 Serving static files from: ${distPath}
🔄 Proxying API requests to: ${BACKEND_URL}
  `);
});
