// @vitest-environment node
/**
 * 声明式设置 schema 数据层测试（ticket 131，ADR-0064）：主设置页 schema 结构与 visibleWhen 口径 /
 * 存储路径 onCommit 文案冻结 / 通用组预设（移动端默认全屏）结构与 isMobileEnv 联动 /
 * 数字钳制纯函数 / SettingsKeyOfType 键收窄样例。node 环境（不触 DOM）。
 */
import { describe, it, expect } from 'vitest';
import { Platform } from '../mock-obsidian-entry';
import { mainSettingsSchema, STORAGE_PATH_COMMIT_NOTICE } from '../../src/core/settings-main-schema';
import { AI_PROVIDER_REGISTRY } from '../../src/core/ai';
import { parseClampedNumber } from '../../src/core/settings-schema';
import type { SettingsSchema, SettingsSnapshot, SettingsKeyOfType } from '../../src/core/settings-schema';

/** 合成快照（只取 visibleWhen 用到的字段，免造全量设置） */
function snapOf(partial: Partial<SettingsSnapshot>): SettingsSnapshot {
  return partial as SettingsSnapshot;
}

describe('mainSettingsSchema：主设置页区块（issue 422 起 AI 页按模型族分组；issue 444 增语音转写）', () => {
  const schema = mainSettingsSchema();

  it('issue 444：七个分组卡片（带 icon）——LLM/Embedding/JEV/语音转写/数据源凭据 + 数据存储路径 + 通知', () => {
    // issue 473：「使用手册」组撤出（入口搬设置面板侧栏 footer），恢复真·七个分组
    expect(schema.groups.map((g) => g.name)).toEqual(['LLM', 'Embedding', 'JEV', '语音转写', '数据源凭据', '数据存储路径', '通知']);
    expect(schema.groups.map((g) => g.icon)).toEqual(['cpu', 'binary', 'route', 'mic', 'key-round', 'folder-open', 'bell']);
  });

  it('LLM 组首部（前「服务商」组，issue 411/ADR-0179 收敛三条通道）：服务商下拉 + 每家一行密钥（visibleWhen 随 aiProvider）', () => {
    // issue 422/ADR-0182：「服务商」组撤销并入 LLM 组首部——先选通道与密钥，再配该通道的模型参数
    const rows = schema.groups[0].rows.slice(0, 1 + AI_PROVIDER_REGISTRY.length);
    // 行序 = 服务商下拉 + 注册表每条通道一行密钥（custom 的端点/密钥两行已随通道退役）。
    // 凭据行全走「密钥型」档位（type:'secret' → password 掩码 + 眼睛切明文）
    expect(rows.map((r) => r.type)).toEqual(['select', 'secret', 'secret', 'secret']);
    // 密钥行标题来自注册表 apiKeyLabel（顺序与注册表一致）
    expect(rows.map((r) => (r as { name: string }).name)).toEqual([
      'AI 服务商',
      ...AI_PROVIDER_REGISTRY.map((p) => p.apiKeyLabel),
    ]);
    const [provider, ...keyRows] = rows as Array<{
      binding?: { key: string };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
      options?: Array<{ value: string; label: string }>;
    }>;
    expect(provider.binding).toEqual({ key: 'aiProvider' });
    // 下拉选项 = 注册表（新增通道零 schema 改动）
    expect(provider.options).toEqual(AI_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })));
    // 每家的密钥行：键直绑 apiKeyKey + visibleWhen 跟随 aiProvider（互斥显隐）
    AI_PROVIDER_REGISTRY.forEach((p, i) => {
      expect(keyRows[i].binding).toEqual({ key: p.apiKeyKey });
      expect(keyRows[i].visibleWhen!(snapOf({ aiProvider: p.id }))).toBe(true);
      const other = AI_PROVIDER_REGISTRY.find((x) => x.id !== p.id)!;
      expect(keyRows[i].visibleWhen!(snapOf({ aiProvider: other.id }))).toBe(false);
    });
  });

  it('LLM 组模型行（原「模型配置」组）：模型名称 + 最大输出 token + 思考档位（issue 411 起选项随服务商换表）', () => {
    const rows = schema.groups[0].rows.slice(1 + AI_PROVIDER_REGISTRY.length) as Array<{
      name: string;
      type: string;
      binding?: { key: string } | { get: () => unknown; set: (v: unknown) => void; save: () => unknown };
      visibleWhen?: (s: SettingsSnapshot) => boolean;
      refreshKey?: unknown;
    }>;
    expect(rows.map((r) => r.name)).toEqual(['模型名称', '最大输出 token', '思考 reasoning']);
    expect(rows.map((r) => r.type)).toEqual(['text', 'number', 'select']);
    // 三行都是 per-provider 行：三函数绑定（不用 key 直绑）+ refreshKey 随服务商联动
    rows.forEach((r) => {
      expect(r.visibleWhen).toBeUndefined();
      expect(typeof r.refreshKey).toBe('function');
      expect('key' in r.binding!).toBe(false);
      expect('get' in r.binding!).toBe(true);
    });
    // 模型行内嵌「获取模型名」按钮
    expect((rows[0] as any).actions?.map((a: { text: string }) => a.text)).toEqual(['获取模型名']);
    // 思考档位（issue 411/ADR-0179）：options 为函数——按当前服务商取其档位表（core/ai 单源），
    // 值存 aiThinkingOverrides[provider]（三函数绑定）
    const thinkingRow = rows[2] as unknown as {
      binding: { get: () => string; set: (v: string) => void; save: () => unknown };
      visibleWhen?: unknown;
      refreshKey: unknown;
      options: (s: SettingsSnapshot) => Array<{ value: string; label: string }>;
    };
    expect(typeof thinkingRow.binding.get).toBe('function');
    expect(typeof thinkingRow.binding.set).toBe('function');
    expect(typeof thinkingRow.refreshKey).toBe('function');
    const valuesOf = (provider: string) =>
      thinkingRow.options(snapOf({ aiProvider: provider })).map((o) => o.value);
    expect(valuesOf('deepseek')).toEqual(['auto', 'off', 'low', 'high', 'max']); // 有「关闭」，无「中」
    expect(valuesOf('zhipu-plan')).toEqual(['auto', 'low', 'high', 'max']); // 强制思考：无「关闭」
    expect(valuesOf('ollama')).toEqual(['auto', 'off', 'low', 'medium', 'high']); // 走 reasoning_effort
  });

  it('Embedding 组（issue 422/ADR-0182 + 424/ADR-0184 + 427/ADR-0186 + 429 + 431/ADR-0189）：地址 / 模型 / 重排总闸 / 重排走 Jev / 重排模型五行', () => {
    const rows = schema.groups[1].rows as Array<{
      name: string;
      type: string;
      desc?: string;
      placeholder?: string;
      binding?: { key: string };
      actions?: Array<{ text: string }>;
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    // issue 424：第二行「移动端远程地址」删除（桌面端启动自动跟随本机 IP，无人看/改）
    // issue 427/429：第三行「启用重排」+ 第四行「重排模型」
    // issue 431/ADR-0189：第四行改「重排走 Jev」（通道二选一），「重排模型」退居第五行（本地通道专属）
    expect(rows.map((r) => r.name)).toEqual([
      'Ollama 本地 URL',
      'Embedding 模型',
      '启用重排',
      '重排走 Jev',
      '重排模型',
    ]);
    expect(rows.map((r) => r.type)).toEqual(['text', 'text', 'toggle', 'toggle', 'text']);
    expect(rows.map((r) => r.binding)).toEqual([
      { key: 'secondBrainOllamaUrl' },
      { key: 'secondBrainEmbeddingModel' },
      { key: 'secondBrainRerank' },
      { key: 'secondBrainRerankJev' },
      { key: 'secondBrainRerankModel' },
    ]);
    // 各键的消费口径零改动（secondbrain/config.ts / vector-store / ai-models 读取路径不变）
    expect(rows[1].actions?.map((a) => a.text)).toEqual(['获取模型']);
    expect(rows[1].desc).toBe('向量化使用的嵌入模型');
    // 重排模型行：同款「获取模型」弹窗（issue 429）；留空 = 回落到内置默认
    expect(rows[4].actions?.map((a) => a.text)).toEqual(['获取模型']);
    expect(rows[4].placeholder).toBe('dengcao/Qwen3-Reranker-4B:Q4_K_M');
    expect(rows[4].desc).toBe('重排通道使用的模型');
    // 重排总闸常显（issue 431/ADR-0189）：8B 门收窄给本地通道，总闸不再绑嵌入模型；
    // 「总闸开着但无通道生效」的空转状态靠 desc 静态交代（Q7：本地需 8B / Jev 需 JEV 组密钥）
    expect(rows[2].visibleWhen).toBeUndefined();
    expect(rows[2].desc).toBe('召回结果再精排，相关笔记排序更准');
    // 「重排走 Jev」行：总闸开才显示（通道选择只在重排开启时有意义）
    const jevRowVisible = (s: Record<string, unknown>) => rows[3].visibleWhen?.(snapOf(s)) === true;
    expect(jevRowVisible({ secondBrainRerank: true })).toBe(true);
    expect(jevRowVisible({ secondBrainRerank: false })).toBe(false);
    expect(jevRowVisible({})).toBe(true); // 键缺省 = 总闸默认开
    // 重排模型行（本地通道专属）：8B 嵌入 ∧ 总闸非关 ∧ Jev 关——Jev 开时隐藏（二选一，无暗态）
    const modelRowVisible = (s: Record<string, unknown>) => rows[4].visibleWhen?.(snapOf(s)) === true;
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'qwen3-embedding:8b', secondBrainRerank: true })).toBe(true);
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'qwen3-embedding:8b', secondBrainRerank: true, secondBrainRerankJev: false })).toBe(true);
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'qwen3-embedding:8b', secondBrainRerank: true, secondBrainRerankJev: true })).toBe(false);
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'qwen3-embedding:8b', secondBrainRerank: false })).toBe(false);
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'bge-m3', secondBrainRerank: true })).toBe(false);
    expect(modelRowVisible({ secondBrainEmbeddingModel: 'bge-m3', secondBrainRerank: true, secondBrainRerankJev: true })).toBe(false);
    // 反向断言（第二大脑设置页不再有这些行）在 settings-input-modes.test.ts 的 secondbrain 盘点里
  });

  it('JEV 组（issue 424/ADR-0184 收口；issue 430 两家；issue 433 分存 + 测试钮）：三行制不变', () => {
    const rows = schema.groups[2].rows as Array<{
      name: string;
      type: string;
      desc?: string;
      binding?: { key: string } | { get: () => string; set: (v: string) => void; save: () => void };
      placeholder?: string;
      visibleWhen?: unknown;
      refreshKey?: unknown;
      actions?: Array<{ text: string }>;
      options?: Array<{ value: string; label: string }>;
    }>;
    expect(rows.map((r) => r.name)).toEqual(['Jev 服务商', 'Jev 密钥', 'Jev 模型']);
    expect(rows.map((r) => r.type)).toEqual(['select', 'secret', 'text']);
    // 服务商行仍键绑定；密钥/模型行改三函数绑定（读写当前服务商槽位，issue 433）并带 refreshKey 联动
    expect(rows[0].binding).toEqual({ key: 'jevProvider' });
    expect(typeof (rows[1].binding as { get: unknown }).get).toBe('function');
    expect(typeof (rows[2].binding as { get: unknown }).get).toBe('function');
    expect(typeof rows[1].refreshKey).toBe('function');
    expect(typeof rows[2].refreshKey).toBe('function');
    // 服务商下拉由注册表驱动（issue 430 起两家：Typesafe + 博查）；无 visibleWhen——常开，不再挂在总开关下
    expect(rows[0].options).toEqual([
      { value: 'typesafe', label: 'Typesafe' },
      { value: 'bocha', label: '博查' },
    ]);
    rows.forEach((r) => expect(r.visibleWhen).toBeUndefined());
    // 密钥行内嵌「测试」（发一次真实判定请求）；模型行内嵌「获取模型」（照 Embedding 模型行范式）
    expect(rows[1].actions?.map((a) => a.text)).toEqual(['测试']);
    expect(rows[2].actions?.map((a) => a.text)).toEqual(['获取模型']);
    expect(rows[2].placeholder).toBe('jev-latest');
  });

  it('语音转写组（issue 444）：转写引擎下拉恒显 + Whisper 档位仅 faster-whisper 时显示', () => {
    const rows = schema.groups[3].rows as Array<{
      name: string;
      type: string;
      desc?: string;
      binding?: { key: string };
      options?: Array<{ value: string; label: string }> | ((s: SettingsSnapshot) => Array<{ value: string; label: string }>);
      visibleWhen?: (s: SettingsSnapshot) => boolean;
    }>;
    expect(rows.map((r) => r.name)).toEqual(['转写引擎', 'Whisper 档位']);
    expect(rows.map((r) => r.type)).toEqual(['select', 'select']);
    // 引擎行：键直绑 asrEngine，两档（SenseVoice 缺省在前）
    expect(rows[0].binding).toEqual({ key: 'asrEngine' });
    expect(rows[0].options).toEqual([
      { value: 'sensevoice', label: 'SenseVoice-Small' },
      { value: 'faster-whisper', label: 'faster-whisper' },
    ]);
    expect(rows[0].visibleWhen).toBeUndefined();
    // 档位行：键直绑 asrWhisperModel，六档（faster-whisper 实际可用档），缺省 small 在选项表内
    expect(rows[1].binding).toEqual({ key: 'asrWhisperModel' });
    const tierOptions = rows[1].options as Array<{ value: string }>;
    expect(tierOptions.map((o) => o.value)).toEqual(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3']);
    // visibleWhen：仅引擎 = faster-whisper 时显示（SenseVoice 模型固定无档位）
    const visible = (s: Record<string, unknown>) => rows[1].visibleWhen?.(snapOf(s)) === true;
    expect(visible({ asrEngine: 'faster-whisper' })).toBe(true);
    expect(visible({ asrEngine: 'sensevoice' })).toBe(false);
    expect(visible({})).toBe(false); // 键缺省 = sensevoice，档位行隐藏
  });

  it('数据源凭据组（issue 331 拆组）：三行统一单行 secret（ApiZero Key → B站 Cookie → 豆瓣 Cookie）；桌面端 B站行带「从 CLI 导入」', () => {
    const rows = schema.groups[4].rows;
    // 2026-09-23 用户报「加密的做成多行框看着怪」：textarea 的多行掩码档位退役，
    // 三行凭据一律单行 secret（password 掩码 + 眼睛切明文）
    expect(rows.map((r) => r.type)).toEqual(['secret', 'secret', 'secret']);
    const [apizero, bili, douban] = rows as Array<{
      name: string;
      binding?: { key: string };
      actions?: Array<{ text: string }>;
      placeholder?: string;
    }>;
    expect([apizero.name, bili.name, douban.name]).toEqual(['ApiZero Key', 'B站 Cookie', '豆瓣 Cookie']);
    expect(apizero.binding).toEqual({ key: 'cinemaApizeroKey' });
    expect(bili.binding).toEqual({ key: 'bilibiliCookie' });
    expect(douban.binding).toEqual({ key: 'cinemaDoubanCookie' });
    // 非桌面（node 环境无 window.require）：CLI 导入按钮不渲染（ADR-0133 零依赖判定口径）
    expect(bili.actions).toEqual([]);
    // 桌面端：按钮在场（secret 行 actions 与 text 行同口径）
    (globalThis as unknown as { window: unknown }).window = { require: () => ({}) };
    try {
      const desktopRows = mainSettingsSchema().groups[4].rows as Array<{
        name: string;
        actions?: Array<{ text: string }>;
      }>;
      expect(desktopRows.find((r) => r.name === 'B站 Cookie')?.actions?.map((a) => a.text)).toEqual(['从 CLI 导入']);
    } finally {
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });

  it('数据存储路径区块：path 单选行（键直绑）+ onCommit 提示文案逐字冻结', () => {
    // 按组名取（不按下标）：该组下标随 AI 分区组数变化而漂移（issue 444 起 AI 区 5 组）
    const row = schema.groups.find((g) => g.name === '数据存储路径')!.rows[0] as {
      type: string;
      mode: string;
      name: string;
      binding: { key: string };
      onCommit?: () => void;
    };
    expect(row.type).toBe('path');
    expect(row.mode).toBe('single');
    expect(row.name).toBe('数据存储路径');
    expect(row.binding).toEqual({ key: 'storagePath' });
    expect(typeof row.onCommit).toBe('function');
    expect(STORAGE_PATH_COMMIT_NOTICE).toBe(
      '存储路径已修改：仅改路径，文件不会自动迁移，旧数据需自行迁移；重载插件后生效。'
    );
  });
});

