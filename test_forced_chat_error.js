require('dotenv').config();
const { sendMessage } = require('./controllers/chatController');
const { getErrorStats } = require('./services/telemetryService');

function mockReqRes() {
  const req = {
    body: { message: 'Test message for forced error check' },
    headers: {},
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

async function verifyForcedError() {
  console.log('--- TEST 1: Default behavior (TEST_FORCE_CHAT_ERROR not set or false) ---');
  delete process.env.TEST_FORCE_CHAT_ERROR;
  const initialErrorStats = getErrorStats();
  console.log('Initial Total Errors in Telemetry:', initialErrorStats.totalErrors);

  console.log('\n--- TEST 2: Enable TEST_FORCE_CHAT_ERROR=true ---');
  process.env.TEST_FORCE_CHAT_ERROR = 'true';

  const { req, res } = mockReqRes();
  await sendMessage(req, res);

  console.log('HTTP Status Code returned:', res.statusCode);
  console.log('Response JSON:', JSON.stringify(res.data));

  const newErrorStats = getErrorStats();
  console.log('\nUpdated Total Errors in Telemetry:', newErrorStats.totalErrors);
  console.log('Updated Error Rate:', newErrorStats.errorRate);
  console.log('Updated Chat Errors:', newErrorStats.chatErrors);

  if (res.statusCode === 500 && res.data.error === 'TEST_ERROR_FOR_ANALYTICS' && newErrorStats.totalErrors > initialErrorStats.totalErrors) {
    console.log('\n✅ FORCED CHAT ERROR TEST PASSED WITH 100% SUCCESS!');
  } else {
    console.error('\n❌ TEST FAILED. Check implementation.');
  }

  // Reset back to disabled
  delete process.env.TEST_FORCE_CHAT_ERROR;
}

verifyForcedError();
