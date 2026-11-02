// scripts/push-assets.mjs — 分发仓库镜像推送（2026-10-28 建，ADR-0269；**2026-11-02 退役**）
//
// ⚠ **本脚本已退出发布流程，平时不要跑。** 保留它只为「需要手工重建那个仓库」这一种场景。
//   唯一还在流程里的用法是 `--upload-only`：它不碰分发仓，只往**源码仓 Release** 补传
//   `downloads/` 那批资产（create-draft 建完草稿后调它）。这条与分发仓无关，别一起删。
//
// 它的来历：主仓 `yeshimei/bz` 的 `.git` 已 284 MB，超过 jsDelivr 的 50 MB 包上限，于是把
// 客户端要下载的那点东西（`downloads/` 与每版三件套）搬到独立小仓库
// `yeshimei/bz-assets`（约 14 MB），交给 jsDelivr 分发。
//
// 为什么退役（2026-11-02 用户拍板）：
//  - jsDelivr 已经整条退场（缓存清不掉、四条边缘各发一版，见 core/remote-base 文件头），
//    而它是这个仓库唯一存在过的理由；
//  - 新客户端的通道链只有 Release 与码云 raw，离线包直接打自主仓 `downloads/`，
//    唯一还指着它的 HTML 反代分支随 `downloads/` 里的 html 资产一起没了；
//  - 后续版本全部依赖码云 Release，这里再镜像一遍只是白占带宽与维护面。
//
// 仓库本体**不删也不动**：≤1.39.x 老客户端的 jsDelivr 备链里还有它，冻结在原地，让那批人
// 至少还能拿到滞后的副本。所以 `finalize` 不再调用本脚本，七步里的 assets 步也改成纯自检。
//
// 推送内容（仅在手工重建时）：
//   downloads/**             ← 主仓 downloads/ 逐字镜像（皮肤/目录包/清单/指针）
//   releases/<tag>/          ← 插件本体三件套（manifest.json / main.js / styles.css）
//                              只留最近 RELEASES_KEEP 份：指针只会指向最新那份，
//                              历史版本对客户端没有价值。
//
// 体积守卫：`.git` 超过 SQUASH_AT_BYTES 就压成单提交历史再强推。否则每次发布多几十 MB
// 历史，早晚重新撞上 50 MB 上限——而那个失败是「下载全挂」，不是慢慢变差。
//
// ⚠ 唯一硬约束还在：**只镜像已转正的 Release**（2026-11-02 v1.40.0 事故后钉死）。
//   本脚本动手之前先过顺序闸（`release-gate.mjs` 的 enforceReleaseOrder）——`gh release view
//   <tag>` 回来不是 draft 才许推。`--stage-only` 是唯一不过这道闸的模式，且它什么都不推、
//   也不写分发仓，只做备料自检。
//
// 用法：
//   node scripts/push-assets.mjs                 # 镜像 + 推送（要求 Release 已转正）
//   node scripts/push-assets.mjs --stage-only    # 只本地暂存，不推、不传资产
//   node scripts/push-assets.mjs --dry-run       # 只算差异，不动仓库、不推送
//   node scripts/push-assets.mjs --no-push       # 本地提交，不推送（排查用）
//   node scripts/push-assets.mjs --force-squash  # 无条件压平历史
//
// 目标目录：`<主仓同级>/bz-assets`，可用环境变量 BZ_ASSETS_DIR 覆盖。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { enforceGate, enforceReleaseOrder } from './release-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const NO_PUSH = process.argv.includes('--no-push');
const FORCE_SQUASH = process.argv.includes('--force-squash');
/** 只做「上传 GitHub Release 资产」一步（tag 打完之后补跑用；幂等，--clobber 覆盖） */
const UPLOAD_ONLY = process.argv.includes('--upload-only');
/** 只跳过 Release 上传（排查分发仓问题时用；默认会尝试传） */
const NO_UPLOAD = process.argv.includes('--no-upload');
/** 只做备料自检：**不写分发仓、不推远端、不清缓存、不传资产**，只回答「这版要镜像的东西齐不齐」。
 *  给七步用——七步跑在打 tag 之前，那时候对外推就是「Release 还不存在的半成品」。 */
