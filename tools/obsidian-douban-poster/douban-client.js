import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cookie（可选，绕过风控）— 从 ~/.douban-cookies.txt 读取
const COOKIE_PATH = path.join(os.homedir(), '.douban-cookies.txt');
let _cookie = '';
try { _cookie = fs.readFileSync(COOKIE_PATH, 'utf-8').trim(); } catch {}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_RETRIES = 3;

/**
 * 带指数退避的重试包装器
 */
async function withRetry(fn, label = '请求') {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
      console.log(`[重试] ${label} 失败 (${err.message})，${delay}ms 后重试 (${attempt}/${MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * 发起 HTTP GET 请求，返回响应文本
 */
function httpGet(url, { maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };
    if (_cookie) headers['Cookie'] = _cookie;
    const req = mod.get(url, { headers }, (res) => {
      // 跟随重定向
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && maxRedirects > 0) {
        const location = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(httpGet(location, { maxRedirects: maxRedirects - 1 }));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/**
 * 下载文件到本地
 */
function httpDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://movie.douban.com/',
      },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const location = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(httpDownload(location, destPath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`下载失败: HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('下载超时')); });
  });
}

/**
 * 解析豆瓣搜索页 HTML，提取搜索结果列表
 * @returns {{ title: string, detailUrl: string, posterUrl: string }[]}
 */
export function parseSearchResults(html) {
  const results = [];
  // 匹配搜索结果块: class="result" 区域内的条目
  // 结构: <div class="result"><div class="pic"><a href="link2/..." title="英文名"><img src="poster"></a></div><div class="title"><a>中文名</a></div>
  const itemRegex = /class="result"[\s\S]*?<div class="pic">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<div class="title">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    const posterUrl = match[2];
    const title = match[3].trim();

    // 从 link2 URL 中提取真实 subject URL
    const urlMatch = rawUrl.match(/url=([^&]+)/);
    const detailUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;

    results.push({ title, detailUrl, posterUrl });
  }
  return results;
}

/**
 * 将 s_ratio_poster URL 升级为 l_ratio_poster（高清）
 */
export function upgradePosterUrl(url) {
  return url.replace('s_ratio_poster', 'l_ratio_poster');
}

/**
 * 从详情页 HTML 解析豆瓣元数据
 * 评分、导演、主演、年份、类型、地区、片长等
 */
function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 桌面版详情页 id="info" 块中的字段名 → 返回值字段
const INFO_FIELD_MAP = {
  '导演': 'directors',
  '编剧': 'writers',
  '主演': 'casts',
  '类型': 'genre',
  '制片国家/地区': 'region',
  '语言': 'lang',
  '上映日期': 'date',
  '首播': 'date',
  '片长': 'runtime',
  '单集片长': 'runtime',
  '又名': 'aka',
  'IMDb': 'imdb',
};

/**
 * 从详情页 HTML 解析豆瓣元数据
 * 评分、导演、主演、类型、地区、语言、上映日期、片长、又名、IMDb
 * 适配桌面版 id="info" 信息块（m.douban.com 现重定向到 movie.douban.com）
 */
