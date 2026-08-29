// @ts-nocheck
// ticket 124：B 站动态条目映射纯函数单测（node:test，零依赖；npm test 合并执行）
// ticket 126：+ extractUpInfo / parseBilibiliUpInfo（UP 主名字/头像回填）
// ticket 127：+ collectBilibiliBatch / parseBilibiliMaxItems / parseBilibiliCookie
// ticket n（用户拍板 2026-08-29）：collectBilibiliBatch 改总量口径（收 feed 最近 N 条，不看已抓过）；
//   + pruneBilibiliWindow（每 UP 库内只保留最近 N 条，窗口外裁剪）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBilibiliArticle, extractUpInfo, parseBilibiliUpInfo, parseBilibiliMaxItems, parseBilibiliCookie, collectBilibiliBatch, pruneBilibiliWindow } = require('../watcher.js');

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

test('extractUpInfo：条目含 name/face → 资料（头像 http→https），首个含资料条目即返回', () => {
  const items = [
    { type: 'DYNAMIC_TYPE_AV', modules: { module_author: { name: '老番茄', face: 'http://i0.hdslb.com/bfs/face/a.jpg', mid: 546195 } } },
    { modules: { module_author: { name: '另一UP主' } } },
  ];
  assert.deepEqual(extractUpInfo(items), { name: '老番茄', avatar: 'https://i0.hdslb.com/bfs/face/a.jpg' });
});

test('extractUpInfo：无 module_author / 无 name+face → null；仅名字也算资料', () => {
  assert.equal(extractUpInfo([]), null);
  assert.equal(extractUpInfo([{}]), null);
  assert.equal(extractUpInfo([{ modules: { module_author: { mid: 1 } } }]), null);
  assert.deepEqual(extractUpInfo([{ modules: { module_author: { name: 'x' } } }]), { name: 'x' });
});

test('parseBilibiliUpInfo：段容错解析——非对象/数组 → {}；头像统一转 https；非对象值跳过', () => {
  assert.deepEqual(parseBilibiliUpInfo(undefined), {});
  assert.deepEqual(parseBilibiliUpInfo([]), {});
  assert.deepEqual(parseBilibiliUpInfo('bad'), {});
  assert.deepEqual(
    parseBilibiliUpInfo({ '1': { name: 'a', avatar: 'http://x/a.jpg' }, '2': 'bad', '3': { name: 'b' } }),
    { '1': { name: 'a', avatar: 'https://x/a.jpg' }, '3': { name: 'b' } }
  );
});

test('parseBilibiliMaxItems：默认 10，夹取 1..50，非法回退 10', () => {
  assert.equal(parseBilibiliMaxItems(undefined), 10);
  assert.equal(parseBilibiliMaxItems(''), 10);
  assert.equal(parseBilibiliMaxItems('abc'), 10);
  assert.equal(parseBilibiliMaxItems(20), 20);
  assert.equal(parseBilibiliMaxItems(0), 10);
  assert.equal(parseBilibiliMaxItems(-5), 10);
  assert.equal(parseBilibiliMaxItems(99), 50);
  assert.equal(parseBilibiliMaxItems('7'), 7);
});

test('parseBilibiliCookie：字符串去空白；非字符串 → 空串', () => {
  assert.equal(parseBilibiliCookie(undefined), '');
  assert.equal(parseBilibiliCookie('  SESSDATA=abc  '), 'SESSDATA=abc');
  assert.equal(parseBilibiliCookie(123), '');
});

test('collectBilibiliBatch：按 feed 最近优先收前 N 条视频（无 24h 窗口，已抓过的也计入窗口）', () => {
  const items = [
    makeAvItem({ modules: { module_author: { name: '老番茄', mid: 1, pub_ts: NOW_MS / 1000 }, module_dynamic: { major: { archive: { title: '新视频', bvid: 'BVnew' } } } } }),
    { type: 'DYNAMIC_TYPE_DRAW', modules: {} }, // 非 AV 跳过
    makeAvItem({ modules: { module_author: { name: '老番茄', mid: 1, pub_ts: CUTOFF / 1000 - 60 }, module_dynamic: { major: { archive: { title: '老视频（窗口外也收）', bvid: 'BVold' } } } } }), // 旧视频照收
    makeAvItem({ modules: { module_author: { name: '老番茄', mid: 1, pub_ts: NOW_MS / 1000 }, module_dynamic: { major: { archive: { title: '已抓过', bvid: 'BVdup' } } } } }),
  ];
  const existing = new Set(['https://www.bilibili.com/video/BVdup']);
  const out = [];
  const full = collectBilibiliBatch(items, 10, out);
  assert.equal(full, false);
  assert.equal(out.length, 3); // 新视频 + 窗口外老视频 + 已抓过的（窗口=最近 N 条总量口径，不再跳过已入库）
  assert.equal(out[0].title, '新视频');
  assert.equal(out[1].title, '老视频（窗口外也收）');
  assert.equal(out[2].title, '已抓过');
  fromBv(out[0].url, 'BVnew');
  fromBv(out[1].url, 'BVold');
  fromBv(out[2].url, 'BVdup');
});

