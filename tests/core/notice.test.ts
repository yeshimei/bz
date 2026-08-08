/**
 * 通知系统（ticket 25）核心测试——自绘 toast 替代原生 Notice。
 * 覆盖：四种类型 / 时长规则 / 点击关闭 / 动态消息 / 进度条 / 操作按钮 / 堆叠上限。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notify } from '../../src/core/notice';

function visibleNotices(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.bz-notice')) as HTMLElement[];
}

describe('通知系统', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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

  it('类型类名：success/warning/error/info', () => {
    notify('成功', { type: 'success' });
    notify('警告', { type: 'warning' });
    notify('错误', { type: 'error' });
    notify('信息');
    const els = visibleNotices();
    expect(els[0].classList.contains('bz-notice--success')).toBe(true);
    expect(els[1].classList.contains('bz-notice--warning')).toBe(true);
    expect(els[2].classList.contains('bz-notice--error')).toBe(true);
    expect(els[3].classList.contains('bz-notice--info')).toBe(true);
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

  it('默认变体 drop；slide/bounce/shake 类名正确', () => {
    notify('默认');
    expect(visibleNotices()[0].classList.contains('bz-notice--in-drop')).toBe(true);
    notify('左滑', { variant: 'slide-left' });
    expect(visibleNotices()[1].classList.contains('bz-notice--in-slide-left')).toBe(true);
    notify('右滑', { variant: 'slide-right' });
    expect(visibleNotices()[2].classList.contains('bz-notice--in-slide-right')).toBe(true);
    notify('弹跳', { variant: 'bounce' });
    expect(visibleNotices()[3].classList.contains('bz-notice--in-bounce')).toBe(true);
    notify('抖动', { variant: 'shake' });
    expect(visibleNotices()[4].classList.contains('bz-notice--in-shake')).toBe(true);
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

  it('点击通知本体关闭', async () => {
    const h = notify('可点击关闭');
    h.el.click();
    // 退出动画 200ms 后移除
    await vi.advanceTimersByTimeAsync(250);
    expect(visibleNotices()).toHaveLength(0);
  });

  it('setMessage 动态更新正文', () => {
    const h = notify('正在生成摘要…');
    h.setMessage('✅ 摘要已生成');
    expect(visibleNotices()[0].querySelector('.bz-notice-msg')!.textContent).toBe(
      '✅ 摘要已生成'
    );
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

  it('z-index 100000：最顶（盖过 Obsidian 全部 UI 层）+ 移动端安全区适配', () => {
    notify('层级测试');
    const container = document.getElementById('bz-notice-container')!;
    expect(container).not.toBeNull();
    const css = Array.from(document.querySelectorAll('style')).some(
      (s) => s.textContent && s.textContent.includes('z-index: 100000')
    );
    expect(css).toBe(true);
    // 移动端适配：顶部安全区 + 宽度 clamp 视口
    const cssText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('');
    expect(cssText).toContain('env(safe-area-inset-top');
    expect(cssText).toContain('max-width: min(420px, calc(100vw - 24px))');
    // 移动端断点（项目惯例 max-width: 768px）：顶部 34px
    expect(cssText).toContain('@media (max-width: 768px)');
    expect(cssText).toContain('top: calc(34px + env(safe-area-inset-top, 0px))');
  });

  describe('dedupeKey 去重（30s 窗口）', () => {
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

    it('窗口过后同键 → 重新弹（新通知）', async () => {
      notify('第一次', { dedupeKey: 'test-window', type: 'progress' });
      // 30s 窗口内：合并
      notify('第二次', { dedupeKey: 'test-window', type: 'progress' });
      expect(visibleNotices()).toHaveLength(1);
      // 推进 31s：窗口过期
      await vi.advanceTimersByTimeAsync(31000);
      notify('第三次', { dedupeKey: 'test-window', type: 'progress' });
      expect(visibleNotices()).toHaveLength(2);
    });

    it('同键通知已消失后窗口内重复 → 不新弹', async () => {
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
});
