#!/usr/bin/env node
/**
 * 发版产物上传夸克网盘（2026-11-09 立）。
 *
 * 用途：bz / bz reader 每次发版后，把压缩包放回夸克网盘对应目录，目录里只留最新一版。
 * 依赖：只用 Node 内置能力（fetch + crypto），不装任何 npm 包。
 * 凭据：本机扫码一次得到的 cookie 文件（缺省 ~/.bz-quark-cookie），不进仓库；
 *       失效时跑 `python scripts/quark-auth.py` 重新授权。
 * 落点：网盘根目录（2026-11-09 用户改口——一个产品只有一个包，不再套文件夹）。
 *       根目录里别人的文件一律不碰，「只留最新版」只认本产品自己的包名。
 *
 * 用法：
 *   node scripts/push-quark.mjs --product=bz          # 传仓库根 bz-<版本>.zip
 *   node scripts/push-quark.mjs --product=reader      # 现场打 bz reader 三件套再传
 *   node scripts/push-quark.mjs --product=bz --dry-run
 *   node scripts/push-quark.mjs --file=some.zip --pdir=<fid>
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE = 'https://pan.quark.cn';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch';
const OSS_UA = 'aliyun-sdk-js/6.6.1 Chrome 98.0.4758.80 on Windows 10 64-bit';

/**
 * 两个产品在网盘里的落点：都放根目录（2026-11-09 用户改口——一个产品只有一个包，
 * 不值得再套一层文件夹）。`pattern` 是「只留最新版」的判据：只删本产品自己的旧包，
 * 根目录里用户的影视、备份等文件一律不碰。
 */
const PRODUCTS = {
  bz: {
    label: 'bz',
    pdir: '0',
    zip: (v) => `bz-${v}.zip`,
    pattern: /^bz-\d+\.\d+\.\d+\.zip$/,
  },
  reader: {
    label: 'bz reader',
    pdir: '0',
    zip: (v) => `bz-reader-${v}.zip`,
    pattern: /^bz-reader-\d+\.\d+\.\d+\.zip$/,
  },
};

function arg(name, fallback = undefined) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq >= 0 ? hit.slice(eq + 1) : true;
}
const flag = (name) => process.argv.includes(`--${name}`);

class Quark {
  constructor(cookie) {
    this.cookie = cookie;
  }