const STAGE_ONLY = process.argv.includes('--stage-only');

/** 一个分发仓库最多留几份发布（客户端只会指向最新那份，旧的是给「指针还没更新就断网」的人兜底） */
const RELEASES_KEEP = 3;
/** `.git` 超过这个体积就压平历史（这个仓库只有快照与最近三份，历史没有留存价值） */
const SQUASH_AT_BYTES = 25 * 1024 * 1024;

const BUNDLE_FILES = ['manifest.json', 'main.js', 'styles.css'];

/** 扁平化暂存目录（Release 资产名要 `downloads-manifest.json` 这种形状，`gh release upload`
 *  只认 basename，所以先在这里摆一份）。放**主仓根**而不是分发仓：分发仓只放要对外镜像的
 *  成品，临时件混进去就会被提交（v1.40.0 那次 `.release-upload/*` 十几个文件就是这么进库的）。 */
const STAGE_DIR = path.join(ROOT, '.release-upload');

/** 分发仓库 slug：**写死在这里**（2026-11-02 退役之后）。
 *
 *  它曾经从 `src/core/remote-base.ts` 的 `ASSETS_SLUG` 读，理由是「两处各写一份，某天
 *  只会改一处」。现在客户端代码里已经没有任何地方引用这个仓库（那个常量随 HTML 反代分支
 *  一起删了），这个脚本是唯一还知道它的人——事实源只剩一份，就在下面。 */
const SLUG = 'yeshimei/bz-assets';
/** 源码主仓 slug（Release 开在这里——下载计数、tag 冻结都归它，见 uploadReleaseAssets） */
function sourceSlug() {
  const src = fs.readFileSync(path.join(ROOT, 'src/core/remote-base.ts'), 'utf8');
  const m = /export const REPO_SLUG = '([^']+)'/.exec(src);
  if (!m) {
    console.error('src/core/remote-base.ts 里找不到 REPO_SLUG —— 先修好它再发布');
    process.exit(1);
  }
  return m[1];
}
const SOURCE_SLUG = sourceSlug();
const TARGET = path.resolve(process.env.BZ_ASSETS_DIR || path.join(ROOT, '..', 'bz-assets'));
const REMOTE = `https://github.com/${SLUG}.git`;

function log(msg) {
  console.log(DRY ? `[dry] ${msg}` : msg);
}

/** 跑一条 git/gh（失败即退出，输出末尾 8 行便于定位） */
function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { cwd: TARGET, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
  } catch (e) {
    console.error(`\n${cmd} ${args.join(' ')} 失败：`);
    console.error(String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
}

/** 目录体积（字节；跳过 .git 由调用方决定） */
function sizeOf(dir, { skipGit = false } = {}) {
  let total = 0;
  const walk = (p) => {
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) {
        if (skipGit && p === dir && name === '.git') continue;
        walk(path.join(p, name));
      }
    } else if (st.isFile()) {
      total += st.size;
    }
  };
  walk(dir);
  return total;
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** 版本：主仓 manifest.json 的 version（= 插件本体版本），tag 由它推出 */
function readVersion() {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const version = String(mf.version || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`manifest.json 的 version 不合法：${JSON.stringify(mf.version)}`);
    process.exit(1);
  }
  return { version, tag: `v${version}` };
}

/**
 * 上传 GitHub Release 资产（2026-10-31 新增：Release 是客户端的**主下载通道**，
 * 见 src/core/remote-base.ts 的 releaseDownloadUrl——按 tag 冻结 + 自带下载计数）。
 *
 * 上传清单：
 *   downloads/** 逐字平铺（资产名保留相对路径，GitHub 支持带斜杠的资产名）
 *   三件套（main.js / manifest.json / styles.css，平铺在 Release 根）
 *
 * 时序：发布流程里本脚本跑在**打 tag 之前**，那时 Release 还不存在——正常跳过并提示，
 * 打完 tag 后 `node scripts/push-assets.mjs --upload-only` 补跑。Release 已存在时
 * --clobber 覆盖（同名资产更新为同内容，幂等）。
 *
 * 上传失败**不算发布失败**（raw / 分发镜像 兜底通道照常工作），但要大声说出来——
 * 那是「这版发布拿不到计数」的唯一线索。
 */
