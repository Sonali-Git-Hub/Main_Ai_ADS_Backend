/**
 * gcsStorageService.js
 * Production Google Cloud Storage (GCS) Asset Storage & Impersonated V4 Signed URL Engine
 *
 * Stores generated AI image buffers directly into GCS and produces secure, impersonated V4 signed URLs
 * so the frontend receives fast, clean HTTPS image URLs instead of huge raw Base64 data strings.
 */

const { GoogleAuth, Impersonated } = require('google-auth-library');
const crypto = require('crypto');
const axios = require('axios');

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'ai-mall-484810';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'ai-ads-object';
const SERVICE_ACCOUNT = process.env.VIDEO_SERVICE_ACCOUNT || process.env.GCS_SERVICE_ACCOUNT || 'video-signer@ai-mall-484810.iam.gserviceaccount.com';

let cachedAuthClient = null;
let cachedImpersonatedClient = null;

async function getClients() {
  if (!cachedAuthClient) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    cachedAuthClient = await auth.getClient();
  }

  if (!cachedImpersonatedClient) {
    cachedImpersonatedClient = new Impersonated({
      sourceClient: cachedAuthClient,
      targetPrincipal: SERVICE_ACCOUNT,
      lifetime: 3600,
      delegates: [],
      targetScopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/devstorage.full_control'
      ]
    });
  }

  return { authClient: cachedAuthClient, impersonatedClient: cachedImpersonatedClient };
}

/**
 * Generate Google V4 Signed URL via IAM Credentials signBlob
 */
async function generateV4ImpersonatedSignedUrl({
  bucketName = BUCKET_NAME,
  objectName,
  serviceAccount = SERVICE_ACCOUNT,
  expiresInSeconds = 7 * 24 * 3600 // 7 days default
}) {
  const { authClient } = await getClients();
  const { token } = await authClient.getAccessToken();

  const now = new Date();
  const datestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8); // YYYYMMDD
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ

  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const signedHeaders = 'host';
  const host = 'storage.googleapis.com';
  const canonicalUri = `/${bucketName}/${encodeURIComponent(objectName).replace(/%2F/g, '/')}`;

  const queryParams = {
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': `${serviceAccount}/${credentialScope}`,
    'X-Goog-Date': timestamp,
    'X-Goog-Expires': expiresInSeconds.toString(),
    'X-Goog-SignedHeaders': signedHeaders
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'GOOG4-RSA-SHA256',
    timestamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const signUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:signBlob`;
  const signRes = await axios.post(
    signUrl,
    {
      payload: Buffer.from(stringToSign).toString('base64')
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const signature = Buffer.from(signRes.data.signedBlob, 'base64').toString('hex');
  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
}

/**
 * Upload Image Buffer to GCS and return impersonated V4 signed URL
 */
async function uploadImageBufferToGcs({
  buffer,
  mimeType = 'image/png',
  folder = 'ai-ads-generated',
  filename
}) {
  try {
    const { impersonatedClient } = await getClients();
    const { token } = await impersonatedClient.getAccessToken();

    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
    const finalFilename = filename || `${folder}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(finalFilename)}`;

    await axios.post(uploadUrl, buffer, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType
      },
      maxBodyLength: 50 * 1024 * 1024,
      maxContentLength: 50 * 1024 * 1024
    });

    console.log(`☁️ [GCS] Image uploaded successfully to gs://${BUCKET_NAME}/${finalFilename}`);

    // Generate V4 Impersonated Signed URL
    const signedUrl = await generateV4ImpersonatedSignedUrl({
      bucketName: BUCKET_NAME,
      objectName: finalFilename,
      serviceAccount: SERVICE_ACCOUNT,
      expiresInSeconds: 7 * 24 * 3600 // 7 days
    });

    return {
      success: true,
      url: signedUrl,
      gcsPath: `gs://${BUCKET_NAME}/${finalFilename}`,
      bucket: BUCKET_NAME,
      filename: finalFilename
    };
  } catch (err) {
    console.error('⚠️ [GCS] Upload/SignedURL error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Upload Base64 Image to GCS and return impersonated V4 signed URL
 */
async function uploadBase64ImageToGcs(base64String, options = {}) {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('Invalid base64 image data');
  }

  let mimeType = 'image/png';
  let rawData = base64String;

  const match = base64String.match(/^data:([a-zA-Z0-9/+-]+);base64,(.*)$/s);
  if (match) {
    mimeType = match[1];
    rawData = match[2];
  }

  const buffer = Buffer.from(rawData, 'base64');
  return uploadImageBufferToGcs({
    buffer,
    mimeType,
    folder: options.folder || 'ai-ads-generated',
    filename: options.filename
  });
}

module.exports = {
  uploadImageBufferToGcs,
  uploadBase64ImageToGcs,
  generateV4ImpersonatedSignedUrl,
  BUCKET_NAME,
  SERVICE_ACCOUNT
};
