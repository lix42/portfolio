import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { computeFileHash } from "./hash.js";
import type { LocalFile } from "./types.js";

export interface ScanConfig {
  documentsPath: string;
}

/**
 * List all markdown and JSON files recursively
 */
export async function listFiles(config: ScanConfig): Promise<LocalFile[]> {
  // Resolve documentsPath to absolute path for consistent relative path calculation
  const baseDir = resolve(config.documentsPath);

  // Collect all file paths first
  const filePaths = await collectFilePaths(baseDir);

  // Hash all files in parallel for better performance
  const files = await Promise.all(
    filePaths.map(async ({ path, type }) => {
      const stats = await stat(path);
      const absolutePath = resolve(path);
      const hash = await computeFileHash(path);

      return {
        path: relative(baseDir, absolutePath),
        absolutePath,
        hash,
        size: stats.size,
        type,
      };
    }),
  );

  return files;
}

async function collectFilePaths(
  currentDir: string,
): Promise<Array<{ path: string; type: "markdown" | "json" }>> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const results: Array<{ path: string; type: "markdown" | "json" }> = [];

  for (const entry of entries) {
    const path = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await collectFilePaths(path);
      results.push(...subFiles);
    } else if (entry.isFile() && isDocumentFile(entry.name)) {
      results.push({
        path,
        type: getFileType(entry.name),
      });
    }
  }

  return results;
}

function isDocumentFile(filename: string): boolean {
  return filename.endsWith(".md") || filename.endsWith(".json");
}

function getFileType(filename: string): "markdown" | "json" {
  return filename.endsWith(".json") ? "json" : "markdown";
}