async function uploadReleaseAssets(tag, { fromTag }) {
  if (NO_UPLOAD || DRY) {
    log('跳过 Release 资产上传（--no-upload / --dry-run）');
    return;
  }
  // 第二道闸（2026-11-02 立）：上传之前必须让用户看过 note 全文与资产清单，并明确说
  // 「发布」。贴卡这件事原先只写在 skill 里，靠记性维持——v1.40.0 那次一路挂到 draft
  // 才想起来，所以钉成代码：没放行就不传，一个字节都不上 GitHub。
  enforceGate('publish', ROOT, tag.replace(/^v/, ''));
  // Release 存在于**源码主仓**（REPO_SLUG），不是分发镜像仓
  let exists = true;
  try {
    execFileSync('gh', ['release', 'view', tag, '-R', `https://github.com/${SOURCE_SLUG}`], { stdio: 'ignore' });
  } catch {
    exists = false;
  }
  if (!exists) {
    if (UPLOAD_ONLY) {
      console.error(`Release ${tag} 不存在（tag 还没打？）——先走完发布流程，再补跑本命令`);
      process.exit(1);
    }
    log(`Release ${tag} 还不存在（发布顺序：本脚本 → 打 tag）——打完 tag 后补跑 node scripts/push-assets.mjs --upload-only`);
    return;
  }

  // 收集待传文件：downloads/** 全部 + 三件套（三件套来源与 syncFiles 同口径：tag 里那份优先）
  //
  // 源目录是**主仓 downloads/**，不是分发仓的镜像（2026-11-02 改）。原来读镜像，等于
  // create-draft 依赖「镜像已经先推上去」——而镜像现在被顺序闸拦在 Release 之后，
  // 两者互为前置就成了死结（v1.40.0 那次顺序错乱正源于此）。主仓 downloads/ 才是唯一
  // 产出地，镜像只是它的副本。
  let files = [];
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = `${prefix}${e.name}`;
      if (e.isDirectory()) walk(abs, `${rel}/`);
      else files.push({ rel, abs });
    }
  };
  const downloadsSrc = path.join(ROOT, 'downloads');
  if (fs.existsSync(downloadsSrc)) {
    walk(downloadsSrc, 'downloads/');
    // 皮肤只发整包（skins.zip），单个 css 不上 Release：旧客户端不知道 Release 通道
    // （走 raw / 分发镜像）；新客户端走 skinsPack；回落逐文件时 Release 404
    // 只是跳过、接着试 raw / 分发镜像。省 26 个资产，列表干净一截。
    files = files.filter((f) => !f.rel.startsWith('downloads/skins/'));
  } else if (UPLOAD_ONLY) {
    console.error('主仓没有 downloads/——先跑 release-steps 把在线资源出齐');
    process.exit(1);
  }
  for (const f of BUNDLE_FILES) {
    const tmp = path.join(STAGE_DIR, f);
    if (fromTag?.[f]) {
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      fs.writeFileSync(tmp, fromTag[f]);
      files.push({ rel: f, abs: tmp });
    } else {
      const abs = path.join(ROOT, f);
      if (!fs.existsSync(abs)) {
        console.error(`缺 ${f}：Release 资产传不全——先跑构建`);
        process.exit(1);
      }
      files.push({ rel: f, abs });
    }
  }

  // 资产名扁平化（2026-10-31 立，review #1）：`gh release upload` **只取文件 basename**，
  // 造不出带斜杠的资产名（GitHub 网页/API 支持，gh 不支持）。照仓库路径传上去，
  // `downloads/manifest.json` 会落成 `manifest.json`，与三件套那份撞名（422——v1.37.0 首发
  // 就是这么翻的车）；而客户端 Release 通道请求的偏偏是带 `downloads/` 前缀的地址。
  // 两端统一扁平名才对得上：本侧按同一规则暂存后再传，客户端侧见
  // remote-base.releaseDownloadUrl 的 `/` → `-` 映射。
  const flatAssetName = (rel) => String(rel).replace(/^\/+/, '').replace(/\//g, '-');
  const stageDir = STAGE_DIR;
  const toUpload = files.map((f) => {
    const asset = flatAssetName(f.rel);
    if (path.basename(f.abs) === asset) return String(f.abs);
    const tmp = path.join(stageDir, asset);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.copyFileSync(f.abs, tmp);
    return tmp;
  });

  log(`上传 Release 资产 ${toUpload.length} 个（--clobber）`);
  if (NO_PUSH) {
    log('跳过（--no-push）');
    return;
  }
  const args = ['release', 'upload', tag, '-R', `https://github.com/${SOURCE_SLUG}`, '--clobber', ...toUpload];
  try {
    execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    log(`Release 资产已上传：https://github.com/${SOURCE_SLUG}/releases/tag/${tag}`);
  } catch (e) {
    console.error(`\n⚠ Release 资产上传失败（不影响 raw / 分发镜像 通道，但这版拿不到下载计数）：`);
    console.error(String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-8).join('\n'));
  } finally {
    fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  }
}

