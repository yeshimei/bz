// @vitest-environment jsdom
/**
 * 设置「输入方式」回归（2026-09-23 输入方式体检批）。
 *
 * 1. 掩码档位两端同口径：单行 `type:'secret'` → input type=password + 眼睛切明文
 *    （core 弹窗渲染器 / 面板渲染器）；
 * 2. 键盘语义：TextRow.inputMode 落到 inputmode；
 * 3. 数值参数不再用文本行承载：secondbrain 3 键（issue 424 起）/ knowledge 3 键为 number（带 min/max/step）；
 * 4. 盘点：AI 服务商密钥 3 行（注册表三条在册通道，issue 411/ADR-0179 起）与数据源凭据
 *    3 行（ApiZero Key / B站 Cookie / 豆瓣 Cookie）全为 secret——防回退成明文；多行掩码
 *    （textarea + -webkit-text-security）档位 2026-09-23 随凭据组改单行一并退役。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import type { SettingsSchema, SettingsRow } from '../../src/core/settings-schema';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import { aiSettingsSchema } from '../../src/core/settings-main-schema';
import { secondBrainSettingsSchema } from '../../src/secondbrain/panel';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';

const state: any = {};
const flush = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  for (const k of Object.keys(state)) delete state[k];
  state.secretVal = 'sk-abc123';
  state.areaVal = 'a=b; c=d;',
  state.urlVal = 'https://api.example.com/v1';
  state.numVal = 8;
  state.acted = false;
  setSettingsProvider(() => state);
  setSettingsSaver(async () => {});
});

const strBinding = (key: string) => ({
  get: () => String(state[key] ?? ''), set: (v: string) => { state[key] = v; }, save: () => {},
});
const numBinding = (key: string) => ({
  get: () => Number(state[key] ?? 0), set: (v: number) => { state[key] = v; }, save: () => {},
});

const schema: SettingsSchema = {
  groups: [
    {
      name: '输入档位',
      icon: 'key-round',
      rows: [
        { type: 'secret', name: '测试密钥', desc: '掩码显示的密钥行', binding: strBinding('secretVal'), placeholder: '粘贴密钥' },
        { type: 'textarea', name: '测试多行', desc: '普通多行文本行', binding: strBinding('areaVal') },
        { type: 'text', name: '测试地址', desc: '地址类输入行', binding: strBinding('urlVal'), inputMode: 'url' },
        { type: 'number', name: '测试数量', desc: '数字类输入行', binding: numBinding('numVal'), min: 1, max: 50, step: 1 },
        {
          type: 'secret', name: '测试密钥带钮', desc: '密钥行也能挂行内按钮', binding: strBinding('secretVal'),
          actions: [{ text: '填入', onClick: () => { state.acted = true; } }],
        },
      ] as SettingsRow[],
    },
  ],
};

const renderCore = () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderSettingsInto(host, schema);
  return host;
};
const renderPanel = () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderPanelSchema(host, schema);
  return host;
};

/* ---------------- core 弹窗渲染器 ---------------- */

describe('core 弹窗渲染器（⚙️ 设置弹窗）：掩码 / 键盘语义 / 数字档位', () => {
  it('单行密钥：password 掩码 + 眼睛切明文（切形态不动值）+ aria 同步', () => {
    const host = renderCore();
    const input = host.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input, '应渲染出密码框').not.toBeNull();
    expect(input.value).toBe('sk-abc123'); // 绑定值回填
    expect(input.autocomplete).toBe('off');
    const eye = host.querySelector('button[aria-label="显示密钥"]') as HTMLButtonElement;
    expect(eye, '应渲染出眼睛钮').not.toBeNull();
    expect(eye.getAttribute('aria-pressed')).toBe('false');

    eye.click();
    expect(input.type).toBe('text'); // 明文可见
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(eye.getAttribute('aria-label')).toBe('隐藏密钥');
    expect(state.secretVal).toBe('sk-abc123'); // 只翻形态，不落盘
    eye.click();
    expect(input.type).toBe('password');
  });

  it('多行文本：textarea 形态照常渲染', () => {
    const host = renderCore();
    const ta = host.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta).not.toBeNull();
    expect(ta.value).toBe('a=b; c=d;');
  });

  it('键盘语义：inputMode 落成 inputmode', () => {
    const host = renderCore();
    const input = host.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.getAttribute('inputmode')).toBe('url');
  });

  it('数字档位：min/max/step 落到输入框属性（越界值被钳制）', () => {
    const host = renderCore();
    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('50');
    expect(input.step).toBe('1');
  });
});

