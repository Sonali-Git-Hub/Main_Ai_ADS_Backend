/**
 * Chat Controller
 * Handles AI chat sessions — create, list, send message, delete.
 * Includes in-memory fail-safe persistence store for offline DB fallback.
 */
const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const { chat } = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');

const memoryChatSessions = new Map();

// Helper to check DB readiness
const isDbConnected = () => mongoose.connection.readyState === 1;

// ─── GET /api/chat/sessions ───────────────────────────────────────────────────
exports.listSessions = async (req, res) => {
  try {
    const { workspaceId, limit = 30 } = req.query;
    if (isDbConnected()) {
      const filter = {};
      if (workspaceId) filter.workspaceId = workspaceId;

      const sessions = await ChatSession.find(filter)
        .select('sessionId title lastModified detectedMode model createdAt')
        .sort({ lastModified: -1 })
        .limit(Number(limit));

      return res.json({ success: true, sessions });
    }

    // In-memory fallback
    const sessions = Array.from(memoryChatSessions.values())
      .filter(s => !workspaceId || s.workspaceId === workspaceId)
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
      .slice(0, Number(limit));

    res.json({ success: true, sessions });
  } catch (err) {
    const sessions = Array.from(memoryChatSessions.values()).slice(0, 30);
    res.json({ success: true, sessions, fallback: true });
  }
};

// ─── GET /api/chat/sessions/:sessionId ───────────────────────────────────────
exports.getSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    if (isDbConnected()) {
      const session = await ChatSession.findOne({ sessionId });
      if (session) return res.json({ success: true, session });
    }

    const memSession = memoryChatSessions.get(sessionId);
    if (memSession) return res.json({ success: true, session: memSession });

    return res.status(404).json({ success: false, error: 'Session not found' });
  } catch (err) {
    const memSession = memoryChatSessions.get(sessionId);
    if (memSession) return res.json({ success: true, session: memSession });
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/chat ────────────────────────────────────────────────────────────
// Main chat endpoint: sends a message and gets AI response
exports.sendMessage = async (req, res) => {
  try {
    const {
      message,
      sessionId: existingSessionId,
      workspaceId,
      model = 'gemini',
      systemInstruction,
      brandContext,
      userName,
      history = [],
    } = req.body;

    if (!message) return res.status(400).json({ success: false, error: 'message is required' });

    const sessionId = existingSessionId || uuidv4();

    let session = null;
    if (isDbConnected()) {
      try {
        session = await ChatSession.findOne({ sessionId });
      } catch (dbErr) {
        console.warn('[ChatController] DB query failed, using in-memory session store:', dbErr.message);
      }
    }

    if (!session && memoryChatSessions.has(sessionId)) {
      session = memoryChatSessions.get(sessionId);
    }

    if (!session) {
      session = {
        sessionId,
        workspaceId: workspaceId || null,
        title: message.slice(0, 60),
        model,
        messages: [],
        lastModified: Date.now()
      };
    }

    // Add user message
    const userMsg = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    session.messages.push(userMsg);

    // Build conversation history for AI
    const conversationHistory = history.length > 0
      ? history
      : session.messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

    // Get AI response
    const aiResult = await chat(conversationHistory, {
      model,
      systemInstruction,
      brandContext,
      userName,
      temperature: 0.7,
    });

    // Add AI response to session
    const aiMsg = {
      role: 'model',
      content: aiResult.text,
      timestamp: Date.now(),
    };
    session.messages.push(aiMsg);
    session.lastModified = Date.now();
    session.model = model;

    // Save in memory cache always
    memoryChatSessions.set(sessionId, session);

    // Save to DB if connected
    if (isDbConnected()) {
      try {
        await ChatSession.findOneAndUpdate(
          { sessionId },
          { $set: session },
          { upsert: true, new: true }
        );
      } catch (dbSaveErr) {
        console.warn('[ChatController] DB session save skipped:', dbSaveErr.message);
      }
    }

    res.json({
      success: true,
      sessionId: session.sessionId,
      title: session.title,
      response: aiResult.text,
      model: aiResult.model,
      message: aiMsg,
    });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE /api/chat/sessions/:sessionId ─────────────────────────────────────
exports.deleteSession = async (req, res) => {
  const { sessionId } = req.params;
  memoryChatSessions.delete(sessionId);
  if (isDbConnected()) {
    try {
      await ChatSession.findOneAndDelete({ sessionId });
    } catch (e) {}
  }
  res.json({ success: true, message: 'Session deleted' });
};

// ─── PATCH /api/chat/sessions/:sessionId/title ────────────────────────────────
exports.renameSession = async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;

  let memSession = memoryChatSessions.get(sessionId);
  if (memSession) {
    memSession.title = title;
  }

  if (isDbConnected()) {
    try {
      const session = await ChatSession.findOneAndUpdate(
        { sessionId },
        { title },
        { returnDocument: 'after' }
      );
      if (session) return res.json({ success: true, session });
    } catch (e) {}
  }

  if (memSession) return res.json({ success: true, session: memSession });
  res.status(404).json({ success: false, error: 'Session not found' });
};
