/**
 * Centralized Application Telemetry & Live Event Streaming Hub v1.0
 *
 * Provides structured JSON logging, human-readable terminal logging,
 * in-memory event buffer storage, and real-time Server-Sent Events (SSE) broadcasting.
 */

const eventHistory = [];
const MAX_HISTORY_LENGTH = 500;
const sseClients = new Set();

// Sensitive keys to redact from telemetry metadata
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'apikey', 'api_key', 'authorization',
  'auth', 'bearer', 'cookie', 'credentials', 'privatekey', 'private_key'
]);

/**
 * Recursively redacts sensitive fields from metadata objects
 */
function sanitizeMetadata(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMetadata);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower) || keyLower.includes('secret') || keyLower.includes('token')) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Formats console log for terminal visibility
 */
function logToTerminal(event) {
  const timeStr = new Date(event.timestamp).toLocaleTimeString();
  const typeStr = (event.eventType || 'SYSTEM').padEnd(16);
  const srcStr = (event.source || 'UNKNOWN').padEnd(10);
  const compStr = event.component || 'App';
  const actStr = event.action || 'INTERACTION';

  let colorCode = '\x1b[36m'; // Default Cyan
  if (event.eventType === 'USER_ACTION') colorCode = '\x1b[36m'; // Cyan
  else if (['AI_PIPELINE', 'BLUEPRINT', 'CODE_GENERATION'].includes(event.eventType)) colorCode = '\x1b[35m'; // Magenta
  else if (['ASSET_PLAN', 'ASSET_GENERATION', 'ASSET_VALIDATION', 'ASSET_RETRY'].includes(event.eventType)) colorCode = '\x1b[33m'; // Yellow
  else if (['BUILD', 'QA'].includes(event.eventType)) colorCode = '\x1b[32m'; // Green
  else if (event.eventType === 'ERROR' || event.status === 'ERROR') colorCode = '\x1b[31m'; // Red

  const reset = '\x1b[0m';
  console.log(`${colorCode}📊 [TELEMETRY:${typeStr.trim()}] ${timeStr} | ${srcStr.trim()} | ${compStr} -> ${actStr} (${event.status || 'OK'})${reset}`);
}

/**
 * Ingests a new telemetry event, logs it, stores it, and broadcasts it over SSE
 */
function recordTelemetryEvent(rawEvent = {}) {
  const event = {
    eventId: rawEvent.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: rawEvent.timestamp || new Date().toISOString(),
    sessionId: rawEvent.sessionId || 'sess_default',
    projectId: rawEvent.projectId || null,
    buildId: rawEvent.buildId || null,
    requestId: rawEvent.requestId || null,
    source: rawEvent.source || 'BACKEND',
    eventType: rawEvent.eventType || 'SYSTEM',
    page: rawEvent.page || '/website-builder',
    component: rawEvent.component || 'System',
    action: rawEvent.action || 'EVENT',
    status: rawEvent.status || 'SUCCESS',
    metadata: sanitizeMetadata(rawEvent.metadata || {})
  };

  // Log to terminal console
  logToTerminal(event);

  // Store in memory ring buffer
  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY_LENGTH) {
    eventHistory.shift();
  }

  // Broadcast to all active SSE clients
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const clientRes of sseClients) {
    try {
      clientRes.write(payload);
    } catch (err) {
      console.warn('Failed to send SSE telemetry event to client:', err.message);
      sseClients.delete(clientRes);
    }
  }

  return event;
}

/**
 * Registers an active HTTP response as an SSE client
 */
function registerSseClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Telemetry Live SSE Stream connected.', historyCount: eventHistory.length })}\n\n`);

  sseClients.add(res);

  // Heartbeat ping every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

/**
 * Retrieves event history buffer
 */
function getEventHistory(limit = 100, filterType = null) {
  let list = [...eventHistory];
  if (filterType) {
    list = list.filter(e => e.eventType === filterType);
  }
  return list.slice(-limit);
}

/**
 * Retrieves aggregate error statistics from recorded telemetry events
 */
function getErrorStats() {
  const errorEvents = eventHistory.filter(e => e.eventType === 'ERROR' || e.status === 'ERROR');
  const total = errorEvents.length;
  const totalEvents = eventHistory.length;
  const rate = totalEvents > 0 ? ((total / totalEvents) * 100).toFixed(1) : '0.0';

  return {
    totalErrors: total,
    errorRate: `${rate}%`,
    chatErrors: errorEvents.filter(e => e.component === 'ChatController' || e.page === '/chat').length,
    generalErrors: errorEvents.filter(e => e.component !== 'ChatController' && e.page !== '/chat').length,
  };
}

module.exports = {
  recordTelemetryEvent,
  registerSseClient,
  getEventHistory,
  getErrorStats,
};
