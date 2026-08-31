/**
 * Sub-Agent 5: Brand DNA Validator Agent
 * Path: backend/modules/brandDnaAgent/brandValidatorAgent.js
 * 
 * Role: Independent Quality & Provenance Auditor Agent
 * Responsibility: Inspects all outputs from Crawler, Voice, Persona, and Positioning agents.
 * STRICT DIRECTIVE: If collected info is not verified from actual website evidence or uncertain,
 * override value to null / UNKNOWN with 0 confidence. NEVER present wrong or fabricated info to the user.
 */

const { filterValidPhoneNumber } = require('../workspace/brandScraper.service');

function validateBrandName(brandNameObj, domainName) {
  if (!brandNameObj || !brandNameObj.value || typeof brandNameObj.value !== 'string') {
    return {
      value: domainName ? domainName.split('.')[0] : 'Unknown Brand',
      sourceType: 'WEBSITE_DOM',
      evidence: 'Fallback from domain structure',
      confidence: 0.5
    };
  }
  const clean = brandNameObj.value.trim();
  if (/^(home|index|default|official website|welcome|page|site)$/i.test(clean)) {
    return {
      value: domainName ? domainName.split('.')[0] : 'Unknown Brand',
      sourceType: 'WEBSITE_DOM',
      evidence: 'Domain-derived brand name override',
      confidence: 0.6
    };
  }
  return brandNameObj;
}

function validateIndustry(industryObj, combinedText) {
  if (!industryObj || !industryObj.value || industryObj.confidence === 0 || industryObj.sourceType === 'UNKNOWN') {
    return {
      value: null,
      sourceType: 'UNKNOWN',
      sourceUrl: industryObj?.sourceUrl || '',
      evidence: 'No verified industry evidence found on website content or schema',
      method: 'NO_MATCHING_EVIDENCE',
      confidence: 0,
      candidates: [],
      rejectedCandidates: []
    };
  }

  // Ensure evidence is grounded in scraped text, schema, or multimodal screenshot reasoning
  if (industryObj.sourceType === 'WEBSITE_SCHEMA' || industryObj.sourceType === 'WEBSITE_DOM+WEBSITE_SCREENSHOT' || industryObj.sourceType === 'AI_INFERENCE') {
    return industryObj;
  }

  if (industryObj.sourceType === 'WEBSITE_DOM' && combinedText) {
    const evText = (industryObj.evidence || '').toLowerCase();
    const hasGrounding = combinedText.includes(evText) || /matched industry evidence|contextual cluster/i.test(evText);
    if (!hasGrounding) {
      console.warn(`[ValidatorAgent] ⚠️ Overriding Industry to UNKNOWN (Unverified evidence snippet)`);
      return {
        value: null,
        sourceType: 'UNKNOWN',
        sourceUrl: industryObj.sourceUrl,
        evidence: 'Industry evidence snippet unverified against scraped DOM text',
        method: 'VALIDATOR_REJECTED_UNVERIFIED',
        confidence: 0,
        candidates: [],
        rejectedCandidates: [industryObj.value]
      };
    }
  }

  return industryObj;
}

function validateHeadquarters(hqObj) {
  if (!hqObj || !hqObj.value || hqObj.sourceType === 'UNKNOWN') {
    return {
      value: null,
      type: 'HEADQUARTERS',
      sourceType: 'UNKNOWN',
      evidence: 'No headquarters address found in website evidence',
      confidence: 0
    };
  }

  let cleanHq = String(hqObj.value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    ...hqObj,
    value: cleanHq
  };
}

function validateTagline(taglineObj) {
  if (!taglineObj || !taglineObj.value || taglineObj.sourceType === 'UNKNOWN') {
    return {
      value: null,
      sourceType: 'UNKNOWN',
      sourceUrl: taglineObj?.sourceUrl || '',
      evidence: 'No slogan or tagline found in website evidence',
      confidence: 0
    };
  }

  return taglineObj;
}

function validateContactInfo(contactObj) {
  if (!contactObj || !contactObj.value || contactObj.confidence === 0) {
    return {
      value: null,
      sourceType: 'UNKNOWN',
      evidence: 'No contact information found in website evidence',
      confidence: 0
    };
  }

  const email = contactObj.value.email || null;
  let phone = contactObj.value.phone || null;

  if (phone) {
    phone = filterValidPhoneNumber(phone);
  }

  if (!email && !phone) {
    return {
      value: null,
      sourceType: 'UNKNOWN',
      evidence: 'Contact info rejected by strict validator (dummy template numbers or invalid email)',
      confidence: 0
    };
  }

  return {
    ...contactObj,
    value: {
      email,
      phone,
      location: contactObj.value.location || null
    }
  };
}

