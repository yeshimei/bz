// scripts/push-assets.mjs — 分发仓库镜像推送（2026-10-28 拆分 downloads/，ADR-0269）
//
// 主仓 `yeshimei/bz` 的 `.git` 已 284 MB，**超过 jsDelivr 的 50 MB 包上限**——它对
// 主仓里任何没被缓存过的文件一律回 `HTTP 403 · Package size exceeded`；而国内无代理时
// `raw.githubusercontent.com` 又不通。两条通道同时死掉，插件端下载功能等于没有。
//
// 解法：把「客户端要下载的那点东西」搬进独立小仓库 `yeshimei/bz-assets`（约 14 MB），
// jsDelivr 立刻恢复服务（裸网实测 200，约 0.9 s）。主仓仍是**产物唯一的产出地**，
// 这个仓库只是逐字镜像，删掉重建没有任何副作用。
//
// 推送内容：
//   downloads/**             ← 主仓 downloads/ 逐字镜像（手册/更新日志/皮肤/目录包/清单/指针）
//   releases/<tag>/          ← 插件本体三件套（manifest.json / main.js / styles.css）
//                              只留最近 RELEASES_KEEP 份：jsDelivr 看的是**当前快照**体积，
//                              历史版本对客户端没有价值（指针只会指向最新那份）。
//
// 体积守卫：`.git` 超过 SQUASH_AT_BYTES 就压成单提交历史再强推。否则每次发布多几十 MB
// 历史，早晚重新撞上 50 MB 上限——而那个失败是「下载全挂」，不是慢慢变差。
//
// CDN 刷新：推送后按本次变更逐个清 jsDelivr 的 `@master` 缓存，再核对一次边缘清单。
// 不清的症状不是 404，而是清单里的 sha256 还是上一版 —— 客户端每一项下载都校验失败。
//
// 发布顺序：manifest → **build** → push-assets → 打 tag。
//   （清单由 manifest 出、main.js 由 build 出，两者都要在推送前就位）
//
// 用法：
//   node scripts/push-assets.mjs               # 同步 + 提交 + 推送
//   node scripts/push-assets.mjs --dry-run     # 只算差异，不动仓库、不推送
//   node scripts/push-assets.mjs --no-push     # 本地提交，不推送（排查用）
//   node scripts/push-assets.mjs --force-squash# 无条件压平历史
//   node scripts/push-assets.mjs --re-purge    # 强制重清 CDN 全量缓存（无变更也清）
//
// 目标目录：`<主仓同级>/bz-assets`，可用环境变量 BZ_ASSETS_DIR 覆盖。
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const NO_PUSH = process.argv.includes('--no-push');
const FORCE_SQUASH = process.argv.includes('--force-squash');
/** 强制重清 CDN 全量缓存（不管本次有没有变更）——jsDelivr 缓存逐 POP 各自为政，
 *  「没有变更就跳过清缓存」会让「再跑一次」这句提示自相矛盾（重跑时无变更，照样不清）。 */
const RE_PURGE = process.argv.includes('--re-purge');
/** 只做「上传 GitHub Release 资产」一步（tag 打完之后补跑用；幂等，--clobber 覆盖） */
const UPLOAD_ONLY = process.argv.includes('--upload-only');
/** 跳过 Release 上传（排查分发仓问题时用；默认会尝试传） */
const NO_UPLOAD = process.argv.includes('--no-upload');

/** 一个分发仓库最多留几份发布（客户端只会指向最新那份，旧的是给「指针还没更新就断网」的人兜底） */
const RELEASES_KEEP = 3;
/** `.git` 超过这个体积就压平历史（jsDelivr 上限 50 MB，留一半余量给文件本身） */
const SQUASH_AT_BYTES = 25 * 1024 * 1024;

const BUNDLE_FILES = ['manifest.json', 'main.js', 'styles.css'];

/** 分发仓库 slug：从 src/core/remote-base.ts 读，**不在脚本里另写一份**——
 *  两处各写一份字面量的结果一定是某天只改了一处，客户端去拉一个不存在的仓库。 */
