// @vitest-environment node
/**
 * 剪藏本（clipbook）· T7 正文外链打开降级链（review-deep clipbook-arch 测试缺口 7，随 A6 立项）
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 开关 USES_OPEN_EXTERNAL_URL 钉死的是本批基线（master @ 92dba387，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - USES_OPEN_EXTERNAL_URL → 批 A 或批 D 落点（clipbook-arch A6 / consistency #6）：
 *     ui.ts 两处正文外链（桌面右栏 + 移动详情）从裸 `window.open(ext.href, '_blank')`
 *     改走 core/utils openExternalUrl 单源（app.openUrl → electron shell → window.open →
 *     人话 error 通知的四级降级链；memo/favorites/knowledge 已收编，clipbook 是漏网域）。
 * 并行修复合并进 master 后，主线程把开关翻 true 即断言翻转为「必须」语义
 * （单源收编成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 断言面：静态源码断言（openExternalUrl 单源自身行为已由 core 测试盖，此处只钉
 * clipbook 两处调用点确实走单源而非裸 window.open——A6 修法口径）。
 * 参考先例：tests/memo/flip-switches-fix-e.test.ts。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 【期望配置】见文件头「可配置期望约定」：现状 false（钉旧基线行为），批 A/D 合并后翻转 */
const USES_OPEN_EXTERNAL_URL = true; // 主线程收口已合并：外链走 core openExternalUrl

const UI_TS = readFileSync(fileURLToPath(new URL('../../src/clipbook/ui.ts', import.meta.url)), 'utf8');

describe('T7 正文外链打开（开关 USES_OPEN_EXTERNAL_URL，A6 / consistency #6）', () => {
  it('ui.ts 外链点击：现状裸 window.open（两处）；单源收编后必须走 openExternalUrl 且无裸调残留', () => {
    if (USES_OPEN_EXTERNAL_URL) {
      // 修复后（必须）：两处调用点改走 core openExternalUrl 单源，裸 window.open 清零
      expect(UI_TS).toContain('openExternalUrl(');
      expect(UI_TS, '【必须】ui.ts 不应残留裸 window.open 调用（外链降级链单源）').not.toContain('window.open(');
    } else {
      // 现状（钉死）：桌面右栏 + 移动详情两处裸调（try/catch 空吞——失败静默无反馈）
      const bareCalls = UI_TS.match(/window\.open\(ext\.href/g) || [];
      expect(bareCalls.length, '现状应有且只有两处裸 window.open（桌面 + 移动）；数量变化说明行为漂移，见文件头约定').toBe(2);
    }
  });
});
