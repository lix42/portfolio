import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['turbo', 'run', 'cf-typegen'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  throw result.error;
}

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

if (result.status === null && result.signal) {
  process.kill(process.pid, result.signal);
}
