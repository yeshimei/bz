#!/usr/bin/env node
/* 发版两道闸（`scripts/release-gate.mjs`，2026-11-02 立）
 *
 * 为什么要有这段代码：发版流程里「给用户过目」这件事原先只写在 skill 里，靠记性维持。
 * 已经出过两次事故——v1.36.0 出现过「正文已定稿、离线包还是旧日志」的半成品被挂上线；
 * v1.40.0 那次我一路跑到 draft 挂齐资产才想起来贴确认卡，版本号还是我替用户定的。
 * 笔记里的规矩管不住手快，只有让脚本自己拒绝往下跑才管得住（用户 2026-11-02 拍板：
 * 「限制到代码层面」）。
 *
 * 两道闸：
 *  1. **note 闸**（打包之前）：版本号 + note 全文先给用户过目，他 `approve-note` 之后
 *     才允许跑 `release-steps` / `pack-release`。没这一步，产物就按我猜的版本与文案出去了。
 *  2. **publish 闸**（上线之前）：资产挂齐后把「note 全文 + 资产清单与 sha256」再贴一遍，
 *     他 `approve-publish --i-say=发布` 才允许上传与转正。`--i-say` 的值必须是「发布」
 *     两个字——防手滑，也防「帮我准备一下」被当成放行。
 *
 * 闸的状态记在仓库根 `.bz-release-gate.json`（已 gitignore，不进版本库）。
 * **note 改一个字节，两道闸同时作废**：noteSha256 对不上就得重新过目，
 * 不会出现「批准的是旧稿、发出去的是新稿」。
 *
 * 用法：
 *   node scripts/release-gate.mjs show [--version=X]                 # 打印版本 + note 全文 + 闸状态
 *   node scripts/release-gate.mjs approve-note --version=X           # 第一道闸放行（给人敲）
 *   node scripts/release-gate.mjs approve-publish --version=X --i-say=发布   # 第二道闸放行
 *   node scripts/release-gate.mjs check-note [--version=X]           # 给脚本内部调用，未放行 exit 2
 *   node scripts/release-gate.mjs check-publish [--version=X]        # 同上
 *   node scripts/release-gate.mjs reset                              # 作废，重新走一遍
 *
 * 版本号缺省读 manifest.json（`_gen-changelog` 回写的那个，唯一事实源）。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GATE_NAME = '.bz-release-gate.json';

/** 放行「发布」时必须原样敲出的两个字（防「准备一下」「顺便发吧」被当成放行） */
export const PUBLISH_WORD = '发布';

/* ==================== 基础件（纯函数，测试直调） ==================== */

