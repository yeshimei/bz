#!/usr/bin/env node
/* 发布打包一条龙（2026-10-31 立）：删旧 zip → 打插件包 + 离线资源包 → 生成 SHA256SUMS.txt。
 * 动机：这三件事原来靠手敲 PowerShell（Compress-Archive -Force 会撞本机 safe-delete 钩子，
 * 得先 rm 旧 zip；SHA256SUMS 还要 sed 掉 msys 的 `*`）。
 * 用法：node scripts/pack-release.mjs [版本]   （缺省读 manifest.json 的 version）
 * 产物（.gitignore 内，不入库）：
 *   bz-<版本>.zip            包内一层 bz/：main.js manifest.json styles.css
 *   bz-offline-<版本>.zip    包内 bz-offline/downloads/**（整目录镜像）
 *   SHA256SUMS.txt           两个 zip 的 sha256（`<hash>  <file>` 两空格格式） */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ver = process.argv[2] || JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;
const tmp = join(ROOT, '.pack-tmp');
const zips = [`bz-${ver}.zip`, `bz-offline-${ver}.zip`];

for (const z of zips) {
  const abs = join(ROOT, z);
  if (existsSync(abs)) rmSync(abs); // 先删旧的：Compress-Archive -Force 会撞 safe-delete 钩子
}
rmSync(tmp, { recursive: true, force: true });

const bodyFiles = ['main.js', 'manifest.json', 'styles.css'];
for (const f of bodyFiles) {
  if (!existsSync(join(ROOT, f)) || statSync(join(ROOT, f)).mtimeMs < Date.now() - 1000 * 60 * 60 * 24 * 7) {
    // 本体太旧（一周以上没构建过）多半是忘了跑七步，提醒但不拦
    console.warn(`[pack-release] 提醒：${f} 看起来不是新构建的（确认七步跑过再传）`);
  }
}
if (!existsSync(join(ROOT, 'downloads'))) {
  console.error('[pack-release] 缺 downloads/——先跑七步出资源');
  process.exit(1);
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

mkdirSync(join(tmp, 'bz'), { recursive: true });
mkdirSync(join(tmp, 'bz-offline'), { recursive: true });
for (const f of bodyFiles) copyFileSync(join(ROOT, f), join(tmp, 'bz', f));
copyDir(join(ROOT, 'downloads'), join(tmp, 'bz-offline', 'downloads'));

for (const [src, dest] of [[join(tmp, 'bz'), zips[0]], [join(tmp, 'bz-offline'), zips[1]]]) {
  const cmd = `Compress-Archive -Path '${src.replace(/\//g, '\\')}' -DestinationPath '${join(ROOT, dest).replace(/\//g, '\\')}' -Force`;
  const run = spawnSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`[pack-release] 打包失败：${dest}`);
    process.exit(run.status || 1);
  }
}
rmSync(tmp, { recursive: true, force: true });

const lines = zips.map((z) => {
  const buf = readFileSync(join(ROOT, z));
  const hash = createHash('sha256').update(buf).digest('hex');
  console.log(`[pack-release] ${z}  ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  return `${hash}  ${z}`;
});
writeFileSync(join(ROOT, 'SHA256SUMS.txt'), lines.join('\n') + '\n', 'utf8');
console.log(`[pack-release] 完成：${zips.join(' / ')} + SHA256SUMS.txt（v${ver}）`);
