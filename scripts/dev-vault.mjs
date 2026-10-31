#!/usr/bin/env node
/**
 * 测试库数据管理（ADR-0276）。目标 = 测试库（E:/Obsidian/测试，可用 BZ_TEST_VAULT / --vault 覆盖）。
 *
 * 用法：
 *   node scripts/dev-vault.mjs snapshot            # 快照测试库 bz 数据（data.json + storage/），留最近 5 份
 *   node scripts/dev-vault.mjs reset [--from <ts>] # 清空后回滚到快照（缺省最新一份）
 *   node scripts/dev-vault.mjs wipe                # 只清空（测「首次引导」等一次性流程）
 *   node scripts/dev-vault.mjs seed [--notes N]    # 从主库播种：bz 数据 + 最近 N 篇日记笔记
 *
 * 快照与数据都只动测试库，主库（叫我包仔）永远只读。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0];
const vIdx = args.indexOf('--vault');
const vaultName = vIdx >= 0 ? args[vIdx + 1] : path.basename(process.env.BZ_TEST_VAULT || '测试');
const VAULT = `E:/Obsidian/${vaultName}`;
const PLUGIN = `${VAULT}/.obsidian/plugins/bz`;
const SNAP_ROOT = `${VAULT}/.obsidian/bz-snapshots`;
const MAIN_VAULT = process.env.BZ_MAIN_VAULT || 'E:/Obsidian/叫我包仔';
const MAIN_PLUGIN = `${MAIN_VAULT}/.obsidian/plugins/bz`;
const keep = 5;

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function copyTree(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}
/** 清空测试库 bz 数据（data.json + storage/），保留 main.js 等构建产物 */
function wipe() {
  rm(path.join(PLUGIN, 'data.json'));
  rm(path.join(PLUGIN, 'storage'));
  console.log('✓ 已清空 data.json + storage/');
}
function snapshot() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(SNAP_ROOT, ts);
  copyTree(PLUGIN, dest);
  const all = fs.readdirSync(SNAP_ROOT).sort().reverse();
  for (const old of all.slice(keep)) rm(path.join(SNAP_ROOT, old));
  console.log(`✓ 快照 → ${dest}`);
}
function snapshots() {
  return fs.existsSync(SNAP_ROOT) ? fs.readdirSync(SNAP_ROOT).sort().reverse() : [];
}

if (cmd === 'snapshot') {
  snapshot();
} else if (cmd === 'wipe') {
  wipe();
} else if (cmd === 'reset') {
  const fIdx = args.indexOf('--from');
  const list = snapshots();
  const ts = fIdx >= 0 ? args[fIdx + 1] : list[0];
  if (!ts) { console.error('✗ 没有快照可回滚（先跑 snapshot）'); process.exit(1); }
  wipe();
  copyTree(path.join(SNAP_ROOT, ts), PLUGIN);
  console.log(`✓ 回滚到快照 ${ts}`);
} else if (cmd === 'seed') {
  const nIdx = args.indexOf('--notes');
  const notes = nIdx >= 0 ? Math.max(0, parseInt(args[nIdx + 1], 10) || 0) : 0;
  wipe();
  // bz 数据（data.json + storage/）
  for (const f of ['data.json']) {
    const s = path.join(MAIN_PLUGIN, f);
    if (fs.existsSync(s)) { fs.mkdirSync(PLUGIN, { recursive: true }); fs.copyFileSync(s, path.join(PLUGIN, f)); }
  }
  copyTree(path.join(MAIN_PLUGIN, 'storage'), path.join(PLUGIN, 'storage'));
  console.log('✓ bz 数据已从主库播种');
  // 最近 N 篇日记笔记（按文件名 = YYMMDDHHmm 时间戳倒序取）
  if (notes > 0) {
    const srcDir = path.join(MAIN_VAULT, '我的', '日记');
    const destDir = path.join(VAULT, '我的', '日记');
    if (!fs.existsSync(srcDir)) { console.error(`✗ 主库日记目录不存在：${srcDir}`); process.exit(1); }
    fs.mkdirSync(destDir, { recursive: true });
    const files = fs.readdirSync(srcDir).filter((f) => /^\d{10}(-\d+)?\.md$/.test(f)).sort().reverse().slice(0, notes);
    for (const f of files) fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    console.log(`✓ 播种 ${files.length} 篇日记笔记`);
  }
} else {
  console.error('用法：node scripts/dev-vault.mjs snapshot | reset [--from <ts>] | wipe | seed [--notes N]');
  process.exit(1);
}
