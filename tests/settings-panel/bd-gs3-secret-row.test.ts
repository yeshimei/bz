/**
 * GS3（呈报#48）settings-panel 侧基建回归：「密钥型」输入档位。
 * 基建 = settings-panel schema/渲染器新增 type:'secret' 档位——input type=password
 * 掩码显示 + 眼睛按钮切换明文；提交链（防抖落盘 / 失焦提交 / refreshKey 联动）
 * 与 text 行同内核；样式落域 styles.css。
 * 修复前必红：secretRow/密钥档位不存在，渲染不出掩码输入。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderPanelSchema, secretRow } from '../../src/settings-panel/renderer';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flush = () => new Promise((r) => setTimeout(r, 5));

describe('GS3：设置面板「密钥型」档位', () => {
  let state: Record<string, unknown>;
  let host: HTMLElement;

  const render = () => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    renderPanelSchema(host, {
      groups: [
        {
          icon: 'key-round',
          name: '密钥组',
          rows: [
            secretRow({
              type: 'secret',
              name: '测试密钥',
              desc: '掩码显示的密钥行',
              // 三函数逃生口（键直绑的 key 受 BzSettings 键字面量约束，测试假键走逃生口）
              binding: {
                get: () => String(state.testSecretKey ?? ''),
                set: (v: string) => { state.testSecretKey = v; },
                save: () => {},
              },
              placeholder: '请输入密钥',
            }),
          ],
        },
      ],
    });
  };

  beforeEach(() => {
    resetObsidianMocks();
    state = { testSecretKey: 'sk-abc123' };
    setSettingsProvider(() => state as any);
  });

  it('修复前必红：密钥行渲染为 password 掩码输入 + 眼睛切换钮', () => {
    render();
    const input = host.querySelector('.bz-sp-secret-input') as HTMLInputElement;
    expect(input, '密钥输入框应存在').not.toBeNull();
    expect(input.type).toBe('password'); // 掩码档位（修复前无此档位可渲染）
    expect(input.value).toBe('sk-abc123'); // 绑定值回填
    expect(input.placeholder).toBe('请输入密钥');
    const eye = host.querySelector('.bz-sp-secret-eye') as HTMLButtonElement;
    expect(eye).not.toBeNull();
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    expect(eye.getAttribute('aria-label')).toBe('显示密钥');
  });

  it('眼睛切换：明文 ↔ 掩码往返，aria 态同步；切换不动值不落盘', () => {
    render();
    const input = host.querySelector('.bz-sp-secret-input') as HTMLInputElement;
    const eye = host.querySelector('.bz-sp-secret-eye') as HTMLButtonElement;
    eye.click();
    expect(input.type).toBe('text'); // 明文可见
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(eye.getAttribute('aria-label')).toBe('隐藏密钥');
    expect(state.testSecretKey).toBe('sk-abc123'); // 切换不落盘
    eye.click();
    expect(input.type).toBe('password'); // 回到掩码
    expect(eye.getAttribute('aria-pressed')).toBe('false');
  });

  it('提交链与 text 行同内核：失焦提交落盘（防抖窗口内 blur 立即收口）', async () => {
    render();
    const input = host.querySelector('.bz-sp-secret-input') as HTMLInputElement;
    input.value = 'sk-new-456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    await flush();
    expect(state.testSecretKey).toBe('sk-new-456');
  });

  it('行骨架复用：名称/描述照常渲染（与行类型机制一致）', () => {
    render();
    expect(host.querySelector('.bz-sp-set-name')!.textContent).toBe('测试密钥');
    expect(host.querySelector('.bz-sp-set-desc')!.textContent).toBe('掩码显示的密钥行');
  });

  it('眼睛钮样式与热区契约在域样式表/触控档有定义', () => {
    const css = readFileSync(join(process.cwd(), 'src/settings-panel/styles.css'), 'utf8');
    expect(css).toContain('.bz-sp-secret');
    expect(css).toContain('.bz-sp-secret-eye');
    expect(css).toContain('.bz-sp-secret-eye:focus-visible');
  });
});