  async api(path, init = {}) {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        'User-Agent': UA,
        Referer: 'https://pan.quark.cn/',
        Origin: 'https://pan.quark.cn',
        Cookie: this.cookie,
        ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`接口返回非 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`);
    }
    if (json.code !== 0) {
      if (json.code === 31001) throw new Error(`登录态失效（${json.message}）：跑 python scripts/quark-auth.py 重新扫码授权`);
      throw new Error(`${path} 失败：code=${json.code} ${json.message}`);
    }
    return json;
  }

  /** 会员信息：确认登录的是本人账号 */
  async whoami() {
    return (await this.api('/1/clouddrive/member?pr=ucpro&fr=pc')).data || {};
  }

  async list(pdirFid) {
    const out = [];
    for (let page = 1; page < 50; page++) {
      const r = await this.api(
        `/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=${pdirFid}&_page=${page}&_size=100&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`,
      );
      out.push(...(r.data?.list ?? []));
      if (out.length >= (r.metadata?._total ?? 0)) break;
    }
    return out;
  }

  async remove(fids) {
    if (!fids.length) return;
    await this.api('/1/clouddrive/file/delete?pr=ucpro&fr=pc', {
      method: 'POST',
      body: JSON.stringify({ action_type: 2, exclude_fids: [], filelist: fids }),
    });
  }

  /**
   * 上传一个本地文件：预上传 → hash 秒传判定 → 分片直传（每片向 auth 换签名）→
   * 合并（XML + Content-MD5 + callback）→ finish。三个分支都以「目录里出现同名同大小文件」为准，
   * 由调用方对账。
   */
  async upload(localPath, pdirFid, fileName) {
    const size = statSync(localPath).size;
    const md5 = createHash('md5');
    const sha1 = createHash('sha1');
    for await (const chunk of createReadStream(localPath)) {
      md5.update(chunk);
      sha1.update(chunk);
    }

    const now = Date.now();
    const pre = await this.api('/1/clouddrive/file/upload/pre?pr=ucpro&fr=pc', {
      method: 'POST',
      body: JSON.stringify({
        file_name: fileName,
        size,
        pdir_fid: pdirFid,
        format_type: 'application/zip',
        ccp_hash_update: true,
        l_created_at: now,
        l_updated_at: now,
        dir_name: '',
        parallel_upload: false,
      }),
    });
    const p = pre.data;
    if (p.finish) return { fid: p.fid, size, rapid: true };

    const h = await this.api('/1/clouddrive/file/update/hash?pr=ucpro&fr=pc', {
      method: 'POST',
      body: JSON.stringify({ md5: md5.digest('hex'), sha1: sha1.digest('hex'), task_id: p.task_id }),
    });
    if (h.data?.finish) return { fid: h.data.fid, size, rapid: true };

    // 分片直传：upload_url 是 http://pds.quark.cn，真实域名是 <bucket>.pds.quark.cn（CNAME 到 OSS）
    const host = `${p.bucket}.${p.upload_url.replace(/^https?:\/\//, '')}`;
    const partSize = pre.metadata?.part_size || 4 * 1024 * 1024;
    const parts = Math.ceil(size / partSize);
    const etags = [];
    const fd = openSync(localPath, 'r');
    try {
      for (let i = 1; i <= parts; i++) {
        const start = (i - 1) * partSize;
        const len = Math.min(partSize, size - start);
        const buf = Buffer.allocUnsafe(len);
        readSync(fd, buf, 0, len, start);

        const date = new Date().toUTCString();
        const authMeta = `PUT\n\napplication/zip\n${date}\nx-oss-date:${date}\nx-oss-user-agent:${OSS_UA}\n/${p.bucket}/${p.obj_key}?partNumber=${i}&uploadId=${p.upload_id}`;
        const auth = await this.api('/1/clouddrive/file/upload/auth?pr=ucpro&fr=pc', {
          method: 'POST',
          body: JSON.stringify({ auth_info: p.auth_info, auth_meta: authMeta, task_id: p.task_id }),
        });
        const res = await fetch(`https://${host}/${p.obj_key}?partNumber=${i}&uploadId=${p.upload_id}`, {
          method: 'PUT',
          headers: {
            Authorization: auth.data.auth_key,
            'Content-Type': 'application/zip',
            'x-oss-date': date,
            'x-oss-user-agent': OSS_UA,
            Referer: 'https://pan.quark.cn/',
          },
          body: buf,
        });
        const etag = res.headers.get('etag');
        if (!res.ok || !etag) throw new Error(`分片 ${i}/${parts} 上传失败：HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        etags.push(etag);
      }
    } finally {
      closeSync(fd);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<CompleteMultipartUpload>\n${etags
      .map((e, i) => `<Part>\n<PartNumber>${i + 1}</PartNumber>\n<ETag>${e}</ETag>\n</Part>`)
      .join('\n')}\n</CompleteMultipartUpload>`;
    const contentMd5 = createHash('md5').update(xml).digest('base64');
    const callbackB64 = Buffer.from(JSON.stringify(p.callback)).toString('base64');
    const date = new Date().toUTCString();
    const commitMeta = `POST\n${contentMd5}\napplication/xml\n${date}\nx-oss-callback:${callbackB64}\nx-oss-date:${date}\nx-oss-user-agent:${OSS_UA}\n/${p.bucket}/${p.obj_key}?uploadId=${p.upload_id}`;
    const commitAuth = await this.api('/1/clouddrive/file/upload/auth?pr=ucpro&fr=pc', {
      method: 'POST',
      body: JSON.stringify({ auth_info: p.auth_info, auth_meta: commitMeta, task_id: p.task_id }),
    });
    const commit = await fetch(`https://${host}/${p.obj_key}?uploadId=${p.upload_id}`, {
      method: 'POST',
      headers: {
        Authorization: commitAuth.data.auth_key,
        'Content-MD5': contentMd5,
        'Content-Type': 'application/xml',
        'x-oss-callback': callbackB64,
        'x-oss-date': date,
        'x-oss-user-agent': OSS_UA,
        Referer: 'https://pan.quark.cn/',
      },
      body: xml,
    });
    if (!commit.ok) throw new Error(`合并失败：HTTP ${commit.status} ${(await commit.text()).slice(0, 200)}`);

    await this.api('/1/clouddrive/file/upload/finish?pr=ucpro&fr=pc', {
      method: 'POST',
      body: JSON.stringify({ obj_key: p.obj_key, task_id: p.task_id }),
    });
    return { fid: p.fid, size, rapid: false };
  }
}

/** 版本号：优先命令行，其次文件名里的 x.y.z，最后读仓库 manifest */
function resolveVersion(repo) {
  const given = String(arg('version', ''));
  if (given) return given;
  const fromFile = String(arg('file', '')).match(/-(\d+\.\d+\.\d+)\.zip$/);
  if (fromFile) return fromFile[1];
  try {
    return JSON.parse(readFileSync(join(repo, 'manifest.json'), 'utf8')).version;
  } catch {
    return '';
  }
}

/** 把三件套打成 `<dirName>/main.js` 开头的 zip（与 pack-release 的包同构），返回临时文件 */
function packPlugin(repo, version, dirName) {
  const tmp = mkdtempSync(join(tmpdir(), 'bz-pack-'));
  const stage = join(tmp, dirName);
  mkdirSync(stage, { recursive: true });
  for (const f of ['main.js', 'manifest.json', 'styles.css']) {
    copyFileSync(join(repo, f), join(stage, f));
  }
  const out = join(tmp, `${dirName}-${version}.zip`);
  const run = spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${stage}' -DestinationPath '${out}'`], {
    stdio: 'inherit',
  });
  if (run.status !== 0) throw new Error(`打包 ${dirName} 失败`);
  return { zip: out, cleanup: () => rmSync(tmp, { recursive: true, force: true }) };
}

