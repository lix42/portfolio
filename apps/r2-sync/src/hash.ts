import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute SHA-256 hash of a file
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Compute SHA-256 hash of a buffer
 */
export function computeBufferHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