/* ---------------- 设置面板渲染器 ---------------- */

describe('设置面板渲染器：掩码档位与数字档位同口径', () => {
  it('单行密钥：password + 眼睛（面板侧既有契约不破）', () => {
    const host = renderPanel();
    const input = host.querySelector('.bz-sp-secret-input') as HTMLInputElement;
    expect(input.type).toBe('password');
    const eye = host.querySelector('.bz-sp-secret-eye') as HTMLButtonElement;
    eye.click();
    expect(input.type).toBe('text');
  });

  it('多行文本：普通 textarea + 提交链照常落盘', async () => {
    const host = renderPanel();
    const ta = host.querySelector('textarea.bz-sp-textarea') as HTMLTextAreaElement;
    expect(ta).not.toBeNull();

    ta.value = 'x=1; y=2;';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('blur'));
    await flush();
    expect(state.areaVal).toBe('x=1; y=2;');
  });

  it('密钥行支持行内按钮（挂得上、点得动）', () => {
    const host = renderPanel();
    const btns = [...host.querySelectorAll('.bz-sp-btn')] as HTMLElement[];
    const btn = btns.find((b) => b.textContent === '填入');
    expect(btn, '密钥行的行内按钮应渲染').toBeTruthy();
    btn!.click();
    expect(state.acted).toBe(true);
  });

  it('数字档位：min/max 落到输入框属性', () => {
    const host = renderPanel();
    const input = host.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.min).toBe('1');
    expect(input.max).toBe('50');
  });
});

/* ---------------- schema 盘点（防回退明文 / 文本承载数值） ---------------- */

/** 盘点用行视图形（custom 行没有 name，故可选） */
type NamedRow = SettingsRow & { name?: string };
const rowsOf = (schema: SettingsSchema, groupName: string): NamedRow[] =>
  (schema.groups.find((g) => g.name === groupName)?.rows ?? []) as NamedRow[];

