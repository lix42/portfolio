/**
 * Deep merge two objects
 * Arrays are replaced, not merged
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue === undefined) {
      continue;
    }

    // If both are objects (and not arrays), merge recursively
    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[Extract<keyof T, string>];
    } else {
      // Otherwise, replace
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Merge MCP servers from multiple sources
 */
export function mergeMcpServers(
  ...sources: Array<{ mcpServers?: Record<string, unknown> } | null>
): { mcpServers: Record<string, unknown> } {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    if (source?.mcpServers) {
      Object.assign(merged, source.mcpServers);
    }
  }

  return { mcpServers: merged };
}

/**
 * Check if value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}
