#!/usr/bin/env node
// scripts/push-gitee.mjs — 码云（Gitee）镜像：Release 页 + 资产 + 仓库描述
//
// 为什么有这一步：GitHub 在国内裸网时常连不上（Release 直下、API 一起挂），码云是同一份
// 内容的第二个出口。代码与 tag 由 git 双推负责（origin 挂了第二条 pushurl，`git push origin`
// 会同时推两处，见 AGENTS.md「提交」节）；git 管不到的三件由本脚本做：
//   1. Release 页（标题 / 正文 = docs/note-<tag>.md）
//   2. Release 资产（与 GitHub 同一批 17 个，命名同样扁平化）
//   3. 仓库描述（可选，--desc）
//
// 用法：
//   node scripts/push-gitee.mjs                 # 当前版本 Release + 资产（默认）
//   node scripts/push-gitee.mjs --code          # 只补推代码与当前 tag（双推失败时用）
//   node scripts/push-gitee.mjs --force         # 已存在的同名附件也重传（否则跳过）
//   node scripts/push-gitee.mjs --desc="…"      # 顺手同步仓库描述
//   node scripts/push-gitee.mjs --dry-run       # 只打印将要做的事
//
// token：~/.gitee-token（一行纯令牌）或环境变量 GITEE_TOKEN，权限只需要 projects。
// **绝不写进仓库**——主仓是公开的，写进去等于把账号交出去。
//
// 顺序闸（2026-11-02 立）：本脚本只镜像**GitHub 上已经转正**的 Release（`gh release view`
// 回来不是 draft）。备份通道同样是「对外可见」，先于正本上线等于给用户一条拿到半成品的路；
// 闸在 release-gate.mjs 的 enforceReleaseOrder，不 ok 直接 exit(3)。`--code` 不受此限
// （推代码/tag 不是发布）。
//
// 已知差异（不是 bug，别硬改）：
//   - 码云没有 GitHub 的 topics 字段（v5 只有 tags_url），仓库标签只能网页加；
//   - 码云附件不能同名覆盖，重传要先 DELETE 旧附件（--force 走这条）；
//   - Release 的 assets 里永远带两个源码包（tag 的 zip/tar.gz），那不是我们的资产，
//     清单里按 browser_download_url 是否含 /releases/download/ 区分。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { enforceReleaseOrder, sourceSlug } from './release-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 码云 slug：从 src/core/remote-base.ts 读，**不在脚本里另写一份**——
 *  两处各写一份字面量的结果一定是某天只改了一处，客户端去拉一个不存在的仓库。 */
function giteeSlug() {
  const src = fs.readFileSync(path.join(ROOT, 'src/core/remote-base.ts'), 'utf8');
  const m = /export const GITEE_SLUG = '([^']+)'/.exec(src);
  if (!m) {
    console.error('src/core/remote-base.ts 里找不到 GITEE_SLUG —— 先修好它再发布');
    process.exit(1);
  }
  return m[1];
}

const [OWNER, REPO] = giteeSlug().split('/');
const API = 'https://gitee.com/api/v5';

const DRY = process.argv.includes('--dry-run');
const CODE_ONLY = process.argv.includes('--code');
const FORCE = process.argv.includes('--force');
/** 删掉 Release 上不在清单里的附件（早先逐个传过 downloads/** 的，用这个收掉） */
const PRUNE = process.argv.includes('--prune');
const DESC = (process.argv.find((a) => a.startsWith('--desc=')) || '').slice('--desc='.length);

const log = (m) => console.log(`[gitee] ${m}`);

function readToken() {
  if (process.env.GITEE_TOKEN) return process.env.GITEE_TOKEN.trim();
  const p = path.join(process.env.HOME || process.env.USERPROFILE || '', '.gitee-token');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  console.error('[gitee] 缺令牌：把码云私人令牌写进 ~/.gitee-token（一行），或设 GITEE_TOKEN');
  process.exit(1);
}

const TOKEN = readToken();