function assetsSlug() {
  const src = fs.readFileSync(path.join(ROOT, 'src/core/remote-base.ts'), 'utf8');
  const m = /export const ASSETS_SLUG = '([^']+)'/.exec(src);
  if (!m) {
    console.error('src/core/remote-base.ts 里找不到 ASSETS_SLUG —— 先修好它再发布');
    process.exit(1);
  }
  return m[1];
}

const SLUG = assetsSlug();
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
 * 上传失败**不算发布失败**（raw/jsDelivr 兜底通道照常工作），但要大声说出来——
 * 那是「这版发布拿不到计数」的唯一线索。
 */
async function uploadReleaseAssets(tag, { fromTag }) {
  if (NO_UPLOAD || DRY) {
    log('跳过 Release 资产上传（--no-upload / --dry-run）');
    return;
  }
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
  let files = [];
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = `${prefix}${e.name}`;
      if (e.isDirectory()) walk(abs, `${rel}/`);
      else files.push({ rel, abs });
    }
  };
  const downloadsMirror = path.join(TARGET, 'downloads');
  if (fs.existsSync(downloadsMirror)) {
    walk(downloadsMirror, 'downloads/');
    // 皮肤只发整包（skins.zip），单个 css 不上 Release：旧客户端不知道 Release 通道
    // （走 raw/jsDelivr，镜像照旧）；新客户端走 skinsPack；回落逐文件时 Release 404
    // 只是跳过、接着试 raw/jsDelivr。省 26 个资产，列表干净一截。
    files = files.filter((f) => !f.rel.startsWith('downloads/skins/'));
  }
  else if (UPLOAD_ONLY) {
    console.error('分发仓没有 downloads/——先跑一次完整 push-assets 同步');
    process.exit(1);
  }
  for (const f of BUNDLE_FILES) {
    const tmp = path.join(TARGET, '.release-upload', f);
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
  const stageDir = path.join(TARGET, '.release-upload');
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
    console.error(`\n⚠ Release 资产上传失败（不影响 raw/jsDelivr 通道，但这版拿不到下载计数）：`);
    console.error(String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-8).join('\n'));
  } finally {
    fs.rmSync(path.join(TARGET, '.release-upload'), { recursive: true, force: true });
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
  // GitHub 侧：仓库不存在就建（public —— jsDelivr 只服务公开仓库）
  if (!DRY) {
    try {
      execFileSync('gh', ['repo', 'view', SLUG], { stdio: 'ignore' });
    } catch {
      log(`GitHub 上没有 ${SLUG}，创建空仓库`);
      execFileSync('gh', ['repo', 'create', SLUG, '--public', '--description', 'bz 分发镜像：downloads/ 与 releases/<tag>（jsDelivr 取用）'], {
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

/** 历史压平（`.git` 太大就做；jsDelivr 只看当前快照，历史对这个仓库没有价值） */
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

/**
 * 主动清 jsDelivr 的 `@master` 缓存（按本次真正变了的文件逐个清）。
 *
 * 不清会怎样：jsDelivr 对 `@master` 的缓存按小时到天算，推完它可能还在发**上一版**的
 * `downloads/manifest.json`。用户端看到的不是「404」，而是清单里的 sha256 与产物不是同一版——
 * 每一项下载都以校验失败收场（2026-10-31 报障：工具改名后引导页仍显示旧名字，下载行全红）。
 * 清单和它指向的产物必须一起换，所以按变更清单清，而不是只清清单一个。
 *
 * 清缓存失败不算发布失败（内容已经推上去了，边缘自己也会过期），但要说出来——
 * 那是「用户今天可能还看不到新版」的唯一线索。
 *
 * `--re-purge`：不管本次有没有变更，把 downloads/ 全量清一遍。原因：jsDelivr 的缓存
 * **逐 POP 各自为政**——清掉的只是回源时打到的那台边缘，用户机器可能落在另一台还拿着
 * 旧副本的边缘上（2026-10-31 实测：gcore 边缘发新版清单 + 旧版正文，fastly 整套旧）。
 * 而「没有变更就跳过清缓存」会让「过几分钟重跑本脚本再清一次」这句提示自相矛盾——
 * 重跑时没有变更，照样什么都不清。
 */
async function purgeCdn(changed) {
  const changedFiles = changed.filter((p) => p.startsWith('downloads/') && fs.existsSync(path.join(TARGET, p)));
  let files = changedFiles;
  if (RE_PURGE) {
    // 全量：downloads/ 下所有文件（逐个清，别漏子目录里的皮肤与工具包）
    const walk = (dir, prefix) => {
      const out = [];
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = `${prefix}${e.name}`;
        if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), `${rel}/`));
        else out.push(rel);
      }
      return out;
    };
    const dl = path.join(TARGET, 'downloads');
    if (fs.existsSync(dl)) files = walk(dl, 'downloads/');
    log(`--re-purge：全量清 ${files.length} 个文件（本次变更 ${changedFiles.length} 个）`);
  }
  if (!files.length) {
    log('没有 downloads/ 变更，跳过清缓存（要强制重清用 --re-purge）');
    return;
  }
  if (DRY || NO_PUSH) {
    log(`跳过清缓存（${files.length} 个文件）`);
    return;
  }
  let ok = 0;
  for (const rel of files) {
    try {
      const res = await fetch(`https://purge.jsdelivr.net/gh/${SLUG}@master/${rel}`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) ok++;
      else log(`清缓存失败 ${rel}（HTTP ${res.status}）——边缘可能还在发旧内容`);
    } catch (e) {
      log(`清缓存失败 ${rel}（${(e && e.message) || e}）——边缘可能还在发旧内容`);
    }
  }
  log(`已清 jsDelivr 缓存：${ok}/${files.length} 个文件`);
  await verifyManifest();
}

/** 清完缓存核对一次：边缘拿到的清单必须与本地逐字一致，否则客户端会拿到旧 hash */
async function verifyManifest() {
  const want = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'downloads/manifest.json'), 'utf8')).digest('hex');
  /* 逐边缘核对：jsDelivr 的缓存逐 POP 各自为政，只验一个边缘等于没验
   * （2026-10-31 实测：fastly 整套旧、gcore 清单新正文旧，两个边缘状态完全不同）。 */
  const edges = ['fastly.jsdelivr.net', 'gcore.jsdelivr.net', 'testingcf.jsdelivr.net', 'cdn.jsdelivr.net'];
  let stale = 0;
  for (const host of edges) {
    try {
      const res = await fetch(`https://${host}/gh/${SLUG}@master/downloads/manifest.json`, {
        signal: AbortSignal.timeout(20000),
      });
      const got = createHash('sha256').update(await res.text()).digest('hex');
      if (got === want) {
        log(`${host} 清单已刷新 ✓`);
      } else {
        stale++;
        log(`⚠ ${host} 的清单还是旧的（边缘缓存未清干净）——过几分钟再跑一次 --re-purge`);
      }
    } catch (e) {
      log(`⚠ ${host} 核对没成功（${(e && e.message) || e}）——连不上这条边缘，不影响已推送的内容`);
    }
  }
  if (stale) log(`⚠ ${stale} 个边缘还在发旧清单——用户端可能报「sha256 不匹配」，过几分钟再跑一次 --re-purge`);
}

const { version, tag } = readVersion();
console.log(`分发仓库 ${SLUG} → ${TARGET}`);
console.log(`发布 ${tag}（保留最近 ${RELEASES_KEEP} 份）`);

ensureRepo();
syncFiles(tag);
pruneReleases();
const squashed = compactIfNeeded();
const changed = commitAndPush(tag, squashed);
await purgeCdn(changed);

const base = `https://fastly.jsdelivr.net/gh/${SLUG}@master`;
console.log(`\n完成。客户端取用地址：`);
console.log(`  清单 ${base}/downloads/manifest.json`);
console.log(`  指针 ${base}/downloads/version.json`);
console.log(`  本体 ${base}/releases/${tag}/main.js`);
if (DRY) console.log('\n（dry-run：以上都没真的写盘、没推送）');

// Release 资产上传（源码主仓）——2026-10-31 发现这步定义了却没接进主流程，v1.37.0 首发资产因此漏传。
// 必须在 syncFiles 之后：三件套取分发仓 releases/<tag>/ 里 tag 冻结的那份。
await uploadReleaseAssets(tag, { fromTag: readBundleFromTag(tag) });
