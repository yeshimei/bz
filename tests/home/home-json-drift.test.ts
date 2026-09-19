// @vitest-environment node
/**
 * home.json 段白名单契约（eff 方向 D4' 旧账 + home 深审跨域一行）：
 *
 * 体检 checks-drift 的 SEGMENT_FIELDS['home.json'] 曾滞留 v1 `['version','pinned']`，
 * 而 order.ts 早已写 v3 四数组（version/desk/mob/hiddenDesk/hiddenMob）——用户只要编辑过
 * 入口顺序，每次体检必报「约定外段 + 缺段」恒假阳性。本测试把体检白名单与落盘形状
 * 双钉对齐（belongings archived 白名单同类滞后的 home 版），防止再次漂移。
 */
import { describe, it, expect } from 'vitest';
import { SEGMENT_FIELDS } from '../../src/checkup/checks-drift';
import { emptyHomeOrder, HOME_ORDER_VERSION } from '../../src/home/order';

describe('home.json 段白名单与 v3 落盘形状对齐', () => {
  it('体检白名单 = saveHomeConfig 写入键集（v3：两端顺序 + 两端隐藏）', () => {
    const whitelist = SEGMENT_FIELDS['home.json'];
    expect(whitelist).toBeDefined();
    // 落盘形状单源 = order.ts emptyHomeOrder / saveHomeConfig 的 write 对象（同键集）
    const written = emptyHomeOrder();
    expect([...Object.keys(written)].sort()).toEqual([...whitelist].sort());
    // v1 旧键不得回流（pinned 已随 issue 232 退役）
    expect(whitelist).not.toContain('pinned');
  });

  it('版本号恒为当前版（体检缺段/旧版提示与 order.ts 单源一致）', () => {
    expect(emptyHomeOrder().version).toBe(HOME_ORDER_VERSION);
    expect(HOME_ORDER_VERSION).toBe(3);
  });
});
