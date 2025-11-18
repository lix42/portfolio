import {
  type DocumentMetadata,
  validateDocumentMetadata,
} from '@portfolio/shared';

import type { ProcessingDocumentMetadata } from '../types';

/**
 * Extract metadata from R2 object or companion JSON file
 */
export async function extractMetadata(
  r2Key: string,
  bucket: R2Bucket
): Promise<ProcessingDocumentMetadata> {
  // Try to get companion .json file (e.g., "path/to/doc.md" -> "path/to/doc.json")
  const jsonKey = r2Key.replace(/\.md$/, '.json');
  const jsonObject = await bucket.get(jsonKey);

  if (jsonObject) {
    const rawMetadata = await jsonObject.json();
    const validation = validateDocumentMetadata(rawMetadata);

    if (!validation.success) {
      throw new Error(
        `Invalid metadata in ${jsonKey}: ${validation.errors?.join(', ')}`
      );
    }

    // validation.data is guaranteed to be defined when success is true
    const metadata = validation.data as DocumentMetadata;
    return {
      ...metadata,
      r2Key,
      contentHash: '', // Will be set by caller
    };
  }

  // Fallback: extract from R2 custom metadata
  const r2Object = await bucket.get(r2Key);
  if (r2Object?.customMetadata) {
    const rawMetadata = {
      project: r2Object.customMetadata['project'],
      document: r2Object.customMetadata['document'],
      company: r2Object.customMetadata['company'],
    };

    const validation = validateDocumentMetadata(rawMetadata);

    if (!validation.success) {
      throw new Error(
        `Invalid R2 custom metadata for ${r2Key}: ${validation.errors?.join(', ')}`
      );
    }

    // validation.data is guaranteed to be defined when success is true
    const metadata = validation.data as DocumentMetadata;
    return {
      ...metadata,
      r2Key,
      contentHash: '', // Will be set by caller
    };
  }

  // No metadata found - throw error instead of returning defaults
  throw new Error(
    `No metadata found for ${r2Key}. Expected companion .json file or R2 custom metadata.`
  );
}
