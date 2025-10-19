#!/usr/bin/env node
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setup } from "../commands/setup.js";
import { save } from "../commands/save.js";

// Find the project root - when running via pnpm scripts, cwd is the project root
// This works both when installed as a package and when running from workspace
const ROOT_DIR = process.cwd().includes("/packages/env-config")
  ? resolve(process.cwd(), "../..")
  : process.cwd();
const ENV_CONFIG_DIR = resolve(ROOT_DIR, "env-config");

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "setup":
        await setup({ rootDir: ROOT_DIR, envConfigDir: ENV_CONFIG_DIR });
        break;

      case "save":
        await save({
          rootDir: ROOT_DIR,
          envConfigDir: ENV_CONFIG_DIR,
          saveLocal: args.includes("--local"),
        });
        break;

      default:
        console.log("Usage:");
        console.log("  env-config setup           Setup development environment");
        console.log("  env-config save            Save project MCP configuration");
        console.log("  env-config save --local    Save local MCP configuration");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
