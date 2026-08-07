import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractMovieName,
  hasPoster,
  readFrontmatter,
  updateFrontmatter,
  insertPosterEmbed,
} from '../note-processor.js';

describe('extractMovieName', () => {
  it('从《名称》.md格式提取名称', () => {
    assert.equal(extractMovieName('《肖申克的救赎》.md'), '肖申克的救赎');
  });

  it('处理无书名号的文件名', () => {
    assert.equal(extractMovieName('肖申克的救赎.md'), '肖申克的救赎');
  });

  it('处理英文名称', () => {
    assert.equal(extractMovieName('《Inception》.md'), 'Inception');
  });
});

describe('hasPoster', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('海报字段为空时返回false', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, '---\ntags:\n  - 电影\n海报: \n---\n');
    assert.equal(hasPoster(file), false);
  });

  it('海报字段不存在时返回false', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, '---\ntags:\n  - 电影\n评分: 5\n---\n');
    assert.equal(hasPoster(file), false);
  });

  it('海报字段有值时返回true', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, '---\ntags:\n  - 电影\n海报: CONFIG/MOVIE POSTER/img.jpg\n---\n');
    assert.equal(hasPoster(file), true);
  });
});

describe('readFrontmatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('读取完整的frontmatter', () => {
    const file = path.join(tmpDir, 'test.md');
    const content = '---\ntags:\n  - 电影\n观影日期: 2024-01-01\n评分: 4.5\n海报: \n---\n正文内容';
    fs.writeFileSync(file, content);
    const fm = readFrontmatter(file);
    assert.deepEqual(fm.tags, ['电影']);
    assert.equal(fm['观影日期'], '2024-01-01');
    assert.equal(fm['评分'], 4.5);
  });

  it('无frontmatter时返回空对象', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, '没有frontmatter的文件');
    const fm = readFrontmatter(file);
    assert.deepEqual(fm, {});
  });
});

describe('updateFrontmatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('更新海报字段并保留其他字段', () => {
    const file = path.join(tmpDir, 'test.md');
    const original = '---\ntags:\n  - 电影\n观影日期: 2024-01-01\n评分: 4.5\n海报: \n---\n正文内容';
    fs.writeFileSync(file, original);

    updateFrontmatter(file, 'CONFIG/MOVIE POSTER/肖申克的救赎.webp');
    const result = fs.readFileSync(file, 'utf-8');

    assert.ok(result.includes('海报: "CONFIG/MOVIE POSTER/肖申克的救赎.webp"'));
    assert.ok(result.includes('观影日期: 2024-01-01'));
    assert.ok(result.includes('评分: 4.5'));
    assert.ok(result.includes('正文内容'));
  });

  it('frontmatter为空时添加海报字段', () => {
    const file = path.join(tmpDir, 'test.md');
    fs.writeFileSync(file, '---\n---\n');

    updateFrontmatter(file, 'CONFIG/MOVIE POSTER/test.webp');
    const result = fs.readFileSync(file, 'utf-8');

    assert.ok(result.includes('海报: "CONFIG/MOVIE POSTER/test.webp"'));
  });
});

describe('insertPosterEmbed', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poster-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('在frontmatter后插入海报图片链接', () => {
    const file = path.join(tmpDir, 'test.md');
    const original = '---\ntags:\n  - 电影\n海报: path\n---\n正文内容';
    fs.writeFileSync(file, original);

    insertPosterEmbed(file, 'CONFIG/MOVIE POSTER/test.webp');
    const result = fs.readFileSync(file, 'utf-8');

    assert.ok(result.includes('![[CONFIG/MOVIE POSTER/test.webp]]'));
    // 图片链接应在正文之前
    const embedIdx = result.indexOf('![[');
    const bodyIdx = result.indexOf('正文内容');
    assert.ok(embedIdx < bodyIdx);
  });

  it('已有embed时不重复插入', () => {
    const file = path.join(tmpDir, 'test.md');
    const original = '---\ntags:\n  - 电影\n海报: path\n---\n![[CONFIG/MOVIE POSTER/test.webp]]\n正文';
    fs.writeFileSync(file, original);

    insertPosterEmbed(file, 'CONFIG/MOVIE POSTER/test.webp');
    const result = fs.readFileSync(file, 'utf-8');
    const matches = result.match(/!\[\[/g);
    assert.equal(matches.length, 1);
  });
});
