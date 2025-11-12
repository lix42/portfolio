import { access, readFile } from 'node:fs/promises';

import type { LocalFile } from './types.js';
import { mapLimit } from './utils.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  file: string;
  error: string;
}

/**
 * Validate JSON metadata files and their linked markdown files
 * TODO: Use Zod schema when shared package is created in Phase 3
 */
export async function validateDocuments(
  files: LocalFile[]
): Promise<ValidationResult> {
  // Group files by directory
  const jsonFiles = files.filter((f) => f.type === 'json');
  const markdownPaths = new Set(
    files.filter((f) => f.type === 'markdown').map((f) => f.path)
  );

  // Validate JSON files in parallel with concurrency limit
  const validationResults = await mapLimit(jsonFiles, 5, async (jsonFile) =>
    validateJsonFile(jsonFile, markdownPaths)
  );

  // Flatten results
  const allErrors = validationResults.flat();

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

async function validateJsonFile(
  jsonFile: LocalFile,
  markdownPaths: Set<string>
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  try {
    // 1. Validate JSON can be parsed
    const content = await readFile(jsonFile.absolutePath, 'utf-8');
    let metadata: any;

    try {
      metadata = JSON.parse(content);
    } catch (parseError) {
      errors.push({
        file: jsonFile.path,
        error: `Invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      });
      return errors;
    }

    // 2. Check for linked markdown file (same name, different extension)
    const expectedMarkdown = jsonFile.path.replace(/\.json$/, '.md');

    if (!markdownPaths.has(expectedMarkdown)) {
      // Check if file exists on disk (maybe not in the list due to filtering)
      const markdownPath = jsonFile.absolutePath.replace(/\.json$/, '.md');
      try {
        await access(markdownPath);
        // File exists but wasn't in the list - this is OK
      } catch {
        errors.push({
          file: jsonFile.path,
          error: `Linked markdown file not found: ${expectedMarkdown}`,
        });
      }
    }

    // 3. TODO: Validate against Zod schema when available in Phase 3
    // For now, just check that it's a valid object
    if (typeof metadata !== 'object' || metadata === null) {
      errors.push({
        file: jsonFile.path,
        error: 'JSON must be an object',
      });
    }
  } catch (error) {
    errors.push({
      file: jsonFile.path,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return errors;
}