/** 版本号比较（只用于给 releases/ 排序，够用就行） */
function cmpVersion(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

/** 仓库就位：目录、git、远端、GitHub 侧存在性 */
function ensureRepo() {
  if (!fs.existsSync(path.join(TARGET, '.git'))) {
    log(`初始化分发仓库目录 ${TARGET}`);
    if (DRY) return;
    fs.mkdirSync(TARGET, { recursive: true });
    run('git', ['init', '-b', 'master']);
    run('git', ['remote', 'add', 'origin', REMOTE]);
  }
  // GitHub 侧：仓库不存在就建（public —— 离线包 / gh-proxy 兜底要匿名可读）
  if (!DRY) {
    try {
      execFileSync('gh', ['repo', 'view', SLUG], { stdio: 'ignore' });
    } catch {
      log(`GitHub 上没有 ${SLUG}，创建空仓库`);
      execFileSync('gh', ['repo', 'create', SLUG, '--public', '--description', 'bz 分发镜像：downloads/ 与 releases/<tag>（gh-proxy 兜底 / 离线包内容源）'], {
        stdio: 'inherit',
      });
    }
  }
}

/**
 * 主仓产物 → 分发仓库（downloads 整体替换；releases/<tag> 三件套）
 *
 * 三件套的来源：**tag 里那份**，不是工作区（2026-10-31 改）。
 * 为什么：已发布的版本必须冻结在 tag。工作区会一直往前走（别的流程在改代码、构建产物
 * 跟着重出），拿工作区的三件套去填 releases/v1.36.0/，装到的就是「v1.36.0 的 main.js +
 * 之后某版的工作区 styles.css」的混版——2026-10-31 就这么翻的车（dev-flows 那条流程
 * 的样式跟着进了 v1.36.0 的发布目录）。tag 还没有时（新版本准备中）才退回工作区。
 */
function syncFiles(tag) {
  const srcDl = path.join(ROOT, 'downloads');
  const dstDl = path.join(TARGET, 'downloads');
  log(`镜像 downloads/（${mb(sizeOf(srcDl))}）`);
  if (!DRY) {
    fs.rmSync(dstDl, { recursive: true, force: true });
    fs.cpSync(srcDl, dstDl, { recursive: true });
  }

  const dstRel = path.join(TARGET, 'releases', tag);
  log(`镜像 ${tag} 三件套`);
  const fromTag = readBundleFromTag(tag);
  if (fromTag) {
    log(`三件套取自 ${tag}（已发布的版本冻结在 tag，不受工作区后续改动影响）`);
  } else {
    log(`${tag} 还不存在——三件套取自工作区（发版前要先打 tag）`);
  }
  if (!DRY) {
    fs.rmSync(dstRel, { recursive: true, force: true });
    fs.mkdirSync(dstRel, { recursive: true });
    for (const f of BUNDLE_FILES) {
      if (fromTag && fromTag[f]) {
        fs.writeFileSync(path.join(dstRel, f), fromTag[f]);
        continue;
      }
      const from = path.join(ROOT, f);
      if (!fs.existsSync(from)) {
        console.error(`缺 ${f}：先跑 pnpm run build（三件套要在推送前就位）`);
        process.exit(1);
      }
      fs.cpSync(from, path.join(dstRel, f));
    }
  }
  return fromTag;
}

/**
 * 从 tag 取三件套字节 → { main.js, manifest.json, styles.css }。
 * tag 不存在 / tag 里缺某件 → 返回 null（调用方退回工作区）。
 */
function readBundleFromTag(tag) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
  } catch {
    return null;
  }
  const out = {};
  for (const f of BUNDLE_FILES) {
    try {
      out[f] = execFileSync('git', ['show', `${tag}:${f}`], {
        cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer',
      });
    } catch {
      return null; // tag 里缺件（极少）→ 整体退回工作区
    }
  }
  return out;
}

