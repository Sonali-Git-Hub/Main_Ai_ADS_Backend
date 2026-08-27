/**
 * Chat Controller
 * Handles AI chat sessions — create, list, send message, delete.
 * Enforces authenticated userId linking to MongoDB User documents (_id).
 * Includes in-memory fail-safe persistence store for offline DB fallback.
 */
const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { chat } = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const memoryChatSessions = new Map();

// Helper to check DB readiness
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Helper to resolve authenticated User document from req.user, JWT token, or workspace owner.
 * Returns Mongoose User document or null if unauthenticated guest.
 */
const resolveAuthenticatedUser = async (req, workspaceId) => {
  let userDoc = null;

  // 1. Check req.user set by auth middleware
  if (req.user && (req.user._id || req.user.userId)) {
    const uId = req.user._id || req.user.userId;
    if (isDbConnected()) {
      try {
        userDoc = await User.findById(uId);
      } catch (e) {}
    }
  }

  // 2. Try parsing Authorization header if userDoc not found yet
  if (!userDoc && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ai_ads_secret_key_123');
      const uId = decoded.userId || decoded.id;
      if (uId && isDbConnected()) {
        try {
          userDoc = await User.findById(uId);
        } catch (e) {}
      }
      if (!userDoc && decoded.email && isDbConnected()) {
        try {
          userDoc = await User.findOne({ email: decoded.email.toLowerCase() });
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 3. Fallback check by workspace owner if still not found and workspaceId supplied
  if (!userDoc && workspaceId && isDbConnected()) {
    try {
      const ws = await Workspace.findById(workspaceId);
      if (ws && ws.userEmail) {
        userDoc = await User.findOne({ email: ws.userEmail.toLowerCase() });
      }
    } catch (e) {}
  }

  return userDoc;
};

// ─── GET /api/chat/sessions ───────────────────────────────────────────────────
exports.listSessions = async (req, res) => {
  try {
    const { workspaceId, limit = 30 } = req.query;
    const userDoc = await resolveAuthenticatedUser(req, workspaceId);

    if (isDbConnected()) {
      const filter = {};
      if (workspaceId) filter.workspaceId = workspaceId;

      if (userDoc) {
        const isAdmin = ['admin', 'SuperAdmin', 'AgencyAdmin'].includes(userDoc.role);
        if (!isAdmin) {
          filter.$or = [
            { userId: userDoc._id },
            { userEmail: userDoc.email }
          ];
        }
      } else {
        if (workspaceId) {
          filter.workspaceId = workspaceId;
        } else {
          filter.userId = null;
        }
      }

      const sessions = await ChatSession.find(filter)
        .select('sessionId title lastModified detectedMode model createdAt userId userEmail userName')
        .sort({ lastModified: -1 })
        .limit(Number(limit));

      return res.json({ success: true, sessions });
    }

    // In-memory fallback
    const sessions = Array.from(memoryChatSessions.values())
      .filter(s => {
        if (workspaceId && s.workspaceId !== workspaceId) return false;
        if (userDoc) {
          return (s.userId && s.userId.toString() === userDoc._id.toString()) || s.userEmail === userDoc.email;
        }
        return !s.userId;
      })
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
      .slice(0, Number(limit));

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/chat/sessions/:sessionId ───────────────────────────────────────
exports.getSession = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const userDoc = await resolveAuthenticatedUser(req);

    if (isDbConnected()) {
      const session = await ChatSession.findOne({ sessionId });
      if (session) {
        if (session.isShared) return res.json({ success: true, session });

        if (userDoc) {
          const isAdmin = ['admin', 'SuperAdmin', 'AgencyAdmin'].includes(userDoc.role);
          const isOwner = (session.userId && session.userId.toString() === userDoc._id.toString()) ||
                          (session.userEmail && session.userEmail.toLowerCase() === userDoc.email.toLowerCase());
          if (isAdmin || isOwner) {
            return res.json({ success: true, session });
          }
          return res.status(403).json({ success: false, error: 'Access denied to this chat session' });
        } else if (!session.userId) {
          return res.json({ success: true, session });
        } else {
          return res.status(401).json({ success: false, error: 'Authentication required to view this session' });
        }
      }
    }

    const memSession = memoryChatSessions.get(sessionId);
    if (memSession) return res.json({ success: true, session: memSession });

    return res.status(404).json({ success: false, error: 'Session not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/chat ────────────────────────────────────────────────────────────
// Main chat endpoint: sends a message and gets AI response
exports.sendMessage = async (req, res) => {
  try {
    // ─── LOCAL/DEV TEST ERROR TRIGGER MECHANISM ─────────────────────────────────────
    if (process.env.TEST_FORCE_CHAT_ERROR === 'true') {
      try {
        const { recordTelemetryEvent } = require('../services/telemetryService');
        recordTelemetryEvent({
          source: 'BACKEND',
          eventType: 'ERROR',
          page: '/chat',
          component: 'ChatController',
          action: 'SEND_MESSAGE_TEST_FORCED_ERROR',
          status: 'ERROR',
          metadata: {
            forcedByEnv: 'TEST_FORCE_CHAT_ERROR',
            errorText: 'TEST_ERROR_FOR_ANALYTICS'
          }
        });
      } catch (tErr) {}

      return res.status(500).json({
        success: false,
        error: 'TEST_ERROR_FOR_ANALYTICS'
      });
    }

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
    const userDoc = await resolveAuthenticatedUser(req, workspaceId);

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
      // Create new session document
      session = {
        sessionId,
        workspaceId: workspaceId || null,
        userId: userDoc ? userDoc._id : null,
        userEmail: userDoc ? userDoc.email : (req.body.userEmail || null),
        userName: userDoc ? (userDoc.name || userDoc.email.split('@')[0]) : (userName || req.body.userName || null),
        title: message.slice(0, 60),
        model,
        messages: [],
        lastModified: Date.now()
      };
    } else {
      // Update existing session document
      // Preserve existing userId if request is unauthenticated guest
      if (userDoc) {
        session.userId = userDoc._id;
        session.userEmail = userDoc.email;
        session.userName = userDoc.name || userDoc.email.split('@')[0];
      } else if (!session.userId && (session.userEmail || req.body.userEmail)) {
        const emailToSearch = session.userEmail || req.body.userEmail;
        if (emailToSearch && isDbConnected()) {
          try {
            const u = await User.findOne({ email: emailToSearch.toLowerCase() });
            if (u) {
              session.userId = u._id;
              session.userEmail = u.email;
              session.userName = u.name || u.email.split('@')[0];
            }
          } catch (e) {}
        }
      }
      session.lastModified = Date.now();
      session.model = model;
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
      userName: session.userName || userName,
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
        const updateFields = {
          sessionId: session.sessionId,
          workspaceId: session.workspaceId,
          userEmail: session.userEmail,
          userName: session.userName,
          title: session.title,
          messages: session.messages,
          lastModified: session.lastModified,
          model: session.model,
        };

        updateFields.userId = session.userId || null;

        await ChatSession.findOneAndUpdate(
          { sessionId },
          { $set: updateFields },
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
  try {
    const userDoc = await resolveAuthenticatedUser(req);

    if (isDbConnected()) {
      const session = await ChatSession.findOne({ sessionId });
      if (session) {
        if (userDoc) {
          const isAdmin = ['admin', 'SuperAdmin', 'AgencyAdmin'].includes(userDoc.role);
          const isOwner = (session.userId && session.userId.toString() === userDoc._id.toString()) ||
                          (session.userEmail && session.userEmail.toLowerCase() === userDoc.email.toLowerCase());
          if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: 'Permission denied to delete this session' });
          }
        }
        await ChatSession.deleteOne({ sessionId });
      }
    }

    memoryChatSessions.delete(sessionId);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PATCH /api/chat/sessions/:sessionId/title ────────────────────────────────
exports.renameSession = async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;

  try {
    const userDoc = await resolveAuthenticatedUser(req);

    let memSession = memoryChatSessions.get(sessionId);
    if (memSession) {
      memSession.title = title;
    }

    if (isDbConnected()) {
      const session = await ChatSession.findOne({ sessionId });
      if (session) {
        if (userDoc) {
          const isAdmin = ['admin', 'SuperAdmin', 'AgencyAdmin'].includes(userDoc.role);
          const isOwner = (session.userId && session.userId.toString() === userDoc._id.toString()) ||
                          (session.userEmail && session.userEmail.toLowerCase() === userDoc.email.toLowerCase());
          if (!isAdmin && !isOwner) {
            return res.status(403).json({ success: false, error: 'Permission denied to rename this session' });
          }
        }
        session.title = title;
        await session.save();
        return res.json({ success: true, session });
      }
    }

    if (memSession) return res.json({ success: true, session: memSession });
    res.status(404).json({ success: false, error: 'Session not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