export function parseSubjectMeta(html) {
  const rating = (html.match(/rating_num[^>]*>\s*([\d.]+)/) || [])[1] || null;

  // 信息块: <div id="info">...<span class="pl">类型:</span> <span property="v:genre">剧情</span> / ...<br/>
  const info = (html.match(/<div[^>]*id="info"[^>]*>([\s\S]*?)<\/div>/i) || [])[1] || '';
  const fields = {};
  if (info) {
    for (const line of info.split(/<br\s*\/?>/i)) {
      const m = line.match(/<span[^>]*class=["']?pl["']?[^>]*>([^<]+?)<\/span>\s*:?\s*([\s\S]*)$/i);
      if (!m) continue;
      const field = INFO_FIELD_MAP[m[1].trim().replace(/[：:]\s*$/, '')];
      if (!field) continue;
      let value = stripTags(m[2]);
      if (field === 'casts') value = value.split(' / ').slice(0, 6).join(' / ');
      if (field === 'date') {
        // 多日期时优先取完整 YYYY-MM-DD，去掉括号备注
        const dm = value.match(/\d{4}-\d{2}-\d{2}/);
        value = dm ? dm[0] : value.split(' / ')[0];
      }
      if (value) fields[field] = value;
    }
  }

  // 简介 og:description
  const descM = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  const intro = descM ? stripTags(descM[1]).replace(/^[^简]*简介[：:]\s*/, '') : '';

  return {
    rating,
    region: fields.region || '',
    genre: fields.genre || '',
    date: fields.date || '',
    runtime: fields.runtime || '',
    intro: intro.slice(0, 300),
    lang: fields.lang || '',
    aka: fields.aka || '',
    imdb: fields.imdb || '',
    directors: fields.directors || '',
    writers: fields.writers || '',
    casts: fields.casts || '',
  };
}

/**
 * 从 Celebrities API JSON 解析导演和主演
 * data: parsed JSON from rexxar API
 */
export function parseCelebrities(data) {
  if (!data || data.msg) return { directors: '', writers: '', casts: '' };
  const directors = (data.directors || []).map(d => d.name || d).join(' / ');
  const ws = (data.celebrities || []).filter(c => (c.roles || []).some(r => /编剧/.test(r)));
  const writers = ws.map(w => w.name).join(' / ');
  const actors = data.actors || [];
  const casts = actors.length
    ? (typeof actors[0] === 'object' ? actors.slice(0, 6).map(a => a.name || '').filter(Boolean) : actors.slice(0, 6)).join(' / ')
    : '';
  return { directors, writers, casts };
}

/**
 * 从详情页 URL 提取 subject ID
 */
function extractSid(detailUrl) {
  const m = detailUrl.match(/subject\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * 获取影视的完整豆瓣信息（评分、导演、主演等）
 * @param {string} detailUrl 豆瓣详情页 URL (https://movie.douban.com/subject/12345/)
 * @returns {{ rating, region, genre, date, runtime, directors, writers, casts, intro, lang, aka, imdb, url } | null}
 */
export async function fetchSubjectInfo(detailUrl) {
  const sid = extractSid(detailUrl);
  if (!sid) return null;

  // 1. 移动版详情页
  const subjectHtml = await withRetry(() => httpGet(`https://m.douban.com/movie/subject/${sid}/`), '豆瓣详情');
  if (!subjectHtml || subjectHtml.length < 200) return null;

  const meta = parseSubjectMeta(subjectHtml);

  // 2. 信息块解析不到演职员时，回退 Celebrities API
  if (!meta.directors || !meta.writers || !meta.casts) {
    for (const type of ['movie', 'tv']) {
      try {
        const txt = await withRetry(() => httpGet(`https://m.douban.com/rexxar/api/v2/${type}/${sid}/celebrities`), '演职员');
        if (txt && txt.length > 150) {
          const data = JSON.parse(txt);
          if (!data.msg) {
            const c = parseCelebrities(data);
            if (!meta.directors) meta.directors = c.directors;
            if (!meta.writers) meta.writers = c.writers;
            if (!meta.casts) meta.casts = c.casts;
            break;
          }
        }
      } catch {}
    }
  }

  // 3. 仍缺主演时从 og:description 补全
  if (!meta.casts) {
    const descM = subjectHtml.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (descM) {
      const as = descM[1].match(/([\u4e00-\u9fa5]{2,4})\s*饰/g);
      if (as) meta.casts = [...new Set(as.map(m => m.replace('饰', '').trim()))].join(' / ');
    }
  }


  return {
    ...meta,
    url: `https://movie.douban.com/subject/${sid}/`
  };
}

/**
 * 在豆瓣搜索影视，返回第一条结果
 * @param {string} name 影视名称
 * @returns {{ title: string, detailUrl: string, posterUrl: string } | null}
 */
export async function searchDouban(name) {
  const encodedName = encodeURIComponent(name);
  const url = `https://www.douban.com/search?cat=1002&q=${encodedName}`;
  const html = await withRetry(() => httpGet(url), '豆瓣搜索');
  const results = parseSearchResults(html);
  return results.length > 0 ? results[0] : null;
}

/**
 * 下载海报图片到指定路径
 * @param {string} imageUrl 图片 URL
 * @param {string} savePath 本地保存路径
 */
export async function downloadImage(imageUrl, savePath) {
  const hdUrl = upgradePosterUrl(imageUrl);
  await withRetry(() => httpDownload(hdUrl, savePath), '海报下载');
}