async function main() {
  const product = String(arg('product', 'bz'));
  const conf = PRODUCTS[product];
  if (!conf) throw new Error(`--product 只能是 ${Object.keys(PRODUCTS).join(' / ')}`);

  const dryRun = flag('dry-run');
  const cookieFile = String(arg('cookie-file', process.env.QUARK_COOKIE_FILE || join(homedir(), '.bz-quark-cookie')));
  if (!existsSync(cookieFile)) throw new Error(`找不到凭据文件 ${cookieFile}——先跑 python scripts/quark-auth.py 扫码授权`);
  const quark = new Quark(readFileSync(cookieFile, 'utf8').trim());

  const me = await quark.whoami();
  console.log(`[push-quark] 账号：${me.nickname || '(接口没给昵称)'}（${me.member_type || '未知会员'}）`);

  const repo = String(arg('repo', product === 'reader' ? 'D:/Obsidian/bz-reader' : process.cwd()));
  const version = resolveVersion(repo);
  let zip = String(arg('file', ''));
  let cleanup = null;
  if (!zip) {
    const candidate = join(repo, conf.zip(version));
    if (existsSync(candidate)) {
      zip = candidate;
    } else {
      // 没有现成的包就现场打三件套（bz 正常走 pack-release；reader 一直现场打）
      const packed = packPlugin(repo, version, product === 'reader' ? 'bz-reader' : 'bz');
      zip = packed.zip;
      cleanup = packed.cleanup;
    }
  }
  if (!existsSync(zip)) throw new Error(`找不到要上传的文件：${zip}`);

  const pdir = String(arg('pdir', conf.pdir));
  const name = basename(zip);
  const size = statSync(zip).size;
  console.log(`[push-quark] 目标：${conf.label} / ${name}（${(size / 1024 / 1024).toFixed(2)} MB）`);
  if (dryRun) {
    console.log('[push-quark] --dry-run：只演算，不真传');
    cleanup?.();
    return;
  }

  const uploaded = await quark.upload(zip, pdir, name);
  console.log(`[push-quark] 上传完成${uploaded.rapid ? '（秒传）' : ''}，fid=${uploaded.fid}`);

  // 对账：目录里必须有这个文件且大小一致（网盘索引有延迟，最多等 10 秒）
  let after = [];
  for (let i = 0; i < 10; i++) {
    after = await quark.list(pdir);
    if (after.some((f) => f.file_name === name && f.size === size)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const hit = after.find((f) => f.file_name === name && f.size === size);
  if (!hit) throw new Error(`上传后对不上账：目录里没找到 ${name}（${size} 字节）`);

  // 只留最新版：只删本产品自己的旧包，根目录里别人的文件一律不碰
  const stale = after.filter((f) => f.fid !== hit.fid && conf.pattern.test(f.file_name));
  if (stale.length) {
    await quark.remove(stale.map((f) => f.fid));
    console.log(`[push-quark] 清理旧版：${stale.map((f) => f.file_name).join('、')}`);
  }

  console.log(`[push-quark] ✓ ${conf.label} 网盘已是最新版${version ? ` v${version}` : ''}（目录现有 ${after.length - stale.length} 个文件）`);
  cleanup?.();
}

main().catch((e) => {
  console.error(`[push-quark] ✗ ${e.message}`);
  process.exit(1);
});