/** 文件 sha256；不存在 → null */
export function sha256File(p) {
  if (!p || !existsSync(p)) return null;
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** manifest.json 里的版本（唯一事实源） */
export function manifestVersion(root) {
  const p = join(root, 'manifest.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

export function notePath(root, version) {
  return join(root, 'docs', `note-v${version}.md`);
}

/** note 里要给用户过目的正文（`# 更新日志` 起到下一个一级标题之前） */
export function noteBody(root, version) {
  const p = notePath(root, version);
  if (!existsSync(p)) return null;
  const md = readFileSync(p, 'utf8');
  const s = md.indexOf('# 更新日志');
  if (s < 0) return md;
  const e = md.indexOf('\n# ', s + 1);
  return e < 0 ? md.slice(s) : md.slice(s, e);
}

/** Release 上要挂的那批资产（与 bz-release skill 的清单同源） */
export function releaseAssetNames(version) {
  return [
    `bz-${version}.zip`,
    `bz-offline-${version}.zip`,
    'SHA256SUMS.txt',
    'main.js',
    'manifest.json',
    'styles.css',
  ];
}

/** 资产清单：[{name, size, sha256}]；缺文件 sha256 为 null（缺件本身就是没过闸的理由） */
export function assetList(root, version) {
  return releaseAssetNames(version).map((name) => {
    const p = join(root, name);
    let size = null;
    if (existsSync(p)) size = readFileSync(p).length;
    return { name, size, sha256: sha256File(p) };
  });
}

/** 资产指纹：逐个 sha256 拼起来再算一遍，换任何一个文件都会变 */
export function assetFingerprint(root, version) {
  const parts = assetList(root, version).map((a) => `${a.name}:${a.sha256 ?? '-'}`);
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}

/** 源码主仓 slug（Release 开在这里）：取 origin 的第一条 pushurl */
export function sourceSlug(root) {
  try {
    const out = spawnSync('git', ['remote', 'get-url', 'origin', '--push'], { cwd: root, encoding: 'utf8' }).stdout || '';
    const first = out.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
    const m = first.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    if (m) return `${m[1]}/${m[2]}`;
  } catch {
    /* 读不到就用下面的兜底 */
  }
  return 'yeshimei/bz';
}

export function gatePath(root) {
  return join(root, GATE_NAME);
}

export function readGate(root) {
  const p = gatePath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null; // 闸文件坏了按「没批准」处理——宁可多问一遍
  }
}

export function writeGate(root, gate) {
  writeFileSync(gatePath(root), `${JSON.stringify(gate, null, 2)}\n`);
}

export function clearGate(root) {
  const p = gatePath(root);
  if (existsSync(p)) rmSync(p);
}

/* ==================== 两道闸的判定（纯函数，不打印不退出） ==================== */

/** 第一道闸：note 有没有被过目批准 */
export function evaluateNote(root, version) {
  const p = notePath(root, version);
  if (!existsSync(p)) {
    return { ok: false, version, reason: `docs/note-v${version}.md 不存在——先把 note 写出来给用户过目` };
  }
  const sha = sha256File(p);
  const gate = readGate(root);
  if (!gate || gate.version !== version) {
    return { ok: false, version, noteSha256: sha, reason: '这一版还没过目（闸里没有批准记录）' };
  }
  if (gate.noteSha256 !== sha) {
    return {
      ok: false,
      version,
      noteSha256: sha,
      reason: 'note 在批准之后又改过——批准的是旧稿，必须重新过目',
    };
  }
  return { ok: true, version, noteSha256: sha, approvedAt: gate.noteApprovedAt ?? null };
}

/** 第二道闸：note 批准 + 用户明确说了「发布」 */
export function evaluatePublish(root, version) {
  const note = evaluateNote(root, version);
  if (!note.ok) return { ok: false, version, reason: `note 闸没过：${note.reason}` };
  const gate = readGate(root);
  const fingerprint = assetFingerprint(root, version);
  if (!gate.publishApprovedAt) {
    return { ok: false, version, fingerprint, reason: '还没放行发布（要 --i-say=发布）' };
  }
  if (gate.assetsSha256 && gate.assetsSha256 !== fingerprint) {
    return {
      ok: false,
      version,
      fingerprint,
      reason: '批准之后资产又变了（重打过包 / 重出过产物）——确认卡对不上，重新过目',
    };
  }
  return { ok: true, version, fingerprint, approvedAt: gate.publishApprovedAt };
}

/* ==================== 打印件 ==================== */

function fmtBytes(n) {
  if (n == null) return '缺件';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 给第一道闸用的过目卡：版本号 + note 全文 */
export function renderNoteCard(root, version) {
  const body = noteBody(root, version) ?? '（note 不存在）';
  return [
    `版本号：v${version}`,
    `note 文件：docs/note-v${version}.md（sha256 ${sha256File(notePath(root, version)) ?? '-'}）`,
    '',
    body.trimEnd(),
    '',
    '确认后放行：',
    `  node scripts/release-gate.mjs approve-note --version=${version}`,
  ].join('\n');
}

/** 给第二道闸用的确认卡：note 全文 + 资产清单与摘要 */
export function renderPublishCard(root, version) {
  const rows = assetList(root, version).map(
    (a) => `  ${a.name.padEnd(28)} ${fmtBytes(a.size).padStart(9)}  ${a.sha256 ?? '缺件'}`,
  );
  return [
    `版本号：v${version}`,
    `资产指纹：${assetFingerprint(root, version)}`,
    '',
    noteBody(root, version)?.trimEnd() ?? '（note 不存在）',
    '',
    '资产清单（名称 / 大小 / sha256）:',
    ...rows,
    '',
    '确认后放行（一字不差敲两个字）:',
    `  node scripts/release-gate.mjs approve-publish --version=${version} --i-say=${PUBLISH_WORD}`,
  ].join('\n');
}

/* ==================== CLI ==================== */

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'show';
const arg = (k) => (argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
const version = arg('version') || manifestVersion(ROOT);

function needVersion() {
  if (!version) {
    console.error('[release-gate] 读不到版本号：manifest.json 缺失或没有 version 字段，用 --version=X 显式给');
    process.exit(1);
  }
  return version;
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

function main() {
  switch (cmd) {
    case 'show': {
      const v = needVersion();
      const gate = readGate(ROOT);
      const note = evaluateNote(ROOT, v);
      const pub = evaluatePublish(ROOT, v);
      console.log(`[release-gate] v${v}  note闸=${note.ok ? '已过' : '未过'}  publish闸=${pub.ok ? '已过' : '未过'}`);
      if (gate) console.log(`[release-gate] 闸文件：${GATE_NAME}（note ${gate.noteApprovedAt ?? '-'} / publish ${gate.publishApprovedAt ?? '-'}）`);
      console.log('');
      console.log(note.ok ? renderNoteCard(ROOT, v) : renderNoteCard(ROOT, v));
      break;
    }
    case 'approve-note': {
      const v = needVersion();
      const sha = sha256File(notePath(ROOT, v));
      if (!sha) {
        console.error(`[release-gate] docs/note-v${v}.md 不存在——版本或文件不对`);
        process.exit(1);
      }
      const prev = readGate(ROOT);
      writeGate(ROOT, {
        version: v,
        note: `docs/note-v${v}.md`,
        noteSha256: sha,
        noteApprovedAt: new Date().toISOString(),
        // 换版本或换稿子，之前那次「放行发布」一律作废
        ...(prev && prev.version === v && prev.noteSha256 === sha
          ? { assetsSha256: prev.assetsSha256, publishApprovedAt: prev.publishApprovedAt }
          : {}),
      });
      console.log(`[release-gate] ✓ 第一道闸已放行：v${v}（note sha256 ${sha.slice(0, 12)}…）`);
      console.log('[release-gate] 接下来可以跑：node scripts/release-steps.mjs / pack-release.mjs');
      break;
    }
    case 'approve-publish': {
      const v = needVersion();
      const said = arg('i-say');
      if (said !== PUBLISH_WORD) {
        console.error(`[release-gate] ✗ 没说「${PUBLISH_WORD}」——这次收到的是「${said || '（空）'}」。`);
        console.error(`[release-gate] 要放行就原样敲：--i-say=${PUBLISH_WORD}`);
        process.exit(1);
      }
      const note = evaluateNote(ROOT, v);
      if (!note.ok) {
        console.error(`[release-gate] ✗ note 闸没过：${note.reason}`);
        process.exit(1);
      }
      const gate = readGate(ROOT);
      const fingerprint = assetFingerprint(ROOT, v);
      const missing = assetList(ROOT, v).filter((a) => !a.sha256);
      if (missing.length) {
        console.error(`[release-gate] ✗ 资产缺件：${missing.map((a) => a.name).join('、')}`);
        process.exit(1);
      }
      writeGate(ROOT, {
        version: v,
        note: `docs/note-v${v}.md`,
        noteSha256: note.noteSha256,
        noteApprovedAt: gate.noteApprovedAt ?? new Date().toISOString(),
        assetsSha256: fingerprint,
        publishApprovedAt: new Date().toISOString(),
      });
      console.log(`[release-gate] ✓ 第二道闸已放行：v${v}（资产指纹 ${fingerprint.slice(0, 12)}…）`);
      break;
    }
    case 'check-note': {
      const v = needVersion();
      const r = evaluateNote(ROOT, v);
      if (!r.ok) {
        console.error(`\n[release-gate] ✗ 第一道闸没过（v${v}）：${r.reason}`);
        console.error('—— 版本号与 note 全文必须先给用户过目：\n');
        console.error(renderNoteCard(ROOT, v));
        process.exit(2);
      }
      console.log(`[release-gate] ✓ note 闸已过：v${v}`);
      break;
    }
    case 'check-publish': {
      const v = needVersion();
      const r = evaluatePublish(ROOT, v);
      if (!r.ok) {
        console.error(`\n[release-gate] ✗ 第二道闸没过（v${v}）：${r.reason}`);
        console.error('—— 上传 / 转正之前必须把下面这张卡给用户过目：\n');
        console.error(renderPublishCard(ROOT, v));
        process.exit(2);
      }
      console.log(`[release-gate] ✓ publish 闸已过：v${v}`);
      break;
    }
    case 'create-draft': {
      const v = needVersion();
      enforceGate('publish', ROOT, v);
      const slug = sourceSlug(ROOT);
      const mf = releaseAssetNames(v);
      const missing = assetList(ROOT, v).filter((a) => !a.sha256);
      if (missing.length) {
        console.error(`[release-gate] ✗ 资产缺件：${missing.map((a) => a.name).join('、')}——先跑 pack-release`);
        process.exit(1);
      }
      const run = spawnSync(
        'gh',
        ['release', 'create', `v${v}`, '-R', slug, '--draft', '--title', `bz v${v}`,
          '--notes-file', `docs/note-v${v}.md`, ...mf],
        { cwd: ROOT, stdio: 'inherit' },
      );
      if (run.status !== 0) process.exit(run.status || 1);
      const more = spawnSync(process.execPath, ['scripts/push-assets.mjs', '--upload-only'], { cwd: ROOT, stdio: 'inherit' });
      if (more.status !== 0) process.exit(more.status || 1);
      console.log(`\n[release-gate] 草稿与资产就绪：https://github.com/${slug}/releases/tag/v${v}`);
      console.log(`[release-gate] 还是草稿。等他说「发布」再跑：`);
      console.log(`  node scripts/release-gate.mjs finalize --version=${v} --i-say=${PUBLISH_WORD}`);
      break;
    }
    case 'finalize': {
      const v = needVersion();
      const said = arg('i-say');
      if (said !== PUBLISH_WORD) {
        console.error(`[release-gate] ✗ 没说「${PUBLISH_WORD}」——这次收到的是「${said || '（空）'}」。`);
        process.exit(1);
      }
      enforceGate('publish', ROOT, v);
      const slug = sourceSlug(ROOT);
      const edit = spawnSync('gh', ['release', 'edit', `v${v}`, '-R', slug, '--draft=false'], { cwd: ROOT, stdio: 'inherit' });
      if (edit.status !== 0) process.exit(edit.status || 1);
      console.log(`[release-gate] ✓ 已转正：https://github.com/${slug}/releases/tag/v${v}`);
      const gitee = spawnSync(process.execPath, ['scripts/push-gitee.mjs'], { cwd: ROOT, stdio: 'inherit' });
      if (gitee.status !== 0) console.error('[release-gate] 码云镜像没跑成（GitHub 已发布，可稍后补跑）');
      break;
    }
    case 'reset': {
      clearGate(ROOT);
      console.log('[release-gate] 闸已作废，两道都要重新过');
      break;
    }
    default:
      console.error(`[release-gate] 未知子命令：${cmd}`);
      process.exit(1);
  }
}

/** 子进程跑一道闸，未过就把父脚本停掉（exit code 透传） */
export function enforceGate(which, root = ROOT, v = manifestVersion(root)) {
  const run = spawnSync(
    process.execPath,
    [join(root, 'scripts', 'release-gate.mjs'), `check-${which}`, `--version=${v}`],
    { cwd: root, stdio: 'inherit' },
  );
  if (run.status !== 0) process.exit(run.status || 1);
}

if (isMain()) main();
