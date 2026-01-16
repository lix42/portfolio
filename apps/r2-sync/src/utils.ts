import chalk from "chalk";

import type { SyncOptions, SyncResult } from "./types.js";

export function displayResult(result: SyncResult, options: SyncOptions): void {
  // CI mode: output final summary as JSON
  if (options.ci) {
    const summary = {
      summary: result.summary,
      duration: result.duration,
      success: result.success,
    };
    console.log(JSON.stringify(summary));
    return;
  }

  // Interactive mode: formatted output
  console.log();

  if (options.dryRun) {
    console.log(chalk.cyan("🔍 Dry Run - Preview Changes:"));
  } else {
    console.log(
      result.success
        ? chalk.green("✓ Sync Complete")
        : chalk.red("✗ Sync Failed"),
    );
  }

  console.log();
  console.log(`  Uploaded:  ${chalk.green(result.summary.uploaded)}`);
  console.log(`  Deleted:   ${chalk.red(result.summary.deleted)}`);
  console.log(`  Unchanged: ${chalk.gray(result.summary.unchanged)}`);
  console.log(
    `  Failed:    ${result.summary.failed > 0 ? chalk.red(result.summary.failed) : chalk.gray(result.summary.failed)}`,
  );
  console.log(`  Duration:  ${(result.duration / 1000).toFixed(2)}s`);

  if (result.summary.failed > 0 && !options.ci) {
    console.log();
    console.log(chalk.red("Failed Operations:"));
    result.operations
      .filter((op) => op.status === "failed")
      .forEach((op) => {
        console.log(chalk.red(`  ✗ ${op.path}: ${op.error}`));
      });
  }

  console.log();
}

/**
 * Environment to R2 bucket name mapping.
 * Each environment has its own R2 bucket for isolation:
 * - R2 event notifications are 1:1:1 (bucket → queue → worker)
 * - Staging and production must use separate buckets
 */
const BUCKET_MAP: Record<string, string> = {
  staging: "portfolio-documents-staging",
  production: "portfolio-documents-prod",
};

export type R2Environment = "staging" | "production";

/**
 * Get the R2 bucket name for the given environment
 */
export function getBucketName(env: R2Environment): string {
  const bucket = BUCKET_MAP[env];
  if (!bucket) {
    throw new Error(
      `Invalid environment: ${env}. Valid options: ${Object.keys(BUCKET_MAP).join(", ")}`,
    );
  }
  return bucket;
}

export function loadConfig(env?: R2Environment) {
  // Load from environment variables
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing required environment variables:\n" +
        "  - CLOUDFLARE_ACCOUNT_ID\n" +
        "  - R2_ACCESS_KEY_ID\n" +
        "  - R2_SECRET_ACCESS_KEY\n\n" +
        "See docs/cloudflare-migration/execution-plans/secrets-management.md",
    );
  }

  // Environment is required - no default bucket
  if (!env) {
    throw new Error(
      "Environment is required. Use --env staging or --env production",
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: getBucketName(env),
  };
}
