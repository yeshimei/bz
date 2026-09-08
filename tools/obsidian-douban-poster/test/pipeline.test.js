import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fetchPosterForNote } from '../pipeline.js';
import { readFrontmatter } from '../note-processor.js';

/** 假豆瓣客户端：搜索/下载/详情全部可观测，不发网络请求 */
function fakeDouban(overrides = {}) {
  const calls = { search: 0, download: 0, info: 0 };
  const deps = {
    searchDouban: async () => {
      calls.search++;
      return {
        title: '肖申克的救赎',
        detailUrl: 'https://movie.douban.com/subject/1889243/',
        posterUrl: 'https://img.doubanio.com/view/photo/l/public/p480747492.jpg',
      };
    },
    downloadImage: async (_url, dest) => {
      calls.download++;
      fs.writeFileSync(dest, 'fake-image');
    },
    fetchSubjectInfo: async () => {
      calls.info++;
      return {
        rating: '9.7',
        directors: '弗兰克·德拉邦特',
        url: 'https://movie.douban.com/subject/1889243/',
      };
    },
    ...overrides,
  };
  return { calls, deps };
}

describe('fetchPosterForNote', () => {
  let tmpDir;
  let notePath;
  let config;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
    notePath = path.join(tmpDir, '《肖申克的救赎》.md');
    config = { vaultPath: tmpDir, movieFolder: '我的/影视', posterFolder: 'CONFIG/MOVIE POSTER' };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('齐全（海报+合法链接）→ 跳过返回 false，零请求', async () => {
    fs.writeFileSync(notePath, '---\n海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: https://movie.douban.com/subject/1/\n---\n正文');
    const { calls, deps } = fakeDouban();
    assert.equal(await fetchPosterForNote(notePath, config, deps), false);
    assert.deepEqual(calls, { search: 0, download: 0, info: 0 });
  });

  it('只有海报（补全分支）→ 不下载不换 embed，仅补豆瓣信息', async () => {
    const body = '![[CONFIG/MOVIE POSTER/a.jpg]]\n正文';
    fs.writeFileSync(notePath, `---\n海报: CONFIG/MOVIE POSTER/a.jpg\n评分: 9\n---\n${body}`);
    const before = fs.readFileSync(notePath, 'utf-8');
    const { calls, deps } = fakeDouban();

    assert.equal(await fetchPosterForNote(notePath, config, deps), true);
    assert.equal(calls.search, 1, '应搜索一次');
    assert.equal(calls.info, 1, '应取详情一次');
    assert.equal(calls.download, 0, '补全分支不得重新下载海报');

    const fm = readFrontmatter(notePath);
    assert.equal(fm['海报'], 'CONFIG/MOVIE POSTER/a.jpg', '海报字段不得变动');
    assert.equal(fm['豆瓣链接'], 'https://movie.douban.com/subject/1889243/', '应写入豆瓣链接');
    assert.equal(String(fm['豆瓣评分']), '9.7');
    const after = fs.readFileSync(notePath, 'utf-8');
    assert.equal((after.match(/!\[\[/g) || []).length, 1, '不得新增第二条海报 embed');
    assert.ok(after.includes(body), '原 embed 与正文保持原样');
    assert.notEqual(before, after);
  });

  it('链接为非 URL 脏值 + 有海报 → 视为不齐全，走补全并以合法链接覆盖', async () => {
    fs.writeFileSync(notePath, '---\n海报: CONFIG/MOVIE POSTER/a.jpg\n豆瓣链接: 随手记的字符串\n---\n正文');
    const { calls, deps } = fakeDouban();

    assert.equal(await fetchPosterForNote(notePath, config, deps), true);
    assert.equal(calls.download, 0);
    assert.equal(readFrontmatter(notePath)['豆瓣链接'], 'https://movie.douban.com/subject/1889243/');
  });

  it('无海报 → 完整抓取：下载 + 写海报字段 + 插 embed', async () => {
    fs.writeFileSync(notePath, '---\n评分: 9\n---\n正文');
    const { calls, deps } = fakeDouban();

    assert.equal(await fetchPosterForNote(notePath, config, deps), true);
    assert.deepEqual(calls, { search: 1, download: 1, info: 1 });
    const fm = readFrontmatter(notePath);
    assert.ok(String(fm['海报']).startsWith('CONFIG/MOVIE POSTER/'), '应写海报字段');
    const content = fs.readFileSync(notePath, 'utf-8');
    assert.ok(content.includes(`![[${fm['海报']}]]`), '应插入海报 embed');
  });

  it('搜索无结果 → false，不写任何字段', async () => {
    fs.writeFileSync(notePath, '---\n海报: CONFIG/MOVIE POSTER/a.jpg\n---\n正文');
    const { deps } = fakeDouban({ searchDouban: async () => null });

    assert.equal(await fetchPosterForNote(notePath, config, deps), false);
    assert.equal(readFrontmatter(notePath)['豆瓣链接'], undefined);
  });
});
