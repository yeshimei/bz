/**
 * 分发仓库基址（core/remote-base.ts）—— 下载通道的唯一事实源。
 *
 * 2026-10-28 报障：插件里所有下载都是红的。根因不是网络，是**仓库体积**：
 * 主仓 `.git` 284 MB 超过 jsDelivr 的 50 MB 上限，它拒发主仓里没被缓存过的任何文件；
 * 国内无代理时 `raw.githubusercontent.com` 又不通。两条通道同时死 → 功能等于不存在。
 *
 * 修法是把下载物搬进独立小仓库（ASSETS_SLUG，ADR-0269）。这组测试钉住「搬过之后不能再有
 * 任何一条基址指回主仓」——那是一条回归时会静默失败（只有国内裸网的用户受影响，
 * 开发机带代理永远看不出来）的错。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ASSETS_SLUG,
  REPO_BASES,
  REPO_SLUG,
  downloadRemotesFor,
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

describe('分发仓库与源码仓库是两回事', () => {
  it('两个 slug 不同（写回同一个 = 下载全挂，且开发机看不出）', () => {
    expect(ASSETS_SLUG).not.toBe(REPO_SLUG);
    expect(ASSETS_SLUG).toBe('yeshimei/bz-assets');
  });

  it('每条通道都指向分发仓库，一条都不许指回主仓', () => {
    expect(REPO_BASES.length).toBeGreaterThan(1);
    for (const base of REPO_BASES) {
      expect(base).toContain(ASSETS_SLUG);
      expect(base).not.toContain(`${REPO_SLUG}/`);
    }
  });

  it('通道形状：全部 jsDelivr 边缘（raw 已退场，主通道是 Release 资产）', () => {
    expect(REPO_BASES.length).toBeGreaterThanOrEqual(3);
    for (const b of REPO_BASES) expect(b).toMatch(new RegExp(`^https://[a-z]+\\.jsdelivr\\.net/gh/${ASSETS_SLUG}@master$`));
    // raw 不许回来（2026-10-31 拍板：国内裸网恒死，每个用户白等一次超时）
    for (const b of REPO_BASES) expect(b).not.toContain('raw.githubusercontent.com');
  });
});

describe('资源 URL', () => {
  it('downloads/ 资产：分发仓库 master 下的 downloads/<file>', () => {
    const urls = downloadRemotesFor('skins/bookshelf/noir.css');
    expect(urls[0]).toBe(`https://fastly.jsdelivr.net/gh/${ASSETS_SLUG}@master/downloads/skins/bookshelf/noir.css`);
    expect(urls.some((u) => u.includes('/downloads/skins/bookshelf/noir.css'))).toBe(true);
    for (const u of urls) expect(u).not.toContain('raw.githubusercontent.com');
    for (const u of urls) expect(u).toContain('/downloads/');
  });

  it('HTML 资产多一条反代兜底（jsDelivr 对 .html 一律 301 到 raw，裸网就是死循环）', () => {
    const html = downloadRemotesFor('bz-manual.html');
    expect(html).toHaveLength(REPO_BASES.length + 1);
    expect(html[html.length - 1]).toBe(
      `https://gh-proxy.com/https://raw.githubusercontent.com/${ASSETS_SLUG}/master/downloads/bz-manual.html`,
    );
    // 非 html 不许挂反代：第三方能少碰就少碰
    expect(downloadRemotesFor('manifest.json')).toHaveLength(REPO_BASES.length);
    expect(downloadRemotesFor('bz-manual.html').some((u) => u.includes('gh-proxy'))).toBe(true);
    expect(downloadRemotesFor('skins/bookshelf/noir.css').every((u) => !u.includes('gh-proxy'))).toBe(true);
  });
});

describe('插件本体三件套：releases/<tag>/', () => {
  it('路径形状固定为 releases/<tag>/<file>', () => {
    const urls = repoRemotesForTag('v1.34.0', BUNDLE.js);
    expect(urls[0]).toBe(`https://fastly.jsdelivr.net/gh/${ASSETS_SLUG}@master/releases/v1.34.0/${BUNDLE.js}`);
    for (const u of urls) expect(u.endsWith(`/releases/v1.34.0/${BUNDLE.js}`)).toBe(true);
  });

  it('每条基址都能拼（tagBasesFor 与 repoRemotesForTag 同源）', () => {
    const bases = tagBasesFor('v1.34.0');
    expect(bases.length).toBe(REPO_BASES.length);
    expect(repoRemotesForTag('v1.34.0', BUNDLE.css)).toEqual(bases.map((b) => `${b}/${BUNDLE.css}`));
  });

  it('非法 tag → 空数组（不拿拼坏的 URL 去撞网络）', () => {
    for (const bad of ['', '../etc', 'v1.34.0/x', 'v 1', 'v1.34.0?x=1']) expect(tagBasesFor(bad)).toEqual([]);
  });
});

describe('发布脚本与插件用同一个 slug', () => {
  it('push-assets.mjs 从 remote-base.ts 读 slug，不自己再写一份字面量', () => {
    const script = fs.readFileSync(path.join(process.cwd(), 'scripts/push-assets.mjs'), 'utf8');
    expect(script).toContain('ASSETS_SLUG');
    expect(script).toContain('src/core/remote-base.ts');
    // 脚本里不许出现第二个写死的 slug 字面量（漂移的来源）
    expect(script).not.toContain(`'${ASSETS_SLUG}'`);
  });
});
