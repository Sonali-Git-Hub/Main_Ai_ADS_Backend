/**
 * AI Ads Visual Credit Metering & Subscription Service
 */

let userCreditState = {
  subscriptionTier: 'Agency',
  visualCreditBalance: 120,
  creditHistory: [
    { id: 'tx_001', type: 'MONTHLY_ALLOCATION', credits: 150, timestamp: '2026-07-01T00:00:00Z', note: 'Agency Plan Monthly Renewal' },
    { id: 'tx_002', type: 'DEDUCTION', credits: -10, timestamp: '2026-07-15T10:30:00Z', note: 'AI Carousel Visual Generation' },
    { id: 'tx_003', type: 'DEDUCTION', credits: -20, timestamp: '2026-07-20T14:15:00Z', note: 'Imagen 3 High-Res Visual Syntheses' }
  ]
};

function getCreditBalance() {
  return {
    tier: userCreditState.subscriptionTier,
    balance: userCreditState.visualCreditBalance,
    history: userCreditState.creditHistory
  };
}

function deductCredits(amount, reason = 'AI Visual Generation') {
  if (userCreditState.visualCreditBalance < amount) {
    return {
      success: false,
      error: `Insufficient visual credits. Current balance: ${userCreditState.visualCreditBalance}, required: ${amount}. Please top up your credits.`
    };
  }

  userCreditState.visualCreditBalance -= amount;
  const tx = {
    id: `tx_${Date.now()}`,
    type: 'DEDUCTION',
    credits: -amount,
    timestamp: new Date().toISOString(),
    note: reason
  };
  userCreditState.creditHistory.unshift(tx);

  return {
    success: true,
    newBalance: userCreditState.visualCreditBalance,
    transaction: tx
  };
}

function topUpCredits(amount, packName = 'Credit Top-Up Pack') {
  userCreditState.visualCreditBalance += amount;
  const tx = {
    id: `tx_${Date.now()}`,
    type: 'PURCHASE',
    credits: amount,
    timestamp: new Date().toISOString(),
    note: `Razorpay Purchase: ${packName} (+${amount} credits)`
  };
  userCreditState.creditHistory.unshift(tx);

  return {
    success: true,
    newBalance: userCreditState.visualCreditBalance,
    transaction: tx
  };
}

function setSubscriptionTier(newTier) {
  userCreditState.subscriptionTier = newTier;
  let bonusCredits = 0;
  if (newTier === 'Pro') bonusCredits = 50;
  if (newTier === 'Agency') bonusCredits = 250;
  if (newTier === 'Enterprise') bonusCredits = 1000;

  userCreditState.visualCreditBalance += bonusCredits;
  userCreditState.creditHistory.unshift({
    id: `tx_${Date.now()}`,
    type: 'PLAN_UPGRADE',
    credits: bonusCredits,
    timestamp: new Date().toISOString(),
    note: `Subscription upgraded to ${newTier} Plan`
  });

  return {
    tier: userCreditState.subscriptionTier,
    newBalance: userCreditState.visualCreditBalance
  };
}

module.exports = {
  getCreditBalance,
  deductCredits,
  topUpCredits,
  setSubscriptionTier
};
