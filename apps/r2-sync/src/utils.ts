import chalk from 'chalk';
import type { SyncResult, SyncOptions } from './types.js';

/**
 * Helper function to limit concurrent operations
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (x: T) => Promise<R>
): Promise<R[]> {
  const out: Array<R | undefined> = new Array(items.length);
  let i = 0;
  const workers = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    });
  await Promise.all(workers);
  return out.filter((x): x is R => x !== undefined);
}

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
    console.log(chalk.cyan('🔍 Dry Run - Preview Changes:'));
  } else {
    console.log(result.success ? chalk.green('✓ Sync Complete') : chalk.red('✗ Sync Failed'));
  }

  console.log();
  console.log(`  Uploaded:  ${chalk.green(result.summary.uploaded)}`);
  console.log(`  Deleted:   ${chalk.red(result.summary.deleted)}`);
  console.log(`  Unchanged: ${chalk.gray(result.summary.unchanged)}`);
  console.log(`  Failed:    ${result.summary.failed > 0 ? chalk.red(result.summary.failed) : chalk.gray(result.summary.failed)}`);
  console.log(`  Duration:  ${(result.duration / 1000).toFixed(2)}s`);

  if (result.summary.failed > 0 && !options.ci) {
    console.log();
    console.log(chalk.red('Failed Operations:'));
    result.operations
      .filter(op => op.status === 'failed')
      .forEach(op => {
        console.log(chalk.red(`  ✗ ${op.path}: ${op.error}`));
      });
  }

  console.log();
}

export function loadConfig() {
  // Load from environment variables
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing required environment variables:\n' +
      '  - CLOUDFLARE_ACCOUNT_ID\n' +
      '  - R2_ACCESS_KEY_ID\n' +
      '  - R2_SECRET_ACCESS_KEY\n\n' +
      'See docs/cloudflare-migration/execution-plans/secrets-management.md'
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName: 'portfolio-documents',
  };
}
