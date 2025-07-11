const axios = require('axios')
const API_URL = 'http://20.244.56.144/evaluation-service/logs';
const VALID_STACKS = ['backend', 'frontend'];
const VALID_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const VALID_PACKAGES = ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service'];

async function log(stack, level, packageName, message, authHeader) {
  if (!VALID_STACKS.includes(stack.toLowerCase())) {
    console.error(`Invalid stack: ${stack}. Must be one of: ${VALID_STACKS.join(', ')}`);
    return null;
  }

  if (!VALID_LEVELS.includes(level.toLowerCase())) {
    console.error(`Invalid level: ${level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
    return null;
  }

  if (!VALID_PACKAGES.includes(packageName.toLowerCase())) {
    console.error(`Invalid package: ${packageName}. Must be one of: ${VALID_PACKAGES.join(', ')}`);
    return null;
  }

  const logData = {
    stack: stack.toLowerCase(),
    level: level.toLowerCase(),
    package: packageName.toLowerCase(),
    message: message
  };
  try {
    const response = await axios.post(API_URL, logData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      timeout: 5000
    });

    if (response.status === 200 && response.data.logID) {
      console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] [${packageName}] ${message} (LogID: ${response.data.logID})`);
      return response.data.logID;
    }
  } catch (error) {
    console.error('Failed to send log to test server:', error.message);
    console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] [${packageName}] ${message}`);
  }

  return null;
}

function requestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  // Log incoming request
  const requestMessage = `Request started - ${req.method} ${req.path} (ID: ${requestId}) | IP: ${req.ip}`;
  log('backend', 'info', 'handler', requestMessage, req.headers.Authorization);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const responseMessage = `Request completed - ${req.method} ${req.path} (ID: ${requestId}) | Status: ${res.statusCode} | Duration: ${duration}ms`;
    
    // Log based on response status
    if (res.statusCode >= 500) {
      log('backend', 'error', 'handler', responseMessage, req.headers.Authorization);
    } else if (res.statusCode >= 400) {
      log('backend', 'warn', 'handler', responseMessage, req.headers.Authorization);
    } else {
      log('backend', 'info', 'handler', responseMessage, req.headers.Authorization);
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

module.exports = {
    log,    
    requestLogger
};