import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, fileExists, readJson, writeJson } from "../utils/file-ops.js";
import { mergeMcpServers } from "../utils/json-merge.js";
import {
  loadEnvFile,
  substituteTokensInObject,
} from "../utils/token-manager.js";

interface TMcpConfig {
  mcpServers?: Record<string, unknown>;
}

export interface TSetupOptions {
  rootDir: string;
  envConfigDir: string;
}

export async function setup(options: TSetupOptions): Promise<void> {
  const { rootDir, envConfigDir } = options;

  console.log("🔧 Setting up development environment...\n");

  // Step 1: Check for .env.local
  const envLocalPath = resolve(envConfigDir, ".env.local");
  const envSamplePath = resolve(envConfigDir, ".env.local.sample");

  if (!(await fileExists(envLocalPath))) {
    console.log("⚠️  .env.local not found");
    console.log(`📝 Please copy ${envSamplePath} to ${envLocalPath}`);
    console.log("   and fill in your actual tokens.\n");
    console.log("   Then run this script again.\n");
    process.exit(1);
  }

  // Step 2: Load environment variables
  console.log("📦 Loading environment variables from .env.local...");
  const env = await loadEnvFile(envLocalPath);
  console.log(`   ✓ Loaded ${Object.keys(env).length} variables\n`);

  // Step 3: Load MCP configurations
  console.log("📚 Loading MCP server configurations...");
  const mcpProjectPath = resolve(envConfigDir, "mcp-servers.project.json");
  const mcpLocalPath = resolve(envConfigDir, "mcp-servers.local.json");

  const mcpProject = await readJson<TMcpConfig>(mcpProjectPath);
  const mcpLocal = await readJson<TMcpConfig>(mcpLocalPath);

  if (!mcpProject) {
    console.error("❌ Error: mcp-servers.project.json not found");
    process.exit(1);
  }

  console.log(
    `   ✓ Project servers: ${Object.keys(mcpProject.mcpServers || {}).length}`,
  );
  console.log(
    `   ✓ Local servers: ${Object.keys(mcpLocal?.mcpServers || {}).length}\n`,
  );

  // Step 4: Setup Claude Code MCP files
  await setupClaudeMcp(rootDir, mcpProject, mcpLocal, env);

  // Step 5: Setup VSCode MCP file
  await setupVSCodeMcp(rootDir, mcpProject, mcpLocal, env);

  // Step 6: Copy other config files
  await copyOtherConfigs(rootDir, envConfigDir);

  console.log("\n✅ Environment setup complete!");
  console.log(
    "   You may need to restart your editor for changes to take effect.\n",
  );
}

async function setupClaudeMcp(
  rootDir: string,
  mcpProject: TMcpConfig,
  mcpLocal: TMcpConfig | null,
  env: Record<string, string>,
): Promise<void> {
  console.log("🔹 Setting up Claude Code MCP configurations...");

  const claudeDir = resolve(rootDir, ".claude");

  // Setup .claude/.mcp.json (project-level)
  const claudeMcpPath = resolve(claudeDir, ".mcp.json");
  const projectWithTokens = substituteTokensInObject(mcpProject, env);
  await writeJson(claudeMcpPath, projectWithTokens);
  console.log("   ✓ Created .claude/.mcp.json");

  // Setup .claude/.mcp.local.json (local-level, if exists)
  if (mcpLocal && Object.keys(mcpLocal.mcpServers || {}).length > 0) {
    const claudeMcpLocalPath = resolve(claudeDir, ".mcp.local.json");
    const localWithTokens = substituteTokensInObject(mcpLocal, env);
    await writeJson(claudeMcpLocalPath, localWithTokens);
    console.log("   ✓ Created .claude/.mcp.local.json");
  }
}

async function setupVSCodeMcp(
  rootDir: string,
  mcpProject: TMcpConfig,
  mcpLocal: TMcpConfig | null,
  env: Record<string, string>,
): Promise<void> {
  console.log("🔹 Setting up VSCode MCP configuration...");

  const vscodeDir = resolve(rootDir, ".vscode");
  const vscodeMcpPath = resolve(vscodeDir, "mcp.json");

  // Merge project + local for VSCode
  const merged = mergeMcpServers(mcpProject, mcpLocal);
  const mergedWithTokens = substituteTokensInObject(merged, env);

  await writeJson(vscodeMcpPath, mergedWithTokens);
  console.log("   ✓ Created .vscode/mcp.json (merged project + local)");
}

async function copyOtherConfigs(
  rootDir: string,
  envConfigDir: string,
): Promise<void> {
  console.log("🔹 Copying other configuration files...");

  const configs = [
    {
      src: resolve(envConfigDir, "vscode/settings.json"),
      dest: resolve(rootDir, ".vscode/settings.json"),
      name: ".vscode/settings.json",
    },
    {
      src: resolve(envConfigDir, "vscode/extensions.json"),
      dest: resolve(rootDir, ".vscode/extensions.json"),
      name: ".vscode/extensions.json",
    },
  ];

  for (const { src, dest, name } of configs) {
    if (await fileExists(src)) {
      await copyFile(src, dest);
      console.log(`   ✓ Copied ${name}`);
    }
  }

  // Note: Claude commands and Cursor rules are not copied since they're
  // already in the project and managed separately
}