/** 只留最近 N 份发布 */
function pruneReleases() {
  const dir = path.join(TARGET, 'releases');
  if (!fs.existsSync(dir)) return;
  const all = fs
    .readdirSync(dir)
    .filter((n) => /^v\d+\.\d+\.\d+$/.test(n) && fs.statSync(path.join(dir, n)).isDirectory())
    .sort(cmpVersion)
    .reverse();
  for (const old of all.slice(RELEASES_KEEP)) {
    log(`删旧发布 ${old}`);
    if (!DRY) fs.rmSync(path.join(dir, old), { recursive: true, force: true });
  }
}

/** 历史压平（`.git` 太大就做；这个仓库只有快照与最近三份，历史没有留存价值） */
function compactIfNeeded() {
  const gitSize = sizeOf(path.join(TARGET, '.git'));
  const snapshot = sizeOf(TARGET, { skipGit: true });
  log(`仓库体积：快照 ${mb(snapshot)} · 历史 ${mb(gitSize)}`);
  if (!FORCE_SQUASH && gitSize < SQUASH_AT_BYTES) return false;
  log('历史过大 → 压成单提交（force push）');
  if (!DRY) {
    run('git', ['checkout', '--orphan', 'dist-squash']);
    run('git', ['add', '-A']);
    run('git', ['commit', '-m', 'dist: 快照（历史已压平）']);
    run('git', ['branch', '-M', 'master']);
  }
  return true;
}

/** 提交 + 推送；返回本次提交里变化的路径（清 CDN 缓存只清这些） */
function commitAndPush(tag, squashed) {
  const status = DRY ? '' : run('git', ['status', '--porcelain']);
  const msg = `release: ${tag} 资源镜像`;
  if (status) {
    log(`提交 ${status.split('\n').length} 处变更`);
    if (!DRY) {
      run('git', ['add', '-A']);
      // `git status` 按 stat 缓存判断，内容其实一致时也会报「已修改」；add 之后
      // 再问一次——真没差异就别提交，否则 git commit 以 nothing to commit 失败、
      // run() 直接 exit(1)，把后面的 CDN 清理与 Release 资产上传整段带走。
      const staged = run('git', ['diff', '--cached', '--name-only']).trim();
      if (!staged) {
        log('内容无实际变化（status 误报），跳过提交');
        return [];
      }
      run('git', ['commit', '-m', msg]);
    }
  } else {
    log('内容与远端一致，没有新提交');
  }
  if (NO_PUSH || DRY) {
    log('跳过推送（--dry-run / --no-push）');
    return [];
  }
  if (squashed) run('git', ['push', '-f', 'origin', 'master']);
  else run('git', ['push', '-u', 'origin', 'master']);
  return status
    ? status
        .split('\n')
        .map((l) => l.slice(3).trim().replace(/^.* -> /, ''))
        .filter(Boolean)
    : [];
}

const { version, tag } = readVersion();
console.log(`分发仓库 ${SLUG} → ${TARGET}`);
console.log(`发布 ${tag}（保留最近 ${RELEASES_KEEP} 份）`);

