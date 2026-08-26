require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const ChatSession = require('./models/ChatSession');
const jwt = require('jsonwebtoken');
const { sendMessage } = require('./controllers/chatController');

// Mock Express req/res
function createMockReqRes({ body, headers = {}, user = null }) {
  const req = {
    body,
    headers,
    user,
    params: {},
    query: {}
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    }
  };

  return { req, res };
}

async function runTests() {
  console.log('Starting end-to-end verification tests for userId association...\n');
  await connectDB();

  try {
    // 1. Fetch or create test Users A and B in MongoDB
    let userA = await User.findOne({ email: 'test_user_a@aiads.com' });
    if (!userA) {
      userA = await User.create({
        name: 'User Alpha',
        email: 'test_user_a@aiads.com',
        password: 'Password123!',
        role: 'AgencyAdmin'
      });
    }

    let userB = await User.findOne({ email: 'test_user_b@aiads.com' });
    if (!userB) {
      userB = await User.create({
        name: 'User Beta',
        email: 'test_user_b@aiads.com',
        password: 'Password123!',
        role: 'AgencyAdmin'
      });
    }

    const tokenA = jwt.sign(
      { userId: userA._id.toString(), email: userA.email, role: userA.role },
      process.env.JWT_SECRET || 'ai_ads_secret_key_123'
    );

    const tokenB = jwt.sign(
      { userId: userB._id.toString(), email: userB.email, role: userB.role },
      process.env.JWT_SECRET || 'ai_ads_secret_key_123'
    );

    // TEST 1: Login as User A -> Create Chat
    console.log('--- TEST 1: User A Creates Chat Session ---');
    const sessionA_ID = `test_session_a_${Date.now()}`;
    const { req: req1, res: res1 } = createMockReqRes({
      body: { message: 'Hello from User A', sessionId: sessionA_ID },
      headers: { authorization: `Bearer ${tokenA}` }
    });

    await sendMessage(req1, res1);
    console.log('Response 1 success:', res1.data.success);

    const savedSessionA = await ChatSession.findOne({ sessionId: sessionA_ID });
    console.log('Saved Session A userId in MongoDB:', savedSessionA.userId ? savedSessionA.userId.toString() : null);
    console.log('User A actual _id in MongoDB:     ', userA._id.toString());
    const pass1 = savedSessionA && savedSessionA.userId && savedSessionA.userId.toString() === userA._id.toString();
    console.log('TEST 1 RESULT:', pass1 ? '✅ PASSED' : '❌ FAILED');
    console.log();

    // TEST 2: Login as User B -> Create Chat
    console.log('--- TEST 2: User B Creates Chat Session ---');
    const sessionB_ID = `test_session_b_${Date.now()}`;
    const { req: req2, res: res2 } = createMockReqRes({
      body: { message: 'Hello from User B', sessionId: sessionB_ID },
      headers: { authorization: `Bearer ${tokenB}` }
    });

    await sendMessage(req2, res2);
    console.log('Response 2 success:', res2.data.success);

    const savedSessionB = await ChatSession.findOne({ sessionId: sessionB_ID });
    console.log('Saved Session B userId in MongoDB:', savedSessionB.userId ? savedSessionB.userId.toString() : null);
    console.log('User B actual _id in MongoDB:     ', userB._id.toString());
    const pass2 = savedSessionB && savedSessionB.userId && savedSessionB.userId.toString() === userB._id.toString() && savedSessionB.userId.toString() !== userA._id.toString();
    console.log('TEST 2 RESULT:', pass2 ? '✅ PASSED' : '❌ FAILED');
    console.log();

    // TEST 3: Unauthenticated Guest -> Create Guest Chat
    console.log('--- TEST 3: Unauthenticated Guest Creates Chat ---');
    const sessionGuest_ID = `test_session_guest_${Date.now()}`;
    const { req: req3, res: res3 } = createMockReqRes({
      body: { message: 'Hello from Guest', sessionId: sessionGuest_ID },
      headers: {} // No authorization token
    });

    await sendMessage(req3, res3);
    console.log('Response 3 success:', res3.data.success);

    const savedGuestSession = await ChatSession.findOne({ sessionId: sessionGuest_ID });
    console.log('Saved Guest Session userId in MongoDB:', savedGuestSession.userId);
    const pass3 = savedGuestSession && (savedGuestSession.userId === null || savedGuestSession.userId === undefined);
    console.log('TEST 3 RESULT:', pass3 ? '✅ PASSED' : '❌ FAILED');
    console.log();

    // TEST 4: Send follow-up message to Session A without token -> userId preserved
    console.log('--- TEST 4: Follow-up Message to Session A (Preserve userId) ---');
    const { req: req4, res: res4 } = createMockReqRes({
      body: { message: 'Second message in Session A', sessionId: sessionA_ID },
      headers: {} // Guest follow-up without token
    });

    await sendMessage(req4, res4);
    const recheckedSessionA = await ChatSession.findOne({ sessionId: sessionA_ID });
    console.log('Rechecked Session A userId after unauthenticated follow-up:', recheckedSessionA.userId ? recheckedSessionA.userId.toString() : null);
    const pass4 = recheckedSessionA && recheckedSessionA.userId && recheckedSessionA.userId.toString() === userA._id.toString();
    console.log('TEST 4 RESULT:', pass4 ? '✅ PASSED' : '❌ FAILED');
    console.log();

    // Clean up test sessions & test users
    await ChatSession.deleteMany({ sessionId: { $in: [sessionA_ID, sessionB_ID, sessionGuest_ID] } });
    await User.deleteMany({ email: { $in: ['test_user_a@aiads.com', 'test_user_b@aiads.com'] } });
    console.log('Test cleanup complete.');

    if (pass1 && pass2 && pass3 && pass4) {
      console.log('\n🎉 ALL 4 TEST SUITES PASSED CLEANLY WITH 100% SUCCESS!');
    } else {
      console.error('\n⚠️ SOME TESTS FAILED. CHECK LOGS.');
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
