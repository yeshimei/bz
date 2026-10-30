// @vitest-environment jsdom
/**
 * 「关于」组（core/about-group.ts）：通用页最上面那一组。
 *
 * 测的是**文案口径**（版本行最容易骗人的地方）与组形状：
 *  - 待重载要写清「已下载 vX，重载后生效」——否则用户看到「更新了但版本没变」；
 *  - 发现新版、检查失败各有一句；
 *  - 组里必须有版本 / 自动更新 / 反馈 / 打赏四行，且**自动更新默认关**（对外分发的缺省）。
 */
import { describe, it, expect } from 'vitest';
import { versionDesc, FEEDBACK_URL } from '../../src/core/about-group';
import type { SelfUpdateState } from '../../src/core/self-update';

function stateOf(over: Partial<SelfUpdateState> = {}): SelfUpdateState {
  return { running: '1.33.0', onDisk: '1.33.0', available: null, pending: null, error: null, checkedAt: 0, ...over };
}

describe('versionDesc：版本行说人话', () => {
  it('普通态只说版本号', () => {
    expect(versionDesc(stateOf())).toBe('v1.33.0');
  });

  it('已下载待重载 → 明确说「重载后生效」（自更新不重载时版本号不变，这是最容易误解的一态）', () => {
    expect(versionDesc(stateOf({ onDisk: '1.34.0', pending: '1.34.0' }))).toBe(
      'v1.33.0，已下载 v1.34.0，重载后生效',
    );
  });

  it('发现新版但没装 → 点名新版号', () => {
    expect(versionDesc(stateOf({ available: { version: '1.34.0', tag: 'v1.34.0', at: 1 } }))).toBe(
      'v1.33.0，有新版本 v1.34.0',
    );
  });

  it('检查失败 → 说失败，不装作「已是最新」', () => {
    expect(versionDesc(stateOf({ error: 'offline' }))).toBe('v1.33.0，上次检查更新失败');
  });

  it('待重载优先于「有新版本」（已经下来了，剩下的事是重载）', () => {
    const s = stateOf({
      onDisk: '1.34.0',
      pending: '1.34.0',
      available: { version: '1.34.0', tag: 'v1.34.0', at: 1 },
    });
    expect(versionDesc(s)).toContain('重载后生效');
  });

  it('版本号拿不到时说「版本未知」，不显示一个空的 v', () => {
    expect(versionDesc(stateOf({ running: '', onDisk: '' }))).toBe('版本未知');
  });
});

describe('反馈渠道', () => {
  it('直接指向仓库的 issues（与下载通道同一个 slug，不另立一处字面量）', () => {
    expect(FEEDBACK_URL).toBe('https://github.com/yeshimei/bz/issues');
  });
});

/* ------------------------------------------------------------------
 * 「检查并更新」按钮：2026-10-28 用户实测「点了没有任何反应和提示」。
 * 三处根因各钉一条：
 *  ① info 行的 actions 没接 stateful（按钮不转圈、不显示结果）；
 *  ② requestUrl 没有超时（网络半通时永远不 resolve）；
 *  ③ 点到之后没有任何即时可感知的东西。
 * ------------------------------------------------------------------ */
import { beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, clearNotices } from '../mock-obsidian-entry';
import { MockVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setPluginRelDir } from '../../src/core/plugin-path';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { aboutGroup, runCheckAndUpdate } from '../../src/core/about-group';
import { resetSelfUpdateState } from '../../src/core/self-update';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import type { InfoRow } from '../../src/core/settings-schema';

const LOCAL = '1.33.0';

function appWith(version = LOCAL): { vault: MockVault } {
  const vault = new MockVault();
  vault.files.set('.obsidian/plugins/bz/manifest.json', JSON.stringify({ id: 'bz', version }));
  const app = { vault, plugins: { manifests: { bz: { version } } }, workspace: {} };
  setApp(app as never);
  return { vault };
}

beforeEach(() => {
  resetObsidianMocks();
  resetSelfUpdateState();
  clearNotices();
  document.body.innerHTML = '';
  setPluginRelDir(null); // 别的用例注入过目录时别串味
  setSettingsProvider(() => ({}) as never);
  vi.mocked(requestUrl).mockReset();
  try {
    localStorage.clear();
  } catch {
    /* jsdom 一定有 */
  }
});

describe('版本行的动作声明', () => {
  it('stateful + 自带成功文案（缺省那句「已连通」说的是连通性，不是版本）', async () => {
    appWith();
    const g = await aboutGroup();
    const row = g.rows.find((r) => r.type === 'info' && r.name === '版本') as InfoRow;
    const a = row.actions![0];
    expect(a.text).toBe('检查并更新');
    expect(a.stateful).toBe(true);
    expect(a.okText).toBe('已是最新');
  });
});

describe('点下去立刻有反馈（不是等结果才说话）', () => {
  it('调用同步段就弹出「正在检查更新…」常驻通知，结束后原地变「已是最新版本」', async () => {
    appWith();
    vi.mocked(requestUrl).mockImplementation((async () => ({
      status: 200,
      text: JSON.stringify({ version: LOCAL, tag: 'v1.33.0' }),
    })) as never);

    const p = runCheckAndUpdate();
    // 还没 await 就已经有可见提示——这是「点了没反应」的直接解药
    expect(document.body.textContent).toContain('正在检查更新');
    await p;
    expect(document.body.textContent).toContain('已是最新版本 v1.33.0');
  });

  it('失败 → 通知说原因，异常抛给渲染器（按钮画红✕ + 短原因）', async () => {
    appWith();
    vi.mocked(requestUrl).mockRejectedValue(new Error('offline'));
    await expect(runCheckAndUpdate()).rejects.toThrow();
    expect(document.body.textContent).toContain('检查更新失败');
    expect(document.body.textContent).toContain('offline');
  });
});

describe('info 行的 stateful 钮（渲染器）', () => {
  it('点击 → busy 转圈禁用；完成后 → 绿✓ + okText', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let done = false;
    const schema = {
      groups: [
        {
          name: '关于',
          rows: [
            {
              type: 'info' as const,
              name: '版本',
              desc: 'v1.33.0',
              actions: [
                {
                  text: '检查并更新',
                  stateful: true,
                  okText: '已是最新',
                  onClick: async () => {
                    done = true;
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    renderPanelSchema(el, schema as never);
    const btn = el.querySelector('.bz-sp-btn') as HTMLButtonElement;
    expect(btn.textContent).toContain('检查并更新');
    btn.click();
    // 同步段：立刻进 busy（禁用 + 转圈类），而不是等到结果才变
    expect(btn.classList.contains('bz-rowbtn--busy')).toBe(true);
    expect(btn.disabled).toBe(true);
    await vi.waitFor(() => expect(done).toBe(true));
    await vi.waitFor(() => {
      expect(btn.classList.contains('bz-rowbtn--ok')).toBe(true);
      expect(btn.textContent).toContain('已是最新');
    });
  });
});