/* --stage-only：备料自检（2026-11-02 改）。
 *
 * 原本它还会把镜像目录摆好；现在**不碰分发仓一个字**——七步跑在打 tag 之前，本地镜像
 * 一旦先进了半成品，就等着谁手一抖 `git push`（v1.40.0 的镜像工作区里就是这么躺着
 * 一整套 1.40.0 的）。这里只回答两个问题：这版要镜像的东西齐不齐、Release 转正了没有。 */
if (STAGE_ONLY) {
  const order = enforceReleaseOrder(tag, SOURCE_SLUG, { what: '分发仓库', allowUnpublished: true });
  const dl = path.join(ROOT, 'downloads');
  if (!fs.existsSync(dl)) {
    console.error('[push-assets] ✗ 主仓没有 downloads/——先跑 release-steps 把在线资源出齐');
    process.exit(1);
  }
  let n = 0;
  const count = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) count(path.join(dir, e.name));
      else n++;
    }
  };
  count(dl);
  const bundle = BUNDLE_FILES.map((f) => {
    const abs = path.join(ROOT, f);
    return fs.existsSync(abs) ? `${f} ${mb(fs.statSync(abs).size)}` : `${f} 缺件`;
  });
  console.log(`\n[push-assets] 暂存自检：downloads/ ${n} 个文件 ${mb(sizeOf(dl))}`);
  console.log(`  三件套：${bundle.join(' · ')}`);
  console.log(`  Release ${tag}：${order.ok ? '已转正' : `未发布（${order.reason}）`}`);
  console.log('  七步到此为止，不推任何东西。镜像与码云都等 finalize 转正之后由 release-gate 触发。');
  process.exit(0);
}

/* 顺序闸（2026-11-02 立，v1.40.0 事故后钉死）：分发仓是客户端主通道，只许镜像**已转正**的
 * Release。判据只有一条——`gh release view <tag>` 回来不是 draft；不 ok 直接 exit(3)，
 * 一个字节都不推。 */

/* `--upload-only`：只往 draft Release 补传 assets，分发仓一个字节都不动。
 * 2026-11-02 v1.39.2 踩到：这个开关原先只跳过下面两道闸，syncFiles / commitAndPush 照跑
 * ——等于 Release 还是 draft 时就把镜像指针推到新版，正是顺序闸要防的那件事，
 * 而且闸被绕过后没人会看见。方向本来就相反，就地返回。 */
if (UPLOAD_ONLY) {
  await uploadReleaseAssets(tag, { fromTag: readBundleFromTag(tag) });
  process.exit(0);
}

enforceReleaseOrder(tag, SOURCE_SLUG, { what: '分发仓库' });

/* 顺带钉住「三件套只能取自 tag」：Release 已转正却没有本地 tag，说明这台机器没拉 tag——
 * 那就只剩「拿工作区凑」这一条路，装到的就是混版三件套（v1.36.0 翻过一次车）。
 * 宁可停下让人 git fetch --tags，也不许拿工作区产物冒充某个已发布版本。 */
if (!readBundleFromTag(tag)) {
  console.error(`[push-assets] ✗ 本地没有 ${tag} 这个 tag：镜像里的三件套必须取自 tag（已发布版本冻结在 tag）。`);
  console.error(`  git fetch --tags 之后再跑；不许拿工作区产物当已发布版本。`);
  process.exit(1);
}

ensureRepo();
syncFiles(tag);
pruneReleases();
const squashed = compactIfNeeded();
commitAndPush(tag, squashed);

/* 镜像只是「老版本客户端与 gh-proxy 的兜底」——2026-11-02 起客户端主备两通道都取
 * GitHub / 码云 的 Release 资产，这里不再打印「客户端取用地址」，免得下次发布照着它排错。 */
console.log(`\n分发仓已镜像（${SLUG}@master）：给老客户端与 gh-proxy 兜底用，不是当前客户端的下载通道。`);
if (DRY) console.log('\n（dry-run：以上都没真的写盘、没推送）');

// Release 资产上传（源码主仓）——2026-10-31 发现这步定义了却没接进主流程，v1.37.0 首发资产因此漏传。
// 三件套优先取 tag 冻结的那份（与 syncFiles 同口径）。
await uploadReleaseAssets(tag, { fromTag: readBundleFromTag(tag) });
