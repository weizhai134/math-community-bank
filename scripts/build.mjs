import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Windows 上 esbuild 偶尔无权删除系统 Temp 里的临时文件，
 * 导致构建在 transform 阶段报 Access is denied。
 * 这里把 TEMP/TMP 指向项目内的可写目录，再执行真正的构建。
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = path.join(root, '.tmp', 'esbuild-temp');
mkdirSync(tempDir, { recursive: true });

const env = { ...process.env, TEMP: tempDir, TMP: tempDir };
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['run', 'build:raw'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
