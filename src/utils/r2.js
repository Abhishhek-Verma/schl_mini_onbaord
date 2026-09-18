import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/env.js";

let s3ClientInstance = null;

export function getR2Client() {
  if (!s3ClientInstance) {
    if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
      console.warn("[R2 STORAGE] Missing Cloudflare R2 credentials in environment variables.");
    }

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Generate a Presigned PUT URL for direct browser-to-R2 upload
 */
export async function generatePresignedUploadUrl({
  storageKey,
  mimeType,
  expiresInSeconds = 300,
}) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: storageKey,
    ContentType: mimeType,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a Presigned GET URL for secure private media downloads
 */
export async function generatePresignedDownloadUrl({
  storageKey,
  expiresInSeconds = 3600,
}) {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: storageKey,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an object from R2 bucket
 */
export async function deleteObjectFromR2(storageKey) {
  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: config.r2.bucketName,
    Key: storageKey,
  });

  return await client.send(command);
}

/**
 * Check if object exists in R2 bucket
 */
export async function checkObjectExistsInR2(storageKey) {
  const client = getR2Client();
  try {
    const command = new HeadObjectCommand({
      Bucket: config.r2.bucketName,
      Key: storageKey,
    });
    const res = await client.send(command);
    return { exists: true, sizeBytes: res.ContentLength, mimeType: res.ContentType };
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw err;
  }
}

/**
 * Get Public URL for a storage key
 */
export function getR2PublicUrl(storageKey) {
  if (!config.r2.publicUrl) {
    return `https://${config.r2.bucketName}.${config.r2.accountId}.r2.cloudflarestorage.com/${storageKey}`;
  }
  return `${config.r2.publicUrl}/${storageKey}`;
}