test('collectBilibiliBatch：达到条数上限返回 true 且不再多收', () => {
  const items = [
    makeAvItem({ modules: { module_author: { name: 'a', mid: 1, pub_ts: NOW_MS / 1000 }, module_dynamic: { major: { archive: { title: 'A', bvid: 'BV1' } } } } }),
    makeAvItem({ modules: { module_author: { name: 'a', mid: 1, pub_ts: NOW_MS / 1000 }, module_dynamic: { major: { archive: { title: 'B', bvid: 'BV2' } } } } }),
    makeAvItem({ modules: { module_author: { name: 'a', mid: 1, pub_ts: NOW_MS / 1000 }, module_dynamic: { major: { archive: { title: 'C', bvid: 'BV3' } } } } }),
  ];
  const out = [];
  const full = collectBilibiliBatch(items, 2, out);
  assert.equal(full, true);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, 'A');
  assert.equal(out[1].title, 'B');
});

// ---------- pruneBilibiliWindow（ticket n：窗口裁剪） ----------

function mkExisting(title, bvid, date, author = '老番茄') {
  return { platform: 'B站', title, url: `https://www.bilibili.com/video/${bvid}`, author, date, body: '' };
}

test('pruneBilibiliWindow：同 UP 存量中 url 不在窗口内且早于窗口最早一条 → 裁掉', () => {
  const existing = [
    mkExisting('窗口内1', 'BVw1', '2026-08-27 12:00:00'),
    mkExisting('窗口内2', 'BVw2', '2026-08-26 12:00:00'),
    mkExisting('窗口外老1', 'BVold1', '2026-08-01 12:00:00'),
    mkExisting('窗口外老2', 'BVold2', '2026-07-15 12:00:00'),
    mkExisting('别家UP不裁', 'BVother', '2026-07-01 12:00:00', '其他UP'), // author 不同
    { ...mkExisting('非B站不裁', 'x', '2026-07-01 12:00:00'), platform: '知乎日报' }, // platform 不同
  ];
  const window1 = { platform: 'B站', title: '窗口内1', url: 'https://www.bilibili.com/video/BVw1', author: '老番茄', date: '2026-08-27 12:00:00', body: '' };
  const window2 = { platform: 'B站', title: '窗口内2', url: 'https://www.bilibili.com/video/BVw2', author: '老番茄', date: '2026-08-26 12:00:00', body: '' };
  const pruned = pruneBilibiliWindow(
    existing,
    { 42: [window1, window2] },
    {},
    { 42: { name: '老番茄' } }
  );
  assert.deepEqual(pruned.sort(), [
    'https://www.bilibili.com/video/BVold1',
    'https://www.bilibili.com/video/BVold2',
  ]);
});

test('pruneBilibiliWindow：比窗口内最早一条更新的残留不裁（防误删）；风控/空窗口/缺 UP 名不裁', () => {
  const existing = [
    mkExisting('更新残留', 'BVfresh', '2026-08-27 18:00:00'), // 晚于窗口最早一条 → 保守保留
    mkExisting('窗口外老', 'BVold', '2026-07-01 12:00:00'),
  ];
  const window = [{ platform: 'B站', title: 'w', url: 'https://www.bilibili.com/video/BVw', author: '老番茄', date: '2026-08-27 12:00:00', body: '' }];
  // 正常：更新残留保留，老的裁掉
  const pruned = pruneBilibiliWindow(existing, { 1: window }, {}, { 1: { name: '老番茄' } });
  assert.deepEqual(pruned, ['https://www.bilibili.com/video/BVold']);
  // 风控轮：全不裁
  assert.deepEqual(pruneBilibiliWindow(existing, { 1: window }, { 1: true }, { 1: { name: '老番茄' } }), []);
  // 空窗口：不裁
  assert.deepEqual(pruneBilibiliWindow(existing, { 1: [] }, {}, { 1: { name: '老番茄' } }), []);
  // 缺 UP 名（资料未抓到）：不裁
  assert.deepEqual(pruneBilibiliWindow(existing, { 1: window }, {}, {}), []);
});

function fromBv(url, bvid) {
  assert.ok(url && url.includes(`/video/${bvid}`), `expect url contains ${bvid}, got ${url}`);
}