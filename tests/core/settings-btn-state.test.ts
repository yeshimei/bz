// @vitest-environment jsdom
/**
 * 行内动作钮三态测试（issue 434「测试」钮）：状态机迁移（busy 转圈禁点 / ok 绿框「已连通」/
 * fail 红框 + 简短原因 / idle 复原）、busy 清未决复原柄（结果窗口内再点不被旧柄拍回）、
 * shortFailReason 错误归类（密钥无效 / 超时 / 网络不通 / 响应异常 / 兜底）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ROW_BTN_RESET_MS,
  ROW_BTN_OK_TEXT,
  armRowBtnReset,
  setRowBtnState,
  shortFailReason,
} from '../../src/core/settings-btn-state';

function btn(): HTMLButtonElement {
  return document.createElement('button');
}

describe('core/settings-btn-state', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('setRowBtnState：busy 禁点转圈、ok 绿框已连通、fail 红框原因、idle 复原文案', () => {
    const el = btn();
    setRowBtnState(el, 'busy', '测试');
    expect(el.classList.contains('bz-rowbtn--busy')).toBe(true);
    expect((el as HTMLButtonElement).disabled).toBe(true);
    setRowBtnState(el, 'ok', '测试');
    expect(el.classList.contains('bz-rowbtn--ok')).toBe(true);
    expect(el.textContent).toBe(ROW_BTN_OK_TEXT);
    expect(el.classList.contains('bz-rowbtn--busy')).toBe(false);
    setRowBtnState(el, 'fail', '测试', '密钥无效');
    expect(el.classList.contains('bz-rowbtn--fail')).toBe(true);
    expect(el.textContent).toBe('密钥无效');
    setRowBtnState(el, 'idle', '测试');
    expect(el.textContent).toBe('测试');
    expect(el.className).toBe('');
  });

  it('setRowBtnState：fail 文案缺省「失败」且超 6 字截断', () => {
    const el = btn();
    setRowBtnState(el, 'fail', '测试');
    expect(el.textContent).toBe('失败');
    setRowBtnState(el, 'fail', '测试', '一段特别长的失败原因描述');
    expect(el.textContent!.length).toBeLessThanOrEqual(6);
  });

  it('setRowBtnState：el 缺省安全（undefined 不抛）', () => {
    expect(() => setRowBtnState(undefined, 'ok', '测试')).not.toThrow();
  });

  it('armRowBtnReset：到点自动复原为原文案并重新可点（fake timers）', () => {
    vi.useFakeTimers();
    const el = btn();
    setRowBtnState(el, 'busy', '测试');
    armRowBtnReset(el, '测试');
    expect((el as HTMLButtonElement).disabled).toBe(true);
    vi.advanceTimersByTime(ROW_BTN_RESET_MS + 1);
    expect(el.textContent).toBe('测试');
    expect((el as HTMLButtonElement).disabled).toBe(false);
  });

  it('armRowBtnReset：重复安排以最后一次为准（旧柄不把新一轮拍回 idle）', () => {
    vi.useFakeTimers();
    const el = btn();
    setRowBtnState(el, 'busy', '测试');
    armRowBtnReset(el, '测试');
    // 结果态窗口内再点一轮：busy 清掉旧柄并重新计时
    setRowBtnState(el, 'busy', '测试');
    armRowBtnReset(el, '测试');
    vi.advanceTimersByTime(ROW_BTN_RESET_MS);
    expect(el.textContent).toBe('测试');
  });

  it('shortFailReason：按语义归类为几个字', () => {
    expect(shortFailReason(new Error('Jev API 401: invalid API key'))).toBe('密钥无效');
    expect(shortFailReason(new Error('未配置 博查 密钥（插件设置 → AI → JEV）'))).toBe('无密钥');
    expect(shortFailReason(new Error('Jev 请求超时（10 秒无响应）'))).toBe('超时');
    expect(shortFailReason(new Error('Failed to fetch'))).toBe('网络不通');
    expect(shortFailReason(new Error('Jev 响应缺少 answers 字段（HTTP 200）'))).toBe('响应异常');
    expect(shortFailReason(new Error('不知道的错'))).toBe('请求失败');
    expect(shortFailReason('字符串错误')).toBe('请求失败');
  });
});
