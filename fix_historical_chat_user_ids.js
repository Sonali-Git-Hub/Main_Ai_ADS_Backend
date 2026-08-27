require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const ChatSession = require('./models/ChatSession');
const User = require('./models/User');
const Workspace = require('./models/Workspace');

async function fixHistoricalChatUserIds() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for historical ChatSession backfill migration...');

    const sessionsWithoutUserId = await ChatSession.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });

    console.log(`Found ${sessionsWithoutUserId.length} historical ChatSession records with userId: null.`);

    const registeredUsers = await User.find({});
    const registeredWorkspaces = await Workspace.find({});

    let updatedCount = 0;
    let genuineGuestCount = 0;

    for (const session of sessionsWithoutUserId) {
      let matchedUser = null;

      // 1. Try matching by session.userEmail
      if (session.userEmail && session.userEmail !== 'guest@aiads.com' && session.userEmail !== 'guest') {
        matchedUser = registeredUsers.find(u => u.email.toLowerCase() === session.userEmail.toLowerCase());
      }

      // 2. Try matching by workspaceId -> workspace.userEmail -> user
      if (!matchedUser && session.workspaceId && session.workspaceId !== 'ws_empty') {
        const ws = registeredWorkspaces.find(w => w._id.toString() === session.workspaceId.toString() || w.id === session.workspaceId);
        if (ws && ws.userEmail) {
          matchedUser = registeredUsers.find(u => u.email.toLowerCase() === ws.userEmail.toLowerCase());
        }
      }

      // 3. Update session if user reliably matched
      if (matchedUser) {
        session.userId = matchedUser._id;
        session.userEmail = matchedUser.email;
        session.userName = matchedUser.name || matchedUser.email.split('@')[0];
        await session.save();
        updatedCount++;
        console.log(`✅ [BACKFILL MATCH] Linked Session ${session.sessionId} -> User: ${matchedUser.email} (_id: ${matchedUser._id})`);
      } else {
        genuineGuestCount++;
        console.log(`ℹ️ [GUEST RECORD] Session ${session.sessionId} remains userId: null (genuine guest session).`);
      }
    }

    console.log('\n================ MIGRATION SUMMARY ================');
    console.log(`Total records processed: ${sessionsWithoutUserId.length}`);
    console.log(`Successfully updated with user _id: ${updatedCount}`);
    console.log(`Remaining guest sessions (userId: null): ${genuineGuestCount}`);
    console.log('===================================================\n');

  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

fixHistoricalChatUserIds();
