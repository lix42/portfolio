import { readFile } from "node:fs/promises";
import { fileExists } from "./file-ops.js";

/**
 * Load environment variables from .env.local file
 */
export async function loadEnvFile(
  envPath: string,
): Promise<Record<string, string>> {
  if (!(await fileExists(envPath))) {
    return {};
  }

  const content = await readFile(envPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Parse KEY=value
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key] = value;
    }
  }

  return env;
}

/**
 * Substitute ${VAR_NAME} placeholders in a string
 */
export function substituteTokens(
  text: string,
  env: Record<string, string>,
): string {
  return text.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName: string) => {
    if (varName in env) {
      return env[varName];
    }
    console.warn(`⚠️  Warning: Environment variable ${varName} not found in .env.local`);
    return match;
  });
}

/**
 * Recursively substitute tokens in an object
 */
export function substituteTokensInObject<T>(
  obj: T,
  env: Record<string, string>,
): T {
  if (typeof obj === "string") {
    return substituteTokens(obj, env) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteTokensInObject(item, env)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteTokensInObject(value, env);
    }
    return result as T;
  }

  return obj;
}

/**
 * Detect potential tokens in text (long alphanumeric strings)
 * Returns array of detected tokens with their positions
 */
export function detectTokens(text: string): Array<{
  token: string;
  context: string;
}> {
  const tokens: Array<{ token: string; context: string }> = [];

  // Pattern: long alphanumeric strings (30+ chars) that look like tokens
  const tokenPattern = /[a-f0-9]{32,}|[A-Za-z0-9_-]{40,}/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[0];
    const start = Math.max(0, match.index - 30);
    const end = Math.min(text.length, match.index + token.length + 30);
    const context = text.slice(start, end);

    tokens.push({ token, context });
  }

  return tokens;
}

/**
 * Replace token in text with placeholder
 */
export function replaceTokenWithPlaceholder(
  text: string,
  token: string,
  varName: string,
): string {
  return text.replace(new RegExp(token, "g"), `\${${varName}}`);
}

/**
 * Recursively replace tokens in object with placeholders
 */
export function replaceTokensInObject<T>(
  obj: T,
  replacements: Map<string, string>,
): T {
  if (typeof obj === "string") {
    let result: string = obj;
    for (const [token, varName] of replacements) {
      result = replaceTokenWithPlaceholder(result, token, varName);
    }
    return result as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => replaceTokensInObject(item, replacements)) as unknown as T;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceTokensInObject(value, replacements);
    }
    return result as unknown as T;
  }

  return obj;
}
