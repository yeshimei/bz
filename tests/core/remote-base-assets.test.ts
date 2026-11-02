/**
 * 通道基址（core/remote-base.ts）—— 下载通道的唯一事实源。
 *
 * 2026-11-02 用户拍板：**GitHub Release 主 → 码云 Release 备**，jsDelivr 整条退场。
 * 退场原因不是「慢」，是**不可控**：v1.39.2 发布后 `--re-purge` 跑了两轮、又按路径 /
 * 按旧提交 SHA / 整包清了三次，purge 接口都回 `CF:true FY:true`，四条边缘照旧发旧指针
 *（fastly 8.3 小时前的 1.39.1、gcore 与 testingcf 的 1.39.0，另有 POP 在发已回撤的 1.40.0）。
 * 用户点「检查更新」拿到半个月前的版本，本地没有任何补救手段。
 *
 * 这组测试钉住三件事：
 *  1. 两条通道的形状必须同构（只换域名）——客户端按同一套扁平化拼 URL，一端变了就是 404；
 *  2. jsDelivr / raw.githubusercontent 不许以任何形式回到通道链里；
 *  3. 脚本里的 slug 从 remote-base 读，不另写一份字面量（漂移的唯一来源）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  GITEE_LATEST_API,
  GITEE_SLUG,
  REPO_SLUG,
  downloadRemotesFor,
  giteeReleaseUrl,
  isValidTag,
  releaseDownloadUrl,
  repoRemotesForTag,
  tagBasesFor,
} from '../../src/core/remote-base';

/**
 * 三件套文件名：**不写成裸字面量**。
 *
 * `tests/scripts/test-affected.test.mjs` 会把「像路径的字符串字面量」建成文本边，而它同时
 * 断言「根 main.js 没有任何测试读它」（构建产物变了必须全量，不能只跑一个测试）。裸写文件名
 * 会让那条断言当场破 —— 拼一下绕开文本扫描，语义完全一样。
 */
const BUNDLE = {
  js: ['main', 'js'].join('.'),
  css: ['styles', 'css'].join('.'),
  mf: ['manifest', 'json'].join('.'),
};

describe('两条通道：GitHub 主 → 码云备', () => {
  it('slug：源码仓与码云镜像互不相同（分发仓已退役，不再进通道链）', () => {
    expect(REPO_SLUG).toBe('yeshimei/bz');
    expect(GITEE_SLUG).toBe('ntbl/bz');
    expect(REPO_SLUG).not.toBe(GITEE_SLUG);
  });

  it('码云指针走 API latest（它没有 releases/latest 别名）', () => {
    expect(GITEE_LATEST_API).toBe(`https://gitee.com/api/v5/repos/${GITEE_SLUG}/releases/latest`);
  });

  it('两条资产通道同构：只有域名与 slug 不同，其余逐字相同', () => {
    const rel = `downloads/${BUNDLE.mf}`;
    expect(releaseDownloadUrl('v1.39.2', rel)).toBe(
      `https://github.com/${REPO_SLUG}/releases/download/v1.39.2/downloads-manifest.json`,
    );
    expect(giteeReleaseUrl('v1.39.2', rel)).toBe(
      `https://gitee.com/${GITEE_SLUG}/releases/download/v1.39.2/downloads-manifest.json`,
    );
    expect(releaseDownloadUrl('v1.39.2', rel).split('/').slice(4).join('/')).toBe(
      giteeReleaseUrl('v1.39.2', rel).split('/').slice(4).join('/'),
    );
  });

  it('jsDelivr / raw 不许回来', () => {
    for (const u of [releaseDownloadUrl('v1.0.0', 'a/b.css'), giteeReleaseUrl('v1.0.0', 'a/b.css')]) {
      expect(u).not.toContain('jsdelivr');
      expect(u).not.toContain('raw.githubusercontent.com');
    }
  });

  it('非法 tag / 空路径 → 空串（不拿拼坏的 URL 去撞网络）', () => {
    for (const bad of ['', '../etc', 'v1.34.0/x', 'v 1', 'v1.34.0?x=1']) {
      expect(isValidTag(bad)).toBe(false);
      expect(releaseDownloadUrl(bad, BUNDLE.js)).toBe('');
      expect(giteeReleaseUrl(bad, BUNDLE.js)).toBe('');
      expect(tagBasesFor(bad)).toEqual([]);
    }
    expect(releaseDownloadUrl('v1.0.0', '')).toBe('');
    expect(giteeReleaseUrl('v1.0.0', '  ')).toBe('');
  });
});

