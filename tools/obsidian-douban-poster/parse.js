/**
 * 豆瓣解析预览（parse 命令）——只输出 JSON，不下载海报、不写任何文件。
 * 供 Obsidian 插件「解析」按钮在创建影视前预览海报与豆瓣信息。
 */

import { searchDouban, fetchSubjectInfo, upgradePosterUrl } from './douban-client.js';

/**
 * 组装解析结果（纯函数，便于测试）
 * @param {{ title: string, detailUrl: string, posterUrl: string } | null} searchResult
 * @param {object | null} info fetchSubjectInfo 的返回值（可能为 null）
 * @returns {{ ok: boolean, error?: string, ... }}
 */
export function buildParseResult(searchResult, info) {
  if (!searchResult) return { ok: false, error: '未找到豆瓣结果' };
  const out = {
    ok: true,
    title: searchResult.title,
    posterUrl: upgradePosterUrl(searchResult.posterUrl),
    detailUrl: searchResult.detailUrl,
    mediaType: info ? (info.mediaType || null) : null,
  };
  if (info) {
    if (info.rating) out.rating = info.rating;
    if (info.directors) out.directors = info.directors;
    if (info.writers) out.writers = info.writers;
    if (info.casts) out.casts = info.casts;
    if (info.genre) out.genre = info.genre;
    if (info.region) out.region = info.region;
    if (info.lang) out.lang = info.lang;
    if (info.date) out.date = info.date;
    if (info.runtime) out.runtime = info.runtime;
    if (info.aka) out.aka = info.aka;
    if (info.imdb) out.imdb = info.imdb;
    if (info.intro) out.intro = info.intro;
    if (info.url) out.url = info.url;
  }
  return out;
}

/**
 * 对影视名称执行一次豆瓣解析（搜索 + 详情页信息）
 * @param {string} name 影视名称
 * @returns {Promise<object>} 解析结果对象（ok/error 或各字段）
 */
export async function parseMovie(name) {
  try {
    const result = await searchDouban(name);
    if (!result) return { ok: false, error: `未找到《${name}》的豆瓣结果` };
    const info = await fetchSubjectInfo(result.detailUrl, { detectMediaType: true });
    return buildParseResult(result, info);
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}