describe('SettingsKeyOfType 键收窄样例', () => {
  it('布尔行接受布尔键（类型层样例，运行时核对键名）', () => {
    const boolKey: SettingsKeyOfType<boolean> = 'useFileDateTime';
    const strKey: SettingsKeyOfType<string> = 'bookshelfFolderPath';
    const numKey: SettingsKeyOfType<number> = 'reviewDailyLimit';
    const listKey: SettingsKeyOfType<string[]> = 'reviewWatchedFolders';
    expect([boolKey, strKey, numKey, listKey]).toEqual([
      'useFileDateTime',
      'bookshelfFolderPath',
      'reviewDailyLimit',
      'reviewWatchedFolders',
    ]);
  });
});

describe('parseClampedNumber：数字解析与钳制', () => {
  it('常规解析、min/max 钳制、脏值拒绝', () => {
    expect(parseClampedNumber('5')).toBe(5);
    expect(parseClampedNumber('3.5')).toBe(3.5);
    expect(parseClampedNumber(' 8 ')).toBe(8);
    expect(parseClampedNumber('999', 0, 100)).toBe(100);
    expect(parseClampedNumber('-5', 0)).toBe(0);
    expect(parseClampedNumber('200', 0, 100)).toBe(100);
    expect(parseClampedNumber('abc')).toBeNull();
    expect(parseClampedNumber('')).toBeNull();
    expect(parseClampedNumber('   ')).toBeNull();
    expect(parseClampedNumber('Infinity')).toBeNull();
  });
});

describe('空 schema 与未知绑定形态', () => {
  it('groups 为空的 schema 结构合法（渲染层行为由 UI 测试覆盖）', () => {
    const schema: SettingsSchema = { groups: [] };
    expect(schema.groups.length).toBe(0);
  });
});
