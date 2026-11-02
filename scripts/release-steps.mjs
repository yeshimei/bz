#!/usr/bin/env node
/* 发布七步一条龙（2026-10-31 立）：tools-pack → skin-pack → changelog → catalog →
 * manifest → build → assets，按固定顺序跑，每步结束做产物自检（文件存在 + 比起点新）。
 * 动机：七步拆开手跑，「少跑一步」的三个症状全是静默的（manifest 漏 = 清单 sha256 停在
 * 上一版、tools-pack 漏 = 用户端显示最新但内容旧、assets 漏 = 客户端拿上一版）。
 * 用法：node scripts/release-steps.mjs [--next=<版本>]   （--next 只透传给 changelog 步）
 * 全部步跑完后再跑一次 _gen-changelog --check（tag/manifest/日志版本 + docs sha256 对账）
 * ——这步只对账不重出产物，打 tag 之后跑同样有效。
 *
 * **七步不对外发布任何东西**（2026-11-02 立）：assets 步只本地暂存（--stage-only），
 * 分发仓与码云的对外镜像一律在 Release 转正之后由 release-gate 的 finalize 触发。
 * 原因是 v1.40.0 那次 assets 步跑在 tag 之前，把指针与三件套先放上了线。 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { manifestVersion, enforceGate } from './release-gate.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const startedAt = Date.now();
const nextArg = (process.argv.find((a) => a.startsWith('--next=')) || '').slice('--next='.length);

/* 第一道闸（2026-11-02 立）：版本号 + note 全文先给用户过目，他 approve-note 之后才许往下跑。
 * 放在七步之前，是因为产物一按版本出去就收不回来了——版本号猜错、文案没过目，
 * 都要等发完才发现（v1.40.0 就是这么翻的：一路跑到挂齐资产才想起来贴卡）。 */
enforceGate('note', ROOT, nextArg || manifestVersion(ROOT));

/** 比 startedAt 新的文件数（目录递归一层足够，downloads 结构浅） */
function freshCount(p) {
  if (!existsSync(p)) return 0;
  const st = statSync(p);
  if (st.isFile()) return st.mtimeMs > startedAt ? 1 : 0;
  let n = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const abs = join(p, e.name);
    if (e.isDirectory()) n += freshCount(abs);
    else if (statSync(abs).mtimeMs > startedAt) n++;
  }
  return n;
}