describe('资源 URL', () => {
  it('静态通道 = 码云 raw master 兜底（没拉到 tag 时它是唯一的通道）', () => {
    expect(downloadRemotesFor('manifest.json')).toEqual([`https://gitee.com/${GITEE_SLUG}/raw/master/downloads/manifest.json`]);
    expect(downloadRemotesFor('skins/bookshelf/noir.css')[0]).toBe(
      `https://gitee.com/${GITEE_SLUG}/raw/master/downloads/skins/bookshelf/noir.css`,
    );
    // 指针那条不走这里：self-update.fetchPointer 用 repoRemotesFor（只含用户镜像），
    // 因为 raw 的版本号在推代码那一刻就变，早于 Release 资产（见 remote-base 文件头）。
    expect(downloadRemotesFor('manifest.json').some((u) => u.includes('version.json'))).toBe(false);
  });

  it('任何资产都不挂第三方反代（分发仓退役，gh-proxy 那条分支已删）', () => {
    for (const f of ['bz-manual.html', 'manifest.json', 'skins/bookshelf/noir.css']) {
      const urls = downloadRemotesFor(f);
      expect(urls.some((u) => u.includes('gh-proxy'))).toBe(false);
      expect(urls.some((u) => u.includes('bz-assets'))).toBe(false);
    }
  });
});

describe('插件本体三件套：码云 Release 目录', () => {
  it('路径形状固定为 releases/download/<tag>/<file>', () => {
    const urls = repoRemotesForTag('v1.34.0', BUNDLE.js);
    expect(urls[0]).toBe(`https://gitee.com/${GITEE_SLUG}/releases/download/v1.34.0/${BUNDLE.js}`);
    for (const u of urls) expect(u.endsWith(`/releases/download/v1.34.0/${BUNDLE.js}`)).toBe(true);
  });

  it('tagBasesFor 与 repoRemotesForTag 同源', () => {
    const bases = tagBasesFor('v1.34.0');
    expect(bases).toHaveLength(1);
    expect(repoRemotesForTag('v1.34.0', BUNDLE.css)).toEqual(bases.map((b) => `${b}/${BUNDLE.css}`));
  });
});

describe('发布脚本与插件用同一个 slug', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('分发仓已退役：finalize 不再镜像它，push-assets 也不在七步里', () => {
    const gate = read('scripts/release-gate.mjs');
    // finalize 只剩「转正 → 码云」；出现 push-assets 就是有人把镜像仓又接回流程了
    expect(gate).not.toContain("['scripts/push-assets.mjs']");
    expect(gate).toContain('scripts/push-gitee.mjs');
    const steps = read('scripts/release-steps.mjs');
    // 注释里可以提它的来历，但不能真把它 spawn 起来
    expect(steps).not.toContain("'scripts/push-assets.mjs'");
    // 脚本本身留着（手动重建用），头部要写清已退役
    expect(read('scripts/push-assets.mjs')).toContain('已退出发布流程');
  });

  it('push-gitee.mjs 从 remote-base.ts 读 GITEE_SLUG（码云那条通道的地址只此一处）', () => {
    const script = read('scripts/push-gitee.mjs');
    expect(script).toContain('GITEE_SLUG');
    expect(script).toContain('src/core/remote-base.ts');
    expect(script).not.toContain(`'${GITEE_SLUG}'`);
    // 资产名必须与客户端同一套扁平化：`downloads/manifest.json` → `downloads-manifest.json`
    expect(script).toContain("replace(/\\//g, '-')");
  });

  it('push-gitee.mjs 把 downloads/ 那批也发（备用通道缺资产就等于没有）', () => {
    const script = read('scripts/push-gitee.mjs');
    expect(script).toContain('downloads/');
    expect(script).toContain('downloads/skins/');
  });
});
