const express = require("express");
const secure = require('ssl-express-www');
const cors = require("cors");
const path = require("path");
const helmet = require('helmet');
const compression = require('compression');
const log = require("./includes/log");
const fs = require('fs');

// Read and cache configuration
const readConfig = () => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Error reading config.json:', error);
    return {};
  }
};

global.config = readConfig();
global.api = new Map();

// Initialize global statistics for real-time tracking
global.stats = {
  totalRequests: 0,
  usageCounts: {} // { apiKey: count }
};

// Path to the persistent JSON database
const dbFilePath = path.join(__dirname, 'db.json');
// If the file doesn't exist, create it with default content.
if (!fs.existsSync(dbFilePath)) {
  fs.writeFileSync(dbFilePath, JSON.stringify(global.stats, null, 2), 'utf8');
} else {
  // Otherwise, load the stats from the existing file.
  try {
    const dbData = JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
    global.stats = dbData;
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
}

const app = express();

// Pretty-print middleware
app.set('json spaces', 2); // Enable pretty-printing for JSON responses

// Override express response.json to always pretty print
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(body) {
    if (body && typeof body === 'object') {
      return originalJson.call(this, body, null, 2);
    }
    return originalJson.call(this, body);
  };
  next();
});

// Security and performance middleware
app.use(secure);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());

// Parsing and static file serving
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'includes', 'public'), { maxAge: '1d', etag: true }));
app.use(express.static(path.join(__dirname, 'includes', 'assets'), { maxAge: '1d', etag: true }));

// Middleware to track API usage on routes under /api
app.use('/api', (req, res, next) => {
  global.stats.totalRequests++;
  // Assume the API URL is like /api/<apiKey>/...
  const apiKey = req.path.split('/')[1];
  if (apiKey) {
    global.stats.usageCounts[apiKey] = (global.stats.usageCounts[apiKey] || 0) + 1;
  }
  next();
});

// Router setup
const router = require("./includes/router");
app.use(router);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Route to serve the main portal
app.get("/", (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, "includes", "public", "portal.html"), 'utf8');
    html = html.replace('</head>', `<script>window.appConfig = ${JSON.stringify(global.config, null, 2)};</script></head>`);
    res.send(html);
  } catch (error) {
    log.error('Error serving index page:', error);
    res.status(500).send('Internal server error');
  }
});

// API list endpoint
app.get("/api-list", (req, res) => {
  try {
    const apiList = Array.from(global.api.values()).map(api => ({
      name: api.config.name,
      description: api.config.description,
      endpoint: `api${api.config.link}`,
      category: api.config.category
    }));
    res.json({ apis: apiList, config: global.config });
  } catch (error) {
    log.error('Error generating API list:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: 'Failed to generate API list' 
    });
  }
});

// Real-time statistics endpoint
app.get("/stats", (req, res) => {
  try {
    // Determine the most-used API based on usageCounts
    let mostUsedApiKey = null;
    let maxCount = 0;
    for (const [apiKey, count] of Object.entries(global.stats.usageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostUsedApiKey = apiKey;
      }
    }

    // If available, retrieve the API config for the most-used API
    let mostUsedToday = { name: "N/A", category: "N/A" };
    if (mostUsedApiKey && global.api.has(mostUsedApiKey)) {
      const apiConfig = global.api.get(mostUsedApiKey).config;
      mostUsedToday = { name: apiConfig.name, category: apiConfig.category || "Unknown" };
    } else if (mostUsedApiKey) {
      // Fallback: if no config is found, return the API key itself.
      mostUsedToday = { name: mostUsedApiKey, category: "Unknown" };
    }

    res.json({
      totalRequests: global.stats.totalRequests,
      mostUsedToday
    });
  } catch (error) {
    log.error('Error fetching real-time stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve real-time statistics'
    });
  }
});

// Docs route
app.get("/docs", (req, res) => {
  try {
    res.sendFile(path.join(__dirname, "includes", "public", "docs.html"));
  } catch (error) {
    log.error('Error serving docs page:', error);
    res.status(500).send('Internal server error');
  }
});

// 404 handler
app.use((req, res) => {
  try {
    res.status(404).sendFile(path.join(__dirname, "includes", "public", "404.html"));
  } catch (error) {
    log.error('Error serving 404 page:', error);
    res.status(404).json({
      error: 'Not Found',
      message: 'Page not found'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  log.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Periodically flush the in-memory stats to the JSON database (every 10 seconds)
setInterval(() => {
  fs.writeFile(dbFilePath, JSON.stringify(global.stats, null, 2), 'utf8', (err) => {
    if (err) {
      console.error("Error saving stats to db.json:", err);
    }
  });
}, 10000);

// Server initialization
const PORT = process.env.PORT || global.config.port || 3000;
const server = app.listen(PORT, () => log.main(`Server is running on port ${PORT}`));

// Graceful shutdown
process.on('SIGTERM', () => {
  log.main('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    log.main('HTTP server closed');
    process.exit(0);
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  server.close(() => process.exit(1));
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;
