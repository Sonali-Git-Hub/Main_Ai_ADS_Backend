/**
 * AI Ads Fact-Checking & Compliance Verification Engine
 * Scans generated content against approved and restricted claims.
 */

function verifyContentClaims(content, approvedClaims = [], restrictedClaims = []) {
  const flags = [];
  const lowerContent = content.toLowerCase();

  // 1. Check Restricted Claims / Taboo terms
  restrictedClaims.forEach(claim => {
    if (claim && lowerContent.includes(claim.toLowerCase())) {
      flags.push({
        type: 'RESTRICTED_CLAIM',
        severity: 'HIGH',
        message: `Contains restricted phrase/claim: "${claim}"`,
        phrase: claim
      });
    }
  });

  // 2. Scan for uncited numerical stats / claims
  const statRegex = /(\d+(?:\.\d+)?%\s*(?:increase|growth|boost|roi|reduction|sales|revenue)?|\$\d+(?:\,\d+)*(?:\.\d+)?|\d+x\s*(?:faster|more|higher|growth))/gi;
  let match;
  while ((match = statRegex.exec(content)) !== null) {
    const statText = match[0];
    const isApproved = approvedClaims.some(c => 
      c.claimText && c.claimText.toLowerCase().includes(statText.toLowerCase())
    );

    if (!isApproved) {
      flags.push({
        type: 'UNSUPPORTED_STATISTIC',
        severity: 'MEDIUM',
        message: `Unverified statistical claim found: "${statText}". Requires verified source citation.`,
        phrase: statText
      });
    }
  }

  const passed = flags.length === 0;

  return {
    passed,
    score: passed ? 100 : Math.max(40, 100 - flags.length * 20),
    status: passed ? 'VERIFIED' : 'RED_FLAG_CITATION_NEEDED',
    flags,
    scannedAt: new Date().toISOString()
  };
}

module.exports = {
  verifyContentClaims
};