async function api(method, p, body) {
  const url = `${API}${p}${p.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** 待传资产：与 GitHub Release **同一批**（2026-11-02 起 15 个）
 *
 *  **downloads/ 那批必须发**（2026-11-02 用户拍板，反转 11-01 的「不发」）：那天码云还
 *  不在通道链里，镜像过去只是没人校验的副本；现在它是客户端的第二通道
 *  （`src/core/remote-base.ts`：GitHub Release 主 → 码云 Release 备，jsDelivr 整条退场），
 *  少一个资产就等于备用通道缺一块。
 *
 *  命名与 GitHub 完全同一套规则：`downloads/manifest.json` → `downloads-manifest.json`
 *  （见 remote-base.flatAssetName）。两端口径不一致时，客户端拿到的资产名会对不上，
 *  表现为「备用通道 404」。 */
function assetFiles(version) {
  const out = [];
  const seen = new Set();
  const add = (name, abs) => {
    if (seen.has(name)) throw new Error(`资产名撞了：${name}`);
    seen.add(name);
    out.push({ name, abs });
  };
  for (const f of [`bz-${version}.zip`, `bz-offline-${version}.zip`, 'SHA256SUMS.txt', 'main.js', 'manifest.json', 'styles.css']) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`缺 ${f}：先跑 node scripts/pack-release.mjs ${version}`);
    add(f, abs);
  }
  // downloads/**（排除单个皮肤 css：客户端只取 skins.zip 整包，与 push-assets 同口径）
  const flat = (rel) => String(rel).replace(/^\/+/, '').replace(/\//g, '-');
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = `${prefix}${e.name}`;
      if (e.isDirectory()) walk(abs, `${rel}/`);
      else if (!rel.startsWith('downloads/skins/')) add(flat(rel), abs);
    }
  };
  const dl = path.join(ROOT, 'downloads');
  if (!fs.existsSync(dl)) throw new Error('主仓没有 downloads/——先跑 release-steps 把在线资源出齐');
  walk(dl, 'downloads/');
  return out;
}

/** 我们自己传的附件。
 *
 *  **必须走 attach_files 接口**：release 详情里的 assets 是个混合列表（含码云自动挂的
 *  源码 zip/tar.gz），且那些条目**没有 id**——拿 assets 去 DELETE 会落到
 *  `attach_files/undefined` 上，返回一张 HTML 404 页。attach_files 才是"人传上去的附件"，
 *  带 id、带 size、带 uploader。 */
async function ownAssets(rel) {
  const list = await api('GET', `/repos/${OWNER}/${REPO}/releases/${rel.id}/attach_files`);
  return list || [];
}

async function ensureRelease(version, bodyFor) {
  const tag = `v${version}`;
  const list = await api('GET', `/repos/${OWNER}/${REPO}/releases?per_page=100`);
  let rel = (list || []).find((r) => r.tag_name === tag);
  const body = bodyFor();
  if (!rel) {
    log(`创建 Release ${tag}`);
    if (DRY) return null;
    rel = await api('POST', `/repos/${OWNER}/${REPO}/releases`, {
      tag_name: tag, name: `bz ${tag}`, body, target_commitish: 'master', prerelease: false,
    });
  } else if (rel.name !== `bz ${tag}` || (body && rel.body !== body)) {
    log(`更新 Release ${tag} 的标题与正文`);
    if (!DRY) rel = await api('PATCH', `/repos/${OWNER}/${REPO}/releases/${rel.id}`, { name: `bz ${tag}`, body });
  } else {
    log(`Release ${tag} 已在位（正文一致）`);
  }
  return rel;
}

async function uploadAssets(rel, version) {
  const want = assetFiles(version);
  const have = await ownAssets(rel);
  const byName = new Map(have.map((a) => [a.name, a]));
  let sent = 0;
  for (const f of want) {
    const old = byName.get(f.name);
    if (old && !FORCE) { log(`跳过已有资产 ${f.name}`); continue; }
    if (old && FORCE) {
      log(`删除旧附件 ${f.name}（#${old.id}）`);
      if (!DRY) await api('DELETE', `/repos/${OWNER}/${REPO}/releases/${rel.id}/attach_files/${old.id}`);
    }
    const bytes = fs.statSync(f.abs).size;
    log(`上传 ${f.name}（${(bytes / 1048576).toFixed(1)} MB）`);
    if (DRY) continue;
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(f.abs)]), f.name);
    const res = await fetch(
      `${API}/repos/${OWNER}/${REPO}/releases/${rel.id}/attach_files?access_token=${encodeURIComponent(TOKEN)}`,
      { method: 'POST', body: fd },
    );
    if (!res.ok) throw new Error(`上传 ${f.name} 失败：${res.status} ${(await res.text()).slice(0, 200)}`);
    sent++;
  }
  // 收尾：把不在清单里的旧附件删掉（码云不能同名覆盖，留着就是两份互相矛盾的副本）
  if (PRUNE) {
    const wantNames = new Set(want.map((f) => f.name));
    for (const a of have) {
      if (wantNames.has(a.name)) continue;
      log(`删除清单外附件 ${a.name}（#${a.id}）`);
      if (!DRY) await api('DELETE', `/repos/${OWNER}/${REPO}/releases/${rel.id}/attach_files/${a.id}`);
    }
  }
  return { want: want.length, have: have.length, sent };
}

async function pushCode(version) {
  const tag = `v${version}`;
  log(`补推代码与 ${tag} 到 gitee 远端`);
  if (DRY) return;
  execFileSync('git', ['push', 'gitee', 'master'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('git', ['push', 'gitee', `refs/tags/${tag}`], { cwd: ROOT, stdio: 'inherit' });
}

async function syncDesc() {
  if (!DESC) return;
  log(`同步仓库描述：${DESC}`);
  if (DRY) return;
  // 码云更新接口把 name 列为必填，漏了就 400「name is missing」
  await api('PATCH', `/repos/${OWNER}/${REPO}`, { name: REPO, description: DESC });
}

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
const noteFile = path.join(ROOT, 'docs', `note-v${version}.md`);
const bodyFor = () => (fs.existsSync(noteFile) ? fs.readFileSync(noteFile, 'utf8') : null);

if (CODE_ONLY) {
  await pushCode(version);
  log('完成（只推代码）');
} else {
  /* 顺序闸（2026-11-02 立）：码云是**备份通道**，但备份也不能先于正本对外可见。
   * 判据与分发仓同一条——GitHub 上 v<版本> 的 Release 已经转正（非 draft）。
   * 没有这道闸，手跑一次本脚本就能在 GitHub 还没发布时先把包挂到码云上。 */
  enforceReleaseOrder(`v${version}`, sourceSlug(ROOT), { what: '码云备份通道' });
  await pushCode(version);
  await syncDesc();
  const rel = await ensureRelease(version, bodyFor);
  if (rel) {
    const r = await uploadAssets(rel, version);
    log(`Release v${version}：应有 ${r.want} 个资产，原本 ${r.have} 个，本次上传 ${r.sent} 个`);
    log(`https://gitee.com/${OWNER}/${REPO}/releases/tag/v${version}`);
  }
}