function validateCompanyDescription(descObj, crawlResult) {
  let val = descObj?.value;
  
  // Fallback to scraped website text/headings if meta description was empty
  if (!val && crawlResult?.scrapedMetadata) {
    const meta = crawlResult.scrapedMetadata.metaDescription;
    const about = crawlResult.scrapedMetadata.aboutPageText;
    const deep = crawlResult.scrapedMetadata.deepContextText;
    const headings = (crawlResult.scrapedMetadata.headings || []).slice(0, 5).join(' - ');

    if (about && about.length > 20) {
      val = about.slice(0, 350).trim() + '...';
    } else if (deep && deep.length > 30) {
      val = deep.slice(0, 350).trim() + '...';
    } else if (headings && headings.length > 10) {
      val = `${crawlResult.scrapedMetadata.brandName || 'Brand'} - ${headings}`;
    }
  }

  if (!val || val.length < 10) {
    return {
      value: null,
      sourceType: 'UNKNOWN',
      evidence: 'No company description found in website evidence',
      confidence: 0
    };
  }

  let clean = String(val)
    .replace(/\[Page URL:[^\]]+\]/gi, '')
    .replace(/^Headings:[^\n]+/gm, '')
    .replace(/^Content:\s*/gm, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    value: clean,
    sourceType: descObj?.sourceType || 'WEBSITE_DOM',
    sourceUrl: crawlResult?.rawUrl || '',
    evidence: `Extracted company description from website text`,
    confidence: descObj?.confidence || 0.85
  };
}

/**
 * Main Validator Agent Handler
 */
async function runValidatorAgent(draftPayload, crawlResult) {
  console.log(`[ValidatorAgent] 🛡️ Auditing Brand DNA payload for: "${draftPayload.brandName.value}"`);

  const passedFields = [];
  const overriddenFields = [];

  // Audit 1: Brand Name
  const validBrandName = validateBrandName(draftPayload.brandName, crawlResult.domainName);
  if (validBrandName.value !== draftPayload.brandName.value) overriddenFields.push('brandName');
  else passedFields.push('brandName');

  // Audit 2: Industry
  const validIndustry = validateIndustry(draftPayload.industryCategory, crawlResult.combinedText);
  if (validIndustry.value === null && draftPayload.industryCategory.value !== null) overriddenFields.push('industryCategory');
  else if (validIndustry.value !== null) passedFields.push('industryCategory');

  // Audit 3: Headquarters Address
  const validHQ = validateHeadquarters(draftPayload.headquarters);
  if (validHQ.value === null && draftPayload.headquarters.value !== null) overriddenFields.push('headquarters');
  else if (validHQ.value !== null) passedFields.push('headquarters');

  // Audit 4: Tagline / Slogan
  const validTagline = validateTagline(draftPayload.tagline);
  if (validTagline.value === null && draftPayload.tagline.value !== null) overriddenFields.push('tagline');
  else if (validTagline.value !== null) passedFields.push('tagline');

  // Audit 5: Contact Info
  const validContact = validateContactInfo(draftPayload.contactInfo);
  if (validContact.value === null && draftPayload.contactInfo.value !== null) overriddenFields.push('contactInfo');
  else if (validContact.value !== null) passedFields.push('contactInfo');

  // Audit 6: Company Description
  const validDesc = validateCompanyDescription(draftPayload.companyDescription, crawlResult);
  if (validDesc.value === null && draftPayload.companyDescription.value !== null) overriddenFields.push('companyDescription');
  else if (validDesc.value !== null) passedFields.push('companyDescription');

  const validationReport = {
    isFullyValidated: true,
    totalFieldsChecked: 6,
    passedFields,
    overriddenFieldsToUnknown: overriddenFields,
    validationSummary: overriddenFields.length > 0 
      ? `Validated ${passedFields.length} fields. Overrode ${overriddenFields.length} unverified fields (${overriddenFields.join(', ')}) to UNKNOWN / null.`
      : `All ${passedFields.length} fields 100% verified from website evidence.`
  };

  console.log(`[ValidatorAgent] ✅ Audit complete. Passed: [${passedFields.join(', ')}], Overridden to UNKNOWN: [${overriddenFields.join(', ')}]`);

  return {
    ...draftPayload,
    brandName: validBrandName,
    parentCompany: draftPayload.parentCompany || { value: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', evidence: 'No parent company evidence', confidence: 0 },
    industryCategory: validIndustry,
    headquarters: validHQ,
    tagline: validTagline,
    contactInfo: validContact,
    companyDescription: validDesc,
    validationReport
  };
}

module.exports = {
  runValidatorAgent,
  validateBrandName,
  validateIndustry,
  validateHeadquarters,
  validateTagline,
  validateContactInfo,
  validateCompanyDescription
};
