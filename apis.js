const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Simple logger implementation (since the original logger might be missing)
const log = async (component, level, category, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${component}] [${level.toUpperCase()}] [${category}] ${message}`);
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  log('backend', 'info', 'request', `${req.method} ${req.path}`);
  next();
};

// Middleware
app.use(express.json());
app.use(requestLogger);

const urlDatabase = new Map();
const expiryDatabase = new Map();

// Utility function to generate random shortcode
function generateShortcode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Utility function to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Utility function to validate shortcode
function isValidShortcode(shortcode) {
  return /^[a-zA-Z0-9]+$/.test(shortcode) && shortcode.length >= 3 && shortcode.length <= 20;
}

// Utility function to check if URL is expired
function isExpired(shortcode) {
  const expiryTime = expiryDatabase.get(shortcode);
  if (!expiryTime) return true;
  return new Date() > new Date(expiryTime);
}

// Cleanup expired URLs (run periodically)
function cleanupExpiredUrls() {
  const now = new Date();
  for (const [shortcode, expiryTime] of expiryDatabase.entries()) {
    if (now > new Date(expiryTime)) {
      urlDatabase.delete(shortcode);
      expiryDatabase.delete(shortcode);
      log('backend', 'info', 'service', `Cleaned up expired URL with shortcode: ${shortcode}`);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredUrls, 5 * 60 * 1000);

// API Endpoints

// Create Short URL
app.post('/shorturls', async (req, res) => {
  try {
    const { url, validity = 30, shortcode } = req.body;

    // Validate required fields
    if (!url) {
      await log('backend', 'warn', 'controller', 'URL shortening failed: Missing URL parameter');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'URL is required'
      });
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      await log('backend', 'warn', 'controller', `URL shortening failed: Invalid URL format - ${url}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid URL format'
      });
    }

    // Validate validity (must be positive integer)
    if (!Number.isInteger(validity) || validity <= 0) {
      await log('backend', 'warn', 'controller', `URL shortening failed: Invalid validity period - ${validity}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Validity must be a positive integer representing minutes'
      });
    }

    let finalShortcode;

    // Handle custom shortcode
    if (shortcode) {
      if (!isValidShortcode(shortcode)) {
        await log('backend', 'warn', 'controller', `URL shortening failed: Invalid shortcode format - ${shortcode}`);
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Shortcode must be alphanumeric, 3-20 characters long'
        });
      }

      if (urlDatabase.has(shortcode)) {
        await log('backend', 'warn', 'controller', `URL shortening failed: Shortcode already exists - ${shortcode}`);
        return res.status(409).json({
          error: 'Conflict',
          message: 'Shortcode already exists'
        });
      }

      finalShortcode = shortcode;
    } else {
      // Generate unique shortcode
      do {
        finalShortcode = generateShortcode();
      } while (urlDatabase.has(finalShortcode));
    }

    // Calculate expiry time
    const expiryTime = new Date(Date.now() + validity * 60 * 1000);

    // Store in database
    urlDatabase.set(finalShortcode, {
      originalUrl: url,
      createdAt: new Date(),
      accessCount: 0
    });
    expiryDatabase.set(finalShortcode, expiryTime);

    const shortLink = `${BASE_URL}/${finalShortcode}`;

    await log('backend', 'info', 'service', `URL shortened successfully: ${url} -> ${shortLink} (expires: ${expiryTime.toISOString()})`);

    res.status(201).json({
      shortLink: shortLink,
      expiry: expiryTime.toISOString()
    });

  } catch (error) {
    await log('backend', 'error', 'controller', `URL shortening error: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while creating the short URL'
    });
  }
});

// Retrieve Short URL Statistics
app.get('/shorturls/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;

    if (!urlDatabase.has(shortcode)) {
      await log('backend', 'warn', 'controller', `Statistics request failed: Shortcode not found - ${shortcode}`);
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shortcode not found'
      });
    }

    if (isExpired(shortcode)) {
      // Clean up expired entry
      urlDatabase.delete(shortcode);
      expiryDatabase.delete(shortcode);
      await log('backend', 'info', 'service', `Cleaned up expired shortcode during stats request: ${shortcode}`);
      return res.status(410).json({
        error: 'Gone',
        message: 'Short URL has expired'
      });
    }

    const urlData = urlDatabase.get(shortcode);
    const expiryTime = expiryDatabase.get(shortcode);

    await log('backend', 'info', 'controller', `Statistics retrieved for shortcode: ${shortcode}`);

    res.json({
      shortcode: shortcode,
      originalUrl: urlData.originalUrl,
      createdAt: urlData.createdAt.toISOString(),
      expiry: expiryTime,
      accessCount: urlData.accessCount
    });

  } catch (error) {
    await log('backend', 'error', 'controller', `Statistics retrieval error: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while retrieving statistics'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Redirect Short URL - This should be LAST among GET routes
app.get('/:shortcode', async (req, res) => {
  try {
    const { shortcode } = req.params;

    // Skip if it's a known API path
    if (shortcode === 'shorturls' || shortcode === 'health') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Route not found'
      });
    }

    if (!urlDatabase.has(shortcode)) {
      await log('backend', 'warn', 'handler', `Redirect failed: Shortcode not found - ${shortcode}`);
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shortcode not found'
      });
    }

    if (isExpired(shortcode)) {
      // Clean up expired entry
      urlDatabase.delete(shortcode);
      expiryDatabase.delete(shortcode);
      await log('backend', 'info', 'service', `Cleaned up expired shortcode during redirect: ${shortcode}`);
      return res.status(410).json({
        error: 'Gone',
        message: 'Short URL has expired'
      });
    }

    const urlData = urlDatabase.get(shortcode);
    
    // Increment access count
    urlData.accessCount++;
    urlDatabase.set(shortcode, urlData);

    await log('backend', 'info', 'handler', `Redirect successful: ${shortcode} -> ${urlData.originalUrl} (access count: ${urlData.accessCount})`);

    res.redirect(302, urlData.originalUrl);

  } catch (error) {
    await log('backend', 'error', 'handler', `Redirect error: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while processing the redirect'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  log('backend', 'error', 'handler', `Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler for all other routes
app.use((req, res) => {
  log('backend', 'warn', 'handler', `404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not Found',
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, async () => {
  await log('backend', 'info', 'service', `URL Shortener Microservice started on port ${PORT}`);
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;