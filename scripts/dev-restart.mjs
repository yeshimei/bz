#!/usr/bin/env node
/**
 * 开发重启一条龙（ADR-0276）：构建 → styles.css 同步成测试库 snippet → 重启 Obsidian。
 *
 * 用法：
 *   node scripts/dev-restart.mjs                 # 构建 + 同步 + 重启（默认目标 = 测试库）
 *   node scripts/dev-restart.mjs --no-build      # 跳过构建（只同步 + 重启）
 *   node scripts/dev-restart.mjs --vault <名>    # 换目标库（E:/Obsidian/<名>）
 *
 * 环境变量：BZ_TEST_VAULT（缺省 E:/Obsidian/测试）
 *
 * CSS 免重启原理：styles.css 拷成 <vault>/.obsidian/snippets/bz-dev.css 并在
 * appearance.json 里启用——Obsidian 实时监听 snippets 目录，存盘即生效。
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const vIdx = args.indexOf('--vault');
const vaultName = vIdx >= 0 ? args[vIdx + 1] : path.basename(process.env.BZ_TEST_VAULT || '测试');
const VAULT = `E:/Obsidian/${vaultName}`;
const PLUGIN_DIR = `${VAULT}/.obsidian/plugins/bz`;
const SNIPPETS = `${VAULT}/.obsidian/snippets`;

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: 'cmd.exe' });
}

// 1) 构建（once 模式：不压缩、inline sourcemap、构建完退出）
if (!noBuild) {
  const r = spawn(process.execPath, ['esbuild.config.mjs', 'once'], {
    stdio: 'inherit',
    env: { ...process.env, BZ_VAULT_DIR: PLUGIN_DIR },
  });
  if (r.exitCode !== 0) {
    console.error('✗ 构建失败，不重启');
    process.exit(r.exitCode ?? 1);
  }
}

// 2) styles.css → snippet（CSS 改动免重启的通道）
fs.mkdirSync(SNIPPETS, { recursive: true });
const cssSrc = path.join(process.cwd(), 'styles.css');
if (fs.existsSync(cssSrc)) {
  fs.copyFileSync(cssSrc, path.join(SNIPPETS, 'bz-dev.css'));
  console.log('✓ styles.css → snippets/bz-dev.css');
  const apPath = path.join(VAULT, '.obsidian', 'appearance.json');
  let ap = {};
  try { ap = JSON.parse(fs.readFileSync(apPath, 'utf8')); } catch { /* 新库没有就算了 */ }
  const on = new Set(ap.enabledCssSnippets || []);
  on.add('bz-dev');
  ap.enabledCssSnippets = [...on];
  fs.writeFileSync(apPath, JSON.stringify(ap, null, 2));
  console.log('✓ snippet bz-dev 已启用');
}

// 3) 重启 Obsidian 直开目标库
try {
  sh('taskkill /IM Obsidian.exe /F >nul 2>&1');
  await new Promise((r) => setTimeout(r, 1200));
} catch { /* 本来就没开着 */ }
const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}`;
spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
console.log(`✓ Obsidian 重启 → ${vaultName}`);
