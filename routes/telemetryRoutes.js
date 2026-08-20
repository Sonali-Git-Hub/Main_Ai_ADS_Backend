const express = require('express');
const router = express.Router();
const { recordTelemetryEvent, registerSseClient, getEventHistory } = require('../services/telemetryService');

// ─── POST /api/telemetry/event — Ingest Telemetry Event(s) ──────────────────────
router.post('/event', (req, res) => {
  try {
    const payload = req.body;
    let eventsRecorded = [];

    if (Array.isArray(payload)) {
      eventsRecorded = payload.map(ev => recordTelemetryEvent(ev));
    } else {
      const event = recordTelemetryEvent(payload);
      eventsRecorded.push(event);
    }

    res.json({ success: true, count: eventsRecorded.length, events: eventsRecorded });
  } catch (err) {
    console.error('Error recording telemetry event:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/telemetry/stream — Live SSE Event Stream ──────────────────────────
router.get('/stream', (req, res) => {
  registerSseClient(req, res);
});

// ─── GET /api/telemetry/history — Fetch Telemetry Event History ────────────────
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '200', 10);
    const filterType = req.query.eventType || null;
    const history = getEventHistory(limit, filterType);
    res.json({ success: true, count: history.length, events: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
