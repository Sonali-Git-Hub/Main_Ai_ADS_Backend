/**
 * Chat Controller
 * Handles AI chat sessions — create, list, send message, delete.
 */
const ChatSession = require('../models/ChatSession');
const { chat } = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');

// ─── GET /api/chat/sessions ───────────────────────────────────────────────────
exports.listSessions = async (req, res) => {
  try {
    const { workspaceId, limit = 30 } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;

    const sessions = await ChatSession.find(filter)
      .select('sessionId title lastModified detectedMode model createdAt')
      .sort({ lastModified: -1 })
      .limit(Number(limit));

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/chat/sessions/:sessionId ───────────────────────────────────────
exports.getSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, session });
  } catch (err) {
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

    // Find or create session
    let session = await ChatSession.findOne({ sessionId });
    if (!session) {
      session = new ChatSession({
        sessionId,
        workspaceId: workspaceId || null,
        title: message.slice(0, 60),
        model,
        messages: [],
      });
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

    // Auto-generate title from first message
    if (session.messages.length === 2 && session.title === message.slice(0, 60)) {
      try {
        const titleResult = await chat(
          [{ role: 'user', content: `Generate a short 4-6 word title for this conversation starting with: "${message.slice(0, 100)}". Return ONLY the title, no quotes.` }],
          { model: 'gemini', temperature: 0.5 }
        );
        session.title = titleResult.text.trim().slice(0, 60);
      } catch {}
    }

    await session.save();

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
  try {
    await ChatSession.findOneAndDelete({ sessionId: req.params.sessionId });
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PATCH /api/chat/sessions/:sessionId/title ────────────────────────────────
exports.renameSession = async (req, res) => {
  try {
    const { title } = req.body;
    const session = await ChatSession.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { title },
      { new: true }
    );
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