const steps = [
  {
    name: 'tools-pack',
    cmd: ['scripts/build-tools-pack.mjs'],
    check: () => {
      const dir = join(ROOT, 'downloads/tools');
      if (!existsSync(dir) || readdirSync(dir).filter((f) => f.endsWith('.tar.gz')).length < 1) {
        throw new Error('downloads/tools/ 里没有任何 tar.gz');
      }
      return '工具包在位';
    },
  },
  {
    name: 'skin-pack',
    cmd: ['scripts/build-skin-pack.mjs'],
    check: () => {
      const dir = join(ROOT, 'downloads/skins');
      if (!existsSync(dir)) throw new Error('downloads/skins/ 不存在');
      const n = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
      if (n < 1) throw new Error('downloads/skins/ 里没有任何域目录');
      return `皮肤在位（${n} 个域目录）`;
    },
  },
  {
    name: 'changelog',
    cmd: ['scripts/_gen-changelog.mjs', ...(nextArg ? [`--next=${nextArg}`] : [])],
    check: () => {
      const html = join(ROOT, 'docs/changelog.html');
      if (!existsSync(html) || statSync(html).mtimeMs <= startedAt) throw new Error('docs/changelog.html 没有重出');
      /* 定稿自检：docs/note-v*.md 里的定稿必须落进产物。生成器已自动应用定稿
       * （2026-10-31 起，不再靠人记得传 --note），这里再验一次产物与定稿一致——
       * 「Release 页与线上日志同源同稿」是发版的硬口径，不能只看文件重出了。 */
      const noteDir = join(ROOT, 'docs');
      if (existsSync(noteDir)) {
        const notes = readdirSync(noteDir).filter((n) => /^note-v\d+\.\d+\.\d+\.md$/.test(n));
        for (const name of notes) {
          const version = name.match(/^note-v(\d+\.\d+\.\d+)\.md$/)[1];
          const md = readFileSync(join(noteDir, name), 'utf8');
          const s = md.indexOf('# 更新日志');
          const e = md.indexOf('\n# ', s + 1);
          if (s < 0 || e < 0) continue;
          const want = md.slice(s, e).split('\n').filter((l) => l.trim().startsWith('- ')).length;
          const data = readFileSync(html, 'utf8').match(/const DATA = (\{.*?\});/s);
          if (!data) throw new Error('docs/changelog.html 里的 DATA 读不出来');
          const rel = JSON.parse(data[1]).releases.find((r) => r.version === version);
          if (!rel) throw new Error(`定稿 ${name} 对应的 v${version} 不在日志里`);
          const got = rel.added.length + rel.fixed.length + rel.improved.length;
          if (got !== want) {
            throw new Error(`日志 v${version} 有 ${got} 条，定稿 ${name} 是 ${want} 条——定稿没落进产物`);
          }
        }
      }
      return '日志页已重出（定稿已应用）';
    },
  },
  {
    name: 'catalog',
    cmd: ['scripts/build-catalog.mjs'],
    check: () => {
      const dir = join(ROOT, 'downloads');
      if (!existsSync(dir)) throw new Error('downloads/ 不存在');
      return '目录产物已更新';
    },
  },
  {
    name: 'manifest',
    cmd: ['scripts/build-manifest.mjs'],
    check: () => {
      const mf = join(ROOT, 'downloads/manifest.json');
      if (!existsSync(mf) || statSync(mf).mtimeMs <= startedAt) throw new Error('downloads/manifest.json 没有重算（sha256 会停在上一版，用户端必报不匹配）');
      return '清单 sha256 已现算';
    },
  },
  {
    name: 'build',
    cmd: ['esbuild.config.mjs', 'production'],
    npm: 'build',
    check: () => {
      for (const f of ['main.js', 'styles.css']) {
        const abs = join(ROOT, f);
        if (!existsSync(abs) || statSync(abs).mtimeMs <= startedAt) throw new Error(`${f} 没有重新构建`);
      }
      return '本体三件套已出';
    },
  },
  {
    name: 'assets',
    // 只本地暂存（2026-11-02 立）：七步跑在**打 tag 之前**，那时 Release 还不存在。
    // 原来这步直接推分发仓，等于把 version.json 指针与 releases/<tag> 三件套先于 Release
    // 放到线上——v1.40.0 的半成品就是这么出去的（Release 页 1.39.1，客户端已能装 1.40.0）。
    // 真推在 finalize（转正）之后，由 release-gate 的顺序闸放行。
    cmd: ['scripts/push-assets.mjs', '--stage-only'],
    check: () => '镜像目录已在本地暂存（对外推送要等 Release 转正后由 finalize 触发）',
  },
];

for (const step of steps) {
  const t0 = Date.now();
  const run = step.npm
    ? spawnSync('node', step.cmd, { cwd: ROOT, stdio: 'inherit', shell: false })
    : spawnSync(process.execPath, step.cmd, { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`\n[release-steps] 第「${step.name}」步失败（exit ${run.status}），后续步骤全部停掉。`);
    process.exit(run.status || 1);
  }
  try {
    const fact = step.check();
    console.log(`[release-steps] ✓ ${step.name}（${((Date.now() - t0) / 1000).toFixed(1)}s）${fact}`);
  } catch (e) {
    console.error(`\n[release-steps] 第「${step.name}」步产物自检不过：${e.message}`);
    process.exit(1);
  }
}

const check = spawnSync(process.execPath, [join(ROOT, 'scripts', '_gen-changelog.mjs'), '--check'], { cwd: ROOT, stdio: 'inherit' });
if (check.status !== 0) {
  console.error('[release-steps] 终检（--check）没过，见上方输出');
  process.exit(1);
}
console.log(`[release-steps] 七步全部完成，总耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s。接下来：打 tag → note 定稿回灌 → pack-release → gate create-draft → 确认卡 → gate finalize（转正后才镜像分发仓与码云）。`);
