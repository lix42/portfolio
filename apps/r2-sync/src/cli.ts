#!/usr/bin/env node
import { Command } from 'commander';
import { sync } from './syncer.js';
import { R2Client } from './r2-client.js';
import { displayResult, loadConfig } from './utils.js';
import type { SyncOptions } from './types.js';
import { resolve } from 'node:path';

const program = new Command();

program
  .name('r2-sync')
  .description('Sync local documents to Cloudflare R2')
  .version('1.0.0');

program
  .option('-e, --env <environment>', 'Environment (dev, staging, production)', 'dev')
  .option('-d, --documents-path <path>', 'Path to documents folder', 'documents/experiments')
  .option('--dry-run', 'Preview changes without executing', false)
  .option('--delete', 'Allow deletion of files not in local folder', false)
  .option('--ci', 'CI/CD mode (non-interactive, JSON output)', false)
  .option('--fail-fast', 'Exit on first error', false)
  .option('--max-retries <number>', 'Maximum retry attempts per file', '3')
  .option('-f, --file <path>', 'Sync specific file')
  .action(async (options) => {
    try {
      await runSync(options);
    } catch (error) {
      if (options.ci) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      } else {
        console.error('✗ Sync failed:', error);
      }
      process.exit(1);
    }
  });

async function runSync(cliOptions: any): Promise<void> {
  // Load configuration based on environment
  const config = loadConfig(cliOptions.env);

  // Resolve documents path (can be relative or absolute)
  const documentsPath = resolve(process.cwd(), cliOptions.documentsPath);

  // Build sync options
  const syncOptions: SyncOptions = {
    env: cliOptions.env,
    documentsPath,
    dryRun: cliOptions.dryRun,
    allowDelete: cliOptions.delete,
    ci: cliOptions.ci,
    json: cliOptions.ci, // Always use JSON in CI mode
    failFast: cliOptions.failFast,
    filePattern: cliOptions.file,
    maxRetries: parseInt(cliOptions.maxRetries, 10),
  };

  // Initialize R2 client
  const r2Client = new R2Client(
    config.accountId,
    config.accessKeyId,
    config.secretAccessKey,
    config.bucketName
  );

  // Run sync using functional API
  const result = await sync(r2Client, syncOptions);

  // Output results
  displayResult(result, syncOptions);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

program.parse();
