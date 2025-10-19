import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { readJson, writeJson, fileExists } from "../utils/file-ops.js";
import {
  detectTokens,
  replaceTokensInObject,
} from "../utils/token-manager.js";

interface TMcpConfig {
  mcpServers?: Record<string, unknown>;
}

export interface TSaveOptions {
  rootDir: string;
  envConfigDir: string;
  saveLocal: boolean;
}

export async function save(options: TSaveOptions): Promise<void> {
  const { saveLocal } = options;

  console.log("💾 Saving environment configurations...\n");

  if (saveLocal) {
    await saveLocalMcp(options);
  } else {
    await saveProjectMcp(options);
  }

  console.log("\n✅ Configuration saved successfully!\n");
}

async function saveProjectMcp(options: TSaveOptions): Promise<void> {
  const { rootDir, envConfigDir } = options;

  console.log("📚 Saving project MCP configuration...");

  // Read from .vscode/mcp.json (default source)
  const vscodeMcpPath = resolve(rootDir, ".vscode/mcp.json");

  if (!(await fileExists(vscodeMcpPath))) {
    console.log("⚠️  .vscode/mcp.json not found. Nothing to save.");
    return;
  }

  const vscodeMcp = await readJson<TMcpConfig>(vscodeMcpPath);
  if (!vscodeMcp || !vscodeMcp.mcpServers) {
    console.log("⚠️  No MCP servers found in .vscode/mcp.json");
    return;
  }

  console.log(
    `   Found ${Object.keys(vscodeMcp.mcpServers).length} MCP servers`,
  );

  // Detect and replace tokens
  const { config: processedConfig, replacements } = await processTokens(
    vscodeMcp,
  );

  // Save to mcp-servers.project.json
  const projectMcpPath = resolve(envConfigDir, "mcp-servers.project.json");
  await writeJson(projectMcpPath, processedConfig);
  console.log("   ✓ Saved to mcp-servers.project.json");

  // Update .env.local.sample if new tokens were found
  if (replacements.size > 0) {
    await updateEnvSample(envConfigDir, replacements);
  }
}

async function saveLocalMcp(options: TSaveOptions): Promise<void> {
  const { rootDir, envConfigDir } = options;

  console.log("📚 Saving local MCP configuration...");

  // Read from .claude/.mcp.local.json
  const claudeMcpLocalPath = resolve(rootDir, ".claude/.mcp.local.json");

  if (!(await fileExists(claudeMcpLocalPath))) {
    console.log("⚠️  .claude/.mcp.local.json not found. Nothing to save.");
    return;
  }

  const claudeMcpLocal = await readJson<TMcpConfig>(claudeMcpLocalPath);
  if (!claudeMcpLocal || !claudeMcpLocal.mcpServers) {
    console.log("⚠️  No MCP servers found in .claude/.mcp.local.json");
    return;
  }

  console.log(
    `   Found ${Object.keys(claudeMcpLocal.mcpServers).length} MCP servers`,
  );

  // Detect and replace tokens
  const { config: processedConfig, replacements } = await processTokens(
    claudeMcpLocal,
  );

  // Save to mcp-servers.local.json
  const localMcpPath = resolve(envConfigDir, "mcp-servers.local.json");
  await writeJson(localMcpPath, processedConfig);
  console.log("   ✓ Saved to mcp-servers.local.json");

  // Update .env.local.sample if new tokens were found
  if (replacements.size > 0) {
    await updateEnvSample(envConfigDir, replacements);
  }
}

async function processTokens(config: TMcpConfig): Promise<{
  config: TMcpConfig;
  replacements: Map<string, string>;
}> {
  const configStr = JSON.stringify(config, null, 2);
  const detectedTokens = detectTokens(configStr);

  if (detectedTokens.length === 0) {
    return { config, replacements: new Map() };
  }

  console.log(`\n🔍 Detected ${detectedTokens.length} potential token(s):`);

  const replacements = new Map<string, string>();

  for (const { token, context } of detectedTokens) {
    // Try to infer token name from context
    const varName = inferTokenName(token, context);

    console.log(`\n   Token: ${token.substring(0, 20)}...`);
    console.log(`   Context: ...${context.substring(0, 60)}...`);
    console.log(`   Will replace with: \${${varName}}`);

    // Check if this looks like a real token
    if (token.length < 20) {
      console.log(
        "   ⚠️  Warning: This looks short for a token. Please verify manually.",
      );
    }

    replacements.set(token, varName);
  }

  // Apply replacements
  const processedConfig = replaceTokensInObject(config, replacements);

  return { config: processedConfig, replacements };
}

function inferTokenName(token: string, context: string): string {
  // Check for common patterns in context
  const lowerContext = context.toLowerCase();

  if (lowerContext.includes("brightdata") || lowerContext.includes("bright-data")) {
    return "BRIGHT_DATA_TOKEN";
  }

  if (lowerContext.includes("supabase")) {
    return "SUPABASE_ACCESS_TOKEN";
  }

  if (lowerContext.includes("github")) {
    return "GITHUB_TOKEN";
  }

  if (lowerContext.includes("openai")) {
    return "OPENAI_API_KEY";
  }

  // Default fallback
  return "API_TOKEN";
}

async function updateEnvSample(
  envConfigDir: string,
  replacements: Map<string, string>,
): Promise<void> {
  console.log("\n📝 Updating .env.local.sample...");

  const envSamplePath = resolve(envConfigDir, ".env.local.sample");
  let content = "";

  if (await fileExists(envSamplePath)) {
    content = await readFile(envSamplePath, "utf-8");
  } else {
    content = "# MCP Server Tokens\n# Copy this file to .env.local and fill in your actual tokens\n\n";
  }

  // Parse existing env vars
  const existingVars = new Set<string>();
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      existingVars.add(match[1]);
    }
  }

  // Add new vars
  let newContent = content.trimEnd();
  let added = 0;

  for (const varName of new Set(replacements.values())) {
    if (!existingVars.has(varName)) {
      if (!newContent.endsWith("\n\n")) {
        newContent += "\n";
      }
      newContent += `\n# ${getTokenDescription(varName)}\n`;
      newContent += `${varName}=your_token_here\n`;
      added++;
    }
  }

  if (added > 0) {
    await writeFile(envSamplePath, newContent, "utf-8");
    console.log(`   ✓ Added ${added} new token placeholder(s)`);
  } else {
    console.log("   ✓ No new tokens to add");
  }
}

function getTokenDescription(varName: string): string {
  const descriptions: Record<string, string> = {
    BRIGHT_DATA_TOKEN: "Bright Data MCP Token",
    SUPABASE_ACCESS_TOKEN: "Supabase Access Token",
    GITHUB_TOKEN: "GitHub Personal Access Token",
    OPENAI_API_KEY: "OpenAI API Key",
    API_TOKEN: "API Token",
  };

  return descriptions[varName] || "Token";
}
