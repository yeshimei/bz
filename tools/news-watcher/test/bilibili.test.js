// @ts-nocheck
// ticket 124：B 站动态条目映射纯函数单测（node:test，零依赖；npm test 合并执行）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBilibiliArticle } = require('../watcher.js');

const NOW_MS = new Date('2026-08-27T12:00:00Z').getTime();
const CUTOFF = NOW_MS - 24 * 60 * 60 * 1000; // 最近 24h

function makeAvItem(overrides = {}) {
  return {
    type: 'DYNAMIC_TYPE_AV',
    modules: {
      module_author: { name: '老番茄', mid: 546195, pub_ts: NOW_MS / 1000 },
      module_desc: { desc: '动态文案' },
      module_dynamic: {
        major: {
          archive: {
            title: '七夕节老番茄就和自己玩游戏',
            bvid: 'BV1q28V6VEYU',
            cover: 'http://i2.hdslb.com/bfs/archive/cover.jpg',
            duration_text: '16:58',
          },
        },
      },
    },
    ...overrides,
  };
}

test('DYNAMIC_TYPE_AV → 完整条目（标题/BV 链接/作者/日期/正文=简介+封面+观看链接，封面转 https）', () => {
  const a = buildBilibiliArticle(makeAvItem(), CUTOFF);
  assert.ok(a);
  assert.equal(a.platform, 'B站');
  assert.equal(a.title, '七夕节老番茄就和自己玩游戏');
  assert.equal(a.url, 'https://www.bilibili.com/video/BV1q28V6VEYU');
  assert.equal(a.author, '老番茄');
  assert.ok(a.date);
  assert.ok(a.body.includes('动态文案'));
  assert.ok(a.body.includes('https://i2.hdslb.com/bfs/archive/cover.jpg')); // http → https
  assert.ok(a.body.includes('🔗 观看'));
  assert.ok(a.body.includes('16:58'));
});

test('非 AV 类型（图文动态）→ null（仅视频投稿）', () => {
  const draw = buildBilibiliArticle({ type: 'DYNAMIC_TYPE_DRAW', modules: { module_dynamic: { major: { draw: { items: [] } } } } }, CUTOFF);
  assert.equal(draw, null);
});

test('缺 bvid / 缺标题 → null', () => {
  assert.equal(buildBilibiliArticle(makeAvItem({ modules: { module_dynamic: { major: { archive: { title: 'x' } } } } }), CUTOFF), null);
  assert.equal(buildBilibiliArticle(makeAvItem({ modules: { module_dynamic: { major: { archive: { bvid: 'BV1x' } } } } }), CUTOFF), null);
});

test('pub_ts 缺失/非法 → null', () => {
  assert.equal(buildBilibiliArticle(makeAvItem({ modules: { module_author: { name: 'x', pub_ts: 0 } } }), CUTOFF), null);
  assert.equal(buildBilibiliArticle(makeAvItem({ modules: { module_author: { name: 'x' } } }), CUTOFF), null);
});

test('越过 24h 窗口（pub_ts 早于 cutoff）→ null', () => {
  const oldTs = CUTOFF / 1000 - 60;
  assert.equal(buildBilibiliArticle(makeAvItem({ modules: { module_author: { name: 'x', mid: 1, pub_ts: oldTs } } }), CUTOFF), null);
});

test('无动态文案 + 无 archive.desc → 正文仅封面+观看链接', () => {
  // 深层合并：只覆盖 module_desc.desc，保留 author/dynamic
  const item = makeAvItem();
  item.modules.module_desc = { desc: '' };
  const a = buildBilibiliArticle(item, CUTOFF);
  assert.ok(a);
  assert.ok(!a.body.includes('动态文案'));
  assert.ok(a.body.includes('![封面]'));
  assert.ok(a.body.includes('🔗 观看'));
});