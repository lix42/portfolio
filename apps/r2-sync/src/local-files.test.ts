import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listFiles } from "./local-files.js";

describe("listFiles", () => {
  const testDir = "./tmp/r2-sync-test";

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, "test.md"), "# Test");
    await writeFile(join(testDir, "meta.json"), '{"test":true}');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("should list both markdown and JSON files", async () => {
    const files = await listFiles({ documentsPath: testDir });

    expect(files).toHaveLength(2);
    expect(files.find((f) => f.path.endsWith("test.md"))).toBeDefined();
    expect(files.find((f) => f.path.endsWith("meta.json"))).toBeDefined();
  });

  it("should compute correct file types", async () => {
    const files = await listFiles({ documentsPath: testDir });

    const mdFile = files.find((f) => f.path.endsWith("test.md"));
    const jsonFile = files.find((f) => f.path.endsWith("meta.json"));

    expect(mdFile?.type).toBe("markdown");
    expect(jsonFile?.type).toBe("json");
  });
});
