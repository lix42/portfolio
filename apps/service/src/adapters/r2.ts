/**
 * R2 Storage Adapter
 * Pure functions for retrieving documents from R2
 */

/**
 * Get document content from R2 by key
 * Returns full document text or null if not found
 */
export async function getDocumentContent(
  r2Key: string,
  bucket: R2Bucket
): Promise<string | null> {
  const object = await bucket.get(r2Key);

  if (!object) {
    return null;
  }

  return await object.text();
}

/**
 * Check if document exists in R2
 */
export async function documentExists(
  r2Key: string,
  bucket: R2Bucket
): Promise<boolean> {
  const object = await bucket.head(r2Key);
  return object !== null;
}

/**
 * Get document metadata from R2
 */
export async function getDocumentMetadata(
  r2Key: string,
  bucket: R2Bucket
): Promise<R2Object | null> {
  return await bucket.head(r2Key);
}
