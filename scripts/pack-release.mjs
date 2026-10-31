#!/usr/bin/env node
/* 发布打包一条龙（2026-10-31 立）：删旧 zip → 打插件包 + 离线资源包 → 生成 SHA256SUMS.txt。
 * 动机：这三件事原来靠手敲 PowerShell（Compress-Archive -Force 会撞本机 safe-delete 钩子，
 * 得先 rm 旧 zip；SHA256SUMS 还要 sed 掉 msys 的 `*`）。
 * 用法：node scripts/pack-release.mjs [版本]   （缺省读 manifest.json 的 version）
 * 产物（.gitignore 内，不入库）：
 *   bz-<版本>.zip            包内一层 bz/：main.js manifest.json styles.css
 *   bz-offline-<版本>.zip    包内 bz-offline/downloads/**（用户手动下载、解压即用：
 *                            不带 skins.zip，tools/ 是解包后的目录 + 就绪标记）
 *   SHA256SUMS.txt           两个 zip 的 sha256（`<hash>  <file>` 两空格格式） */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
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

function copyDir(src, dest, skip = () => false, rel = '') {
  mkdirSync(dest, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (skip(childRel, e)) continue;
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, skip, childRel);
    else copyFileSync(s, d);
  }
}

/**
 * 离线包里 `downloads/` 的形状，跟仓库那份**故意不一样**（2026-10-31 用户实测修正）：
 *
 * - **不带 skins.zip**：整包只是「一次请求拿 26 套皮肤」的网络快路，离线包里皮肤
 *   本来就是 `skins/*.css` 逐个摊开的，包在反而多一份没人校验的副本。
 * - **tools/ 放解包后的目录，不是 .tar.gz**：插件判工具就绪看的是
 *   `downloads/tools/<id>/` 这个目录**加**里面的 `.bz-bundle.json` 标记
 *   （core/bundle-asset.ts 的 bundleStatus），只有归档它仍会走网络去下、解包——
 *   离线包的意义就是这一步都不用联网。所以这里解包 + 补标记，字段与插件自己
 *   写的一模一样（sha256 取清单里归档的那条）。
 */
function buildOfflineDownloads(dest) {
  copyDir(join(ROOT, 'downloads'), dest, (rel) => rel === 'skins.zip' || /^tools\/[^/]+\.tar\.gz$/.test(rel));

  const manifest = JSON.parse(readFileSync(join(ROOT, 'downloads', 'manifest.json'), 'utf8'));
  const tools = (manifest.docs || []).filter((e) => /^tools\/[^/]+\.tar\.gz$/.test(String(e.file || '')));
  for (const entry of tools) {
    const id = String(entry.file).replace(/^tools\//, '').replace(/\.tar\.gz$/, '');
    const dir = join(dest, 'tools', id);
    mkdirSync(dir, { recursive: true });
    // 两个坑：Windows 盘符的冒号会被 GNU tar 当「远程主机:文件」（--force-local），
    // 反斜杠它又不认（-C 的目标要用正斜杠）
    const posix = (p) => p.replace(/\\/g, '/');
    const r = spawnSync(
      'tar',
      ['--force-local', '-xzf', posix(join(ROOT, 'downloads', entry.file)), '-C', posix(dir)],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) {
      console.error(`[pack-release] 解包失败：${entry.file}`);
      process.exit(r.status || 1);
    }
    const sizes = [];
    let bytes = 0;
    const now = new Date();
    (function walk(base, rel) {
      for (const e of readdirSync(join(base, rel || '.'), { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${e.name}` : e.name;
        const abs = join(base, childRel);
        // tar 会还原始 mtime，里面有 1980 年之前的（zip 时间戳下界）——Compress-Archive
        // 读到就抛「指定的 DateTimeOffset 不能转换为 Zip 文件时间戳」，整个包打不出来。
        // 解包产物一律归到当前时间：文件字节没变，清单校验的还是内容。
        utimesSync(abs, now, now);
        if (e.isDirectory()) walk(base, childRel);
        else {
          const st = statSync(abs);
          sizes.push([childRel, st.size]);
          bytes += st.size;
        }
      }
    })(dir, '');
    // 标记在 walk 之后写：它自己不能算进 sizes（深校验会 stat 不到）
    writeFileSync(
      join(dir, '.bz-bundle.json'),
      JSON.stringify(
        {
          id: entry.id,
          sha256: String(entry.sha256 || '').toLowerCase(),
          files: sizes.length,
          bytes,
          sizes,
          at: Date.now(),
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`[pack-release] 离线包 tools/${id}：${sizes.length} 文件 / ${(bytes / 1024).toFixed(1)} KB（含就绪标记）`);
  }
}

mkdirSync(join(tmp, 'bz'), { recursive: true });
mkdirSync(join(tmp, 'bz-offline'), { recursive: true });
for (const f of bodyFiles) copyFileSync(join(ROOT, f), join(tmp, 'bz', f));
buildOfflineDownloads(join(tmp, 'bz-offline', 'downloads'));

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