describe('schema 盘点：凭据一律掩码、数值一律数字档位', () => {
  it('AI 域：服务商密钥 3 行（注册表三条在册通道）+ 数据源凭据 3 行全为 secret', () => {
    const ai = aiSettingsSchema();
    // issue 422：服务商组并入「LLM」组（密钥行仍居组首）
    const providerRows = rowsOf(ai, 'LLM').filter((r) => (r.name ?? '').includes('密钥'));
    expect(providerRows.length, '注册表三条通道各一行').toBe(3);
    expect(providerRows.every((r) => r.type === 'secret')).toBe(true);

    // 数据源凭据组三行一律单行掩码（2026-09-23 用户拍板：加密的一律单行框）
    const credRows = rowsOf(ai, '数据源凭据');
    expect(credRows.map((r) => r.name)).toEqual(['ApiZero Key', 'B站 Cookie', '豆瓣 Cookie']);
    expect(credRows.every((r) => r.type === 'secret')).toBe(true);
  });

  it('第二大脑：检索/对话 3 个数值键是 number 行（键仍存字符串，走 numStrBinding）', () => {
    const schema = secondBrainSettingsSchema();
    const all = schema.groups.flatMap((g) => g.rows as SettingsRow[]);
    const byName = new Map(all.map((r) => [(r as { name?: string }).name, r]));
    // numStrBinding 出的是三函数绑定（无 key 字段），故按行名盘点
    // issue 424/ADR-0184：段落最小长度 / 上下文限制（不再限制）与防抖 / 轮询（固化为常量）四行删除
    const numericNames = ['参考结果数 TopK', '对话参考结果数', '最大历史记录'];
    for (const name of numericNames) {
      const row = byName.get(name);
      expect(row, `${name} 行应存在`).toBeTruthy();
      expect(row!.type, `${name} 应为数字档位`).toBe('number');
      expect((row as { min?: number }).min, `${name} 应有下界`).toBeDefined();
      expect((row as { max?: number }).max, `${name} 应有上界`).toBeDefined();
      expect(typeof (row as { binding?: { get?: unknown } }).binding?.get, `${name} 应走 numStrBinding`).toBe('function');
    }
  });

  it('第二大脑：Embedding 模型行已迁出（唯一入口 = AI 面板 Embedding 组，issue 422/ADR-0182）', () => {
    const schema = secondBrainSettingsSchema();
    const names = schema.groups.flatMap((g) => g.rows.map((r) => (r as { name?: string }).name));
    expect(names).not.toContain('Embedding 模型');
    // 同键不得两处并存（迁移无残留）：服务组只剩连接面三行 + 额外目录
    const keys = schema.groups.flatMap((g) =>
      g.rows.map((r) => (r as { binding?: { key?: string } }).binding?.key).filter(Boolean)
    );
    expect(keys).not.toContain('secondBrainEmbeddingModel');
  });

  it('第二大脑：Ollama 地址 / IP 自查行全部退场（issue 424/ADR-0184：全自动，本页零连接面）', () => {
    const schema = secondBrainSettingsSchema();
    const names = schema.groups.flatMap((g) => g.rows.map((r) => (r as { name?: string }).name));
    expect(names).not.toContain('Ollama 本地 URL');
    expect(names).not.toContain('移动端远程地址');
    // IP 探测与远程地址写入改全自动（桌面端启动跟随本机 IP），两行自查/一键修正入口删除
    expect(names).not.toContain('本机局域网 IP');
    expect(names).not.toContain('局域网 IP 提示');
    // 键迁移无残留（本页只剩额外检索目录）：两键不再由第二大脑 schema 持有
    const keys = schema.groups.flatMap((g) =>
      g.rows.map((r) => (r as { binding?: { key?: string } }).binding?.key).filter(Boolean)
    );
    expect(keys).not.toContain('secondBrainOllamaUrl');
    expect(keys).not.toContain('secondBrainRemoteOllamaUrl');
  });

  it('AI 面板 Embedding 组：本地 Ollama 地址以 URL 键盘档位承接（issue 424 反向锚，远程地址行已删）', () => {
    const rows = rowsOf(aiSettingsSchema(), 'Embedding');
    const urls = rows.filter((r) => (r.name ?? '').includes('URL') || (r.name ?? '').includes('远程地址'));
    expect(urls.map((r) => r.name)).toEqual(['Ollama 本地 URL']);
    expect(urls.map((r) => (r as { inputMode?: string }).inputMode)).toEqual(['url']);
  });

  it('知识盒：自动关联三键是 number 直绑（三函数绕行已退场）', () => {
    const schema = knowledgeSettingsSchema();
    const all = schema.groups.flatMap((g) => g.rows as SettingsRow[]);
    for (const [key, min] of [['linkAgentTopK', 1], ['linkAgentMaxLinks', 0], ['linkAgentMinScore', 0]] as const) {
      const row = all.find((r) => (r as { binding?: { key?: string } }).binding?.key === key);
      expect(row, `${key} 行应存在`).toBeTruthy();
      expect(row!.type).toBe('number');
      expect((row as { min?: number }).min).toBe(min as number);
    }
  });
});
