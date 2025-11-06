import { S3Client, ListObjectsV2Command, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { readFile } from 'node:fs/promises';
import type { R2Object, FileOperation } from './types.js';

export class R2Client {
  private r2: S3Client;
  private bucketName: string;

  constructor(accountId: string, accessKeyId: string, secretAccessKey: string, bucketName: string) {
    this.bucketName = bucketName;

    // R2 endpoint format
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.r2 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * List all objects in R2 bucket with SHA-256 hash from metadata
   */
  async listObjects(): Promise<R2Object[]> {
    const objects: R2Object[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        ContinuationToken: continuationToken,
      });

      const response = await this.r2.send(command);

      if (response.Contents) {
        // Fetch metadata for each object to get SHA-256 hash
        const objectPromises = response.Contents.map(async (obj) => {
          if (obj.Key && obj.Size !== undefined && obj.LastModified) {
            try {
              // Fetch object metadata to get SHA-256 hash
              const headCommand = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: obj.Key,
              });
              const headResponse = await this.r2.send(headCommand);

              // Use SHA-256 from metadata, fallback to ETag (MD5) if not available
              const contentHash = headResponse.Metadata?.['sha256'] || obj.ETag?.replace(/"/g, '') || '';

              return {
                key: obj.Key,
                contentHash,
                size: obj.Size,
                lastModified: obj.LastModified,
              };
            } catch (error) {
              // If HEAD fails, skip this object
              console.error(`Failed to get metadata for ${obj.Key}:`, error);
              return null;
            }
          }
          return null;
        });

        // TODO: use promise.allSettled to handle individual failures
        const results = await Promise.all(objectPromises);
        objects.push(...results.filter((obj): obj is R2Object => obj !== null));
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  /**
   * Upload file to R2 with retry logic
   */
  async uploadFile(
    localPath: string,
    r2Key: string,
    contentHash: string,
    maxRetries: number = 3
  ): Promise<FileOperation> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const fileContent = await readFile(localPath);
        const contentType = r2Key.endsWith('.json') ? 'application/json' : 'text/markdown';

        const upload = new Upload({
          client: this.r2,
          params: {
            Bucket: this.bucketName,
            Key: r2Key,
            Body: fileContent,
            ContentType: contentType,
            Metadata: {
              sha256: contentHash, // Store SHA-256 for comparison
            },
          },
        });

        await upload.done();

        return {
          path: r2Key,
          operation: 'upload',
          status: 'success',
          size: fileContent.length,
          duration: Date.now() - startTime,
          retries: attempt - 1,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      path: r2Key,
      operation: 'upload',
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  /**
   * Delete file from R2 with retry logic
   */
  async deleteFile(r2Key: string, maxRetries: number = 3): Promise<FileOperation> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: r2Key,
        });

        await this.r2.send(command);

        return {
          path: r2Key,
          operation: 'delete',
          status: 'success',
          duration: Date.now() - startTime,
          retries: attempt - 1,
        };
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      path: r2Key,
      operation: 'delete',
      status: 'failed',
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
