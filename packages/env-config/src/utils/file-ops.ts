import { readFile, writeFile, mkdir, access, constants } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Read JSON file and parse it
 */
export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write JSON to file with pretty formatting
 */
export async function writeJson(
  filePath: string,
  data: unknown,
  indent = 2,
): Promise<void> {
  await ensureDir(dirname(filePath));
  const content = JSON.stringify(data, null, indent);
  await writeFile(filePath, `${content}\n`, "utf-8");
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Copy file from source to destination
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest));
  const content = await readFile(src, "utf-8");
  await writeFile(dest, content, "utf-8");
}
