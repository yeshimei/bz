/**
 * 通知系统（ticket 25）核心测试——自绘 toast 替代原生 Notice。
 * 覆盖：四种类型 / 时长规则 / 点击关闭 / 动态消息 / 进度条 / 操作按钮 / 堆叠上限。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notify, __resetNoticeForTests, cleanupNotices } from '../../src/core/notice';

function visibleNotices(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.bz-notice')) as HTMLElement[];
}

describe('通知系统', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 清空模块级存活/去重状态（前一用例残留的常驻帧会污染堆叠计数断言）
    __resetNoticeForTests();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('弹出基本通知：容器单例 + 消息文本', () => {
    const h = notify('备忘录已刷新');
    const container = document.getElementById('bz-notice-container');
    expect(container).not.toBeNull();
    const el = visibleNotices();
    expect(el).toHaveLength(1);
    expect(el[0].querySelector('.bz-notice-msg')!.textContent).toBe('备忘录已刷新');
    expect(h.el).toBe(el[0]);
    // 单例：再次弹出不重建容器
    notify('第二条');
    expect(document.getElementById('bz-notice-container')).toBe(container);
  });

  it('类型类名：success/warning/error/info + emoji 图标', () => {
    notify('成功', { type: 'success' });
    notify('警告', { type: 'warning' });
    notify('错误', { type: 'error' });
    notify('信息');
    const els = visibleNotices();
    expect(els[0].classList.contains('bz-notice--success')).toBe(true);
    expect(els[1].classList.contains('bz-notice--warning')).toBe(true);
    expect(els[2].classList.contains('bz-notice--error')).toBe(true);
    expect(els[3].classList.contains('bz-notice--info')).toBe(true);
    // 类型图标用 emoji（消息文本不含 emoji）
    const icons = els.map((el) => el.querySelector('.bz-notice-icon')!.textContent);
    expect(icons[0]).toBe('✅');
    expect(icons[1]).toBe('⚠️');
    expect(icons[2]).toBe('❌');
    expect(icons[3]).toBe('ℹ️');
    expect(els[0].querySelector('.bz-notice-msg')!.textContent).toBe('成功');
  });

  it('动画变体：进入类名 + 退出类名', async () => {
    const h = notify('pop 变体', { variant: 'pop' });
    const el = visibleNotices()[0];
    expect(el.classList.contains('bz-notice--in-pop')).toBe(true);
    h.hide();
    expect(el.classList.contains('bz-notice--leaving')).toBe(true);
    expect(el.classList.contains('bz-notice--out-pop')).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('默认变体：桌面 slide-right（右侧滑入）；移动端 drop（顶部下滑）', () => {
    // jsdom 无 matchMedia → 桌面默认
    notify('桌面');
    expect(visibleNotices()[0].classList.contains('bz-notice--in-slide-right')).toBe(true);
    visibleNotices()[0].remove();
    // 模拟移动端视口（max-width: 768px）
    window.matchMedia = ((q: string) => ({
      matches: q === '(max-width: 768px)',
      media: q,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as any;
    notify('移动端');
    expect(visibleNotices()[0].classList.contains('bz-notice--in-drop')).toBe(true);
    delete (window as any).matchMedia;
  });

  it('slide/bounce/shake 显式变体类名正确', () => {
    notify('左滑', { variant: 'slide-left' });
    expect(visibleNotices()[0].classList.contains('bz-notice--in-slide-left')).toBe(true);
    notify('右滑', { variant: 'slide-right' });
    expect(visibleNotices()[1].classList.contains('bz-notice--in-slide-right')).toBe(true);
    notify('弹跳', { variant: 'bounce' });
    expect(visibleNotices()[2].classList.contains('bz-notice--in-bounce')).toBe(true);
    notify('抖动', { variant: 'shake' });
    expect(visibleNotices()[3].classList.contains('bz-notice--in-shake')).toBe(true);
  });

  it('富文本标题 + 多行消息（white-space 换行保留）', () => {
    notify('第一行\n第二行', { title: '自动摘要' });
    const el = visibleNotices()[0];
    expect(el.querySelector('.bz-notice-title')!.textContent).toBe('自动摘要');
    expect(el.querySelector('.bz-notice-msg')!.textContent).toBe('第一行\n第二行');
  });

  it('时长规则：info 默认 3s 自动消失，error 默认 5s', async () => {
    notify('信息');
    notify('错误', { type: 'error' });
    expect(visibleNotices()).toHaveLength(2);
    // 3s 后信息消失（+200ms 退出动画），错误仍在
    await vi.advanceTimersByTimeAsync(3200);
    expect(visibleNotices()).toHaveLength(1);
    // 5s 后错误也消失
    await vi.advanceTimersByTimeAsync(5200);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('显式 duration 覆盖类型默认', async () => {
    notify('短提示', { duration: 500 });
    await vi.advanceTimersByTimeAsync(700);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('长文本通知按字数动态延长停留时间', async () => {
    // 短文本（≤20 字）用默认 3000ms
    notify('短');
    // 长文本（50 字）：base 3000 + (50-20)×60 = 4800ms
    notify('这是一条比较长的通知消息，用于测试动态延长停留时间的功能是否正常');
    expect(visibleNotices()).toHaveLength(2);
    // 3200ms：短文本消失，长文本仍在
    await vi.advanceTimersByTimeAsync(3200);
    expect(visibleNotices()).toHaveLength(1);
    // 5000ms：长文本也消失（4800 + 200 退出动画）
    await vi.advanceTimersByTimeAsync(2000);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('显式 duration 优先于动态计算', async () => {
    // 50 字文本但显式指定 500ms，不走动态计算
    notify('这是一条比较长的通知消息，用于测试显式 duration 是否优先于动态计算', { duration: 500 });
    await vi.advanceTimersByTimeAsync(700);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('点击通知本体关闭', async () => {
    const h = notify('可点击关闭');
    h.el.click();
    // 退出动画 200ms 后移除
    await vi.advanceTimersByTimeAsync(250);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('setMessage 动态更新正文', () => {
    const h = notify('正在生成摘要…');
    h.setMessage('摘要已生成');
    expect(visibleNotices()[0].querySelector('.bz-notice-msg')!.textContent).toBe(
      '摘要已生成'
    );
  });

  it('setType 接管计时按当前正文长度动态计算（UX 整改 16：progress→success 长文案 60ms/字）', async () => {
    const h = notify('处理中', { type: 'progress' });
    h.setMessage('已为 12 篇笔记生成摘要并补全标签，本次共整理五十字左右的长文本内容。');
    h.setType('success');
    const len = h.el.querySelector('.bz-notice-msg')!.textContent!.length;
    expect(len).toBeGreaterThan(20);
    // base 3000 + (len - 20) × 60，而非固定 3s
    const expected = 3000 + (len - 20) * 60;
    expect(h.el.classList.contains('bz-notice--success')).toBe(true);
    // 到点前仍在（比固定 3s 明显更长）
    await vi.advanceTimersByTimeAsync(expected - 100);
    expect(h.el.isConnected).toBe(true);
    // 到点 + 退出动画后移除
    await vi.advanceTimersByTimeAsync(400);
    expect(h.el.isConnected).toBe(false);
  });

  it('setType 接管计时：短文本仍按类型默认时长（行为保持）', async () => {
    const h = notify('长任务', { type: 'progress' });
    h.setMessage('同步到 50%');
    h.setType('success');
    await vi.advanceTimersByTimeAsync(3300);
    expect(h.el.isConnected).toBe(false);
  });

  it('cleanupNotices（UX 整改 l2-toast）：卸载清理容器 DOM + 存活/去重状态，之后可重建', () => {
    notify('甲', { dedupeKey: 'cleanup-k1' });
    notify('乙', { type: 'progress' }); // 常驻帧（无自动计时）
    expect(visibleNotices()).toHaveLength(2);
    cleanupNotices();
    expect(document.getElementById('bz-notice-container')).toBeNull();
    expect(visibleNotices()).toHaveLength(0);
    // 去重记录一并清空：同键可再次弹出（不再受 30s 窗口抑制）
    notify('甲', { dedupeKey: 'cleanup-k1' });
    expect(visibleNotices()).toHaveLength(1);
    // 幂等：重复调用不抛错
    cleanupNotices();
  });

  it('setProgress：更新进度条宽度；-1 进入不确定态；100 完成变绿', () => {
    const h = notify('向量刷新中', { type: 'progress' });
    const bar = visibleNotices()[0].querySelector('.bz-notice-progress') as HTMLElement;
    expect(bar).not.toBeNull();
    h.setProgress(40);
    expect(bar.style.width).toBe('40%');
    expect(bar.classList.contains('bz-notice-progress--done')).toBe(false);
    h.setProgress(120);
    expect(bar.style.width).toBe('100%');
    expect(bar.classList.contains('bz-notice-progress--done')).toBe(true);
    h.setProgress(-5);
    expect(bar.style.width).toBe('0%');
    expect(bar.classList.contains('bz-notice-progress--done')).toBe(false);
    h.setProgress(-1);
    expect(bar.classList.contains('bz-notice-progress--indeterminate')).toBe(true);
  });

  it('progress 类型默认不自动消失；显式 duration 才计时', async () => {
    notify('长任务', { type: 'progress' });
    await vi.advanceTimersByTimeAsync(10000);
    expect(visibleNotices()).toHaveLength(1);
    // 显式 duration 的 progress 会消失
    notify('限时进度', { type: 'progress', duration: 800 });
    await vi.advanceTimersByTimeAsync(1100);
    expect(visibleNotices()).toHaveLength(1);
  });

  it('操作按钮：点击执行回调并收起通知', async () => {
    const onClick = vi.fn();
    const h = notify('已删除「xx」', {
      title: '剪藏本',
      action: { label: '↩ 撤销', onClick },
    });
    const el = visibleNotices()[0];
    expect(el.querySelector('.bz-notice-title')!.textContent).toBe('剪藏本');
    const btn = el.querySelector('.bz-notice-action') as HTMLButtonElement;
    expect(btn.textContent).toBe('↩ 撤销');
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('按钮点击不触发通知本体关闭（stopPropagation）', () => {
    const h = notify('带按钮', { action: { label: '按钮', onClick: () => {} } });
    const btn = visibleNotices()[0].querySelector('.bz-notice-action') as HTMLButtonElement;
    btn.click();
    // 通知仍存活（按钮点击只执行回调 + 关闭按钮自身逻辑，不依赖 stopPropagation 判定）
    expect(visibleNotices()).toHaveLength(1);
    h.hide();
  });

  it('堆叠上限：超过 5 条挤掉最旧', () => {
    for (let i = 1; i <= 7; i++) notify('第 ' + i + ' 条');
    const els = visibleNotices();
    expect(els).toHaveLength(5);
    // 最旧的 2 条被挤掉，剩第 3~7 条
    expect(els[0].querySelector('.bz-notice-msg')!.textContent).toBe('第 3 条');
    expect(els[4].querySelector('.bz-notice-msg')!.textContent).toBe('第 7 条');
  });

  it('hide() 主动关闭带退出动画', async () => {
    const h = notify('将被隐藏');
    h.hide();
    // 动画期间仍在 DOM（leaving 类）
    expect(visibleNotices()).toHaveLength(1);
    expect(visibleNotices()[0].classList.contains('bz-notice--leaving')).toBe(true);
    await vi.advanceTimersByTimeAsync(250);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('hide 后计时器不重复触发', async () => {
    const h = notify('先手动关');
    h.hide();
    await vi.advanceTimersByTimeAsync(300);
    expect(visibleNotices()).toHaveLength(0);
    // 再推进很久也不报错、不残留
    await vi.advanceTimersByTimeAsync(60000);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('样式收敛（ticket 60）：容器就位且不再运行时注入 style', () => {
    notify('层级测试');
    const container = document.getElementById('bz-notice-container')!;
    expect(container).not.toBeNull();
    // 视觉样式已收敛 styles.css，运行时不得注入 <style>（铁律 9）
    const injected = Array.from(document.querySelectorAll('style')).some(
      (s) => s.getAttribute('data-shared-style') === 'bz-notice'
    );
    expect(injected).toBe(false);
  });

  describe('dedupeKey 去重（同键单框合并）', () => {
    it('窗口内同键重复 → 不新弹，合并更新消息', () => {
      const h1 = notify('第一次失败', { dedupeKey: 'test-sync' });
      const h2 = notify('第二次失败', { dedupeKey: 'test-sync' });
      expect(visibleNotices()).toHaveLength(1);
      expect(visibleNotices()[0].querySelector('.bz-notice-msg')!.textContent).toBe('第二次失败');
      // 返回的 handle 是 no-op，调用安全
      expect(h1).not.toBe(h2);
      h2.setMessage('x');
      h2.setType('success');
      h2.hide();
    });

    it('不同键互不影响', () => {
      notify('A', { dedupeKey: 'key-a' });
      notify('B', { dedupeKey: 'key-b' });
      expect(visibleNotices()).toHaveLength(2);
    });

    it('同键 progress 常驻存活期无限合并（连续任务单框）', async () => {
      notify('第一次', { dedupeKey: 'test-window', type: 'progress' });
      // 推进 10 分钟：常驻 progress 仍存活，同键继续合并
      await vi.advanceTimersByTimeAsync(600000);
      notify('第二次', { dedupeKey: 'test-window', type: 'progress' });
      expect(visibleNotices()).toHaveLength(1);
      expect(visibleNotices()[0].querySelector('.bz-notice-msg')!.textContent).toBe('第二次');
      // 合并时类型可切换（progress → success）
      notify('完成', { dedupeKey: 'test-window', type: 'success' });
      expect(visibleNotices()).toHaveLength(1);
      expect(visibleNotices()[0].classList.contains('bz-notice--success')).toBe(true);
      expect(visibleNotices()[0].querySelector('.bz-notice-msg')!.textContent).toBe('完成');
    });

    it('同键通知已消失后窗口内重复 → 不新弹；窗口过后可再弹', async () => {
      notify('短暂', { dedupeKey: 'test-gone' });
      await vi.advanceTimersByTimeAsync(3300); // 3s 自动消失 + 退出动画
      expect(visibleNotices()).toHaveLength(0);
      notify('窗口内再触发', { dedupeKey: 'test-gone' });
      expect(visibleNotices()).toHaveLength(0); // 窗口内不新弹
      // 窗口过后可再弹
      await vi.advanceTimersByTimeAsync(30000);
      notify('窗口后触发', { dedupeKey: 'test-gone' });
      expect(visibleNotices()).toHaveLength(1);
    });
  });

  describe('常驻帧不被堆叠挤出（P1-33）', () => {
    it('常驻 progress 句柄在 5 条普通 toast 入栈后 setMessage/setType 仍生效且元素在文档中', async () => {
      const h = notify('正在同步', { type: 'progress' }); // progress 默认常驻（不自动消失）
      for (let i = 1; i <= 5; i++) notify('第 ' + i + ' 条');
      // 上限 5 维持：常驻帧豁免驱逐，普通帧照常轮换（最旧的「第 1 条」被挤掉，常驻留下）
      expect(visibleNotices()).toHaveLength(5);
      expect(h.el.isConnected).toBe(true);
      const msgs = visibleNotices().map((el) => el.querySelector('.bz-notice-msg')!.textContent);
      expect(msgs).not.toContain('第 1 条');
      expect(msgs).toContain('第 5 条');
      // 句柄动态能力保持有效
      h.setMessage('同步到 50%');
      expect(h.el.querySelector('.bz-notice-msg')!.textContent).toBe('同步到 50%');
      h.setProgress(50);
      expect(h.el.querySelector('.bz-notice-progress')).not.toBeNull();
      // setType 接管计时（progress → success 后按默认时长自动消失）
      h.setType('success');
      expect(h.el.classList.contains('bz-notice--success')).toBe(true);
      await vi.advanceTimersByTimeAsync(3400);
      expect(h.el.isConnected).toBe(false);
    });

    it('duration<=0 的常驻 info 帧同样不被挤出', () => {
      const h = notify('常驻任务', { duration: 0 });
      for (let i = 1; i <= 5; i++) notify('普通 ' + i);
      expect(visibleNotices()).toHaveLength(5);
      expect(h.el.isConnected).toBe(true);
      const msgs = visibleNotices().map((el) => el.querySelector('.bz-notice-msg')!.textContent);
      expect(msgs).not.toContain('普通 1');
      expect(msgs).toContain('普通 5');
      h.setMessage('仍在运行');
      expect(h.el.querySelector('.bz-notice-msg')!.textContent).toBe('仍在运行');
      // 推进很久也不消失（无计时器），直到主动 hide
      h.hide();
    });

    it('全部为常驻帧时不再挤兑（跳过驱逐，允许超上限）', () => {
      for (let i = 1; i <= 7; i++) notify('常驻 ' + i, { duration: 0 });
      expect(visibleNotices()).toHaveLength(7);
    });
  });
});
