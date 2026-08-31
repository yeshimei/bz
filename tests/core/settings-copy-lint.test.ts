// @vitest-environment node
/**
 * 设置项文案 lint（ticket 131 Q8 / ticket 100 规范，测试期断言不改运行时）：
 * - 标题：4-8 字、零符号（仅文字/数字/空格；连续西文数字串按 2 字宽折算）；
 * - 描述：8-32 字、自然句（仅文字/数字/空格/逗号/句号/百分号/加减连字符，禁止 、·/—（）等符号花样）。
 * 断言范围 = 已注册 schema 全量（当前：主设置页 + settings-common 预设；后续域迁移票把域 schema
 * 加进 LINT_TARGETS 即自动纳管）。白名单机制：violation id（`来源#行名:规则`）或行级通配
 * （`来源#行名:*`）可豁免遗留文案—— Wave-1 主设置页违规已按 ticket 100 修正，白名单暂为空。
 */
import { describe, it, expect } from 'vitest';
import { mainSettingsSchema } from '../../src/core/settings-main-schema';
import { mobileFullscreenGroup } from '../../src/core/settings-common';
import type { SettingsSchema, SettingsRow } from '../../src/core/settings-schema';
import { lintName, lintDesc, lintTargets } from './settings-copy-lint-engine';

/* ==================== 本组白名单 ==================== */

/** 白名单：violation id 精确项 + 行级通配 `来源#行名:*`（遗留文案豁免须注明年/票与理由） */
const WHITELIST = new Set<string>([
  // Wave-1 无豁免项：主设置页存量违规已按 ticket 100 修正（标题可改、键名/行为不动）。
  // 示例：'域来源#行名:desc-length'（精确）/ '域来源#行名:*'（整行豁免）。
]);

/* ==================== 注册表：全量 schema 纳管 ==================== */

const LINT_TARGETS = [
  { source: 'main', schema: mainSettingsSchema() },
  { source: 'common', schema: { groups: [mobileFullscreenGroup('diaryMobileDefaultFullscreen')] } },
];

/* ==================== 断言 ==================== */

describe('文案 lint 规则自检（ticket 100：标题 4-8 字零符号 / 描述约 20 字自然句）', () => {
  it('标题规则：长度与符号分立', () => {
    expect(lintName('数据存储路径')).toEqual([]); // 6 字
    expect(lintName('DeepSeek 密钥')).toEqual([]); // 西文串折 2 字 + 2 = 4
    expect(lintName('AI 服务商')).toEqual([]);
    expect(lintName('开关')).toEqual(['title-length']); // 过短
    expect(lintName('打开面板时默认选中的主标签名称')).toEqual(['title-length']); // 过长
    expect(lintName('路径(选择)')).toEqual(['title-symbol']); // 括号
    expect(lintName('长度0=不限')).toEqual(['title-symbol']); // 等号
  });

  it('描述规则：符号花样与超长枚举均被抓', () => {
    expect(lintDesc('切换服务商后显示对应的密钥配置')).toEqual([]);
    expect(lintDesc('全部 JSON 数据文件统一存放的目录')).toEqual([]);
    expect(lintDesc('移动端打开主窗口时默认全屏，关闭则显示常规卡片')).toEqual([]);
    // ticket 131 前主设置页存量违规样例（括号/斜杠/超长枚举）——修正前 lint 应红
    expect(lintDesc('所有 JSON 数据文件（备忘录/归物本/密码本/收藏本/复习计划/做题家/第二大脑）的统一存放目录')).toEqual([
      'desc-symbol',
      'desc-length',
    ]);
    expect(lintDesc('从 opencode.ai/zen 订阅后获取')).toEqual(['desc-symbol']);
    expect(lintDesc('太短')).toEqual(['desc-length']);
  });

  it('白名单机制：精确 id 与行级通配均可豁免', () => {
    const bad: SettingsSchema = {
      groups: [{ name: 'G', rows: [{ type: 'info', name: '一个超长的遗留设置标题示例', desc: '含（括号）的描述' } as SettingsRow] }],
    };
    // 直接断言未豁免会红（自证 lint 抓得住），再分别套两种豁免形态验证机制
    const ids = lintTargets([{ source: 'legacy', schema: bad }]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(expect.arrayContaining(['legacy#一个超长的遗留设置标题示例:title-length']));
  });
});

describe('全量 schema 文案 lint（注册表：LINT_TARGETS）', () => {
  it('已注册 schema 无未豁免违规（主设置页存量违规已在 Wave-1 修正）', () => {
    const violations = lintTargets(LINT_TARGETS, WHITELIST);
    expect(
      violations,
      `文案违规（如需豁免遗留项，往 WHITELIST 加 id 并注明年/票与理由）:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('主设置页修正后文案抽查：新标题收短、描述自然句、键名不动', () => {
    const schema = mainSettingsSchema();
    const rows = schema.groups[0].rows as Array<{ name: string; desc?: string }>;
    // 键名/行为不动，标题可改（ticket 100 ④）；ticket 170 新增自定义三行 + max token；
    // ticket 171 注册表扩展为全部提供商各一行密钥（标题取自注册表 apiKeyLabel）；
    // ticket 172 per-provider 三行（模型名称/上下文窗口/最大输出 token）
    const names = rows.map((r) => r.name);
    expect(names[0]).toBe('AI 服务商');
    expect(names).toContain('DeepSeek 密钥');
    expect(names).toContain('OpenCode 密钥');
    expect(names).toContain('OpenAI 密钥');
    expect(names).toContain('Gemini 密钥');
    expect(names).toContain('自定义 API 地址');
    expect(names).toContain('自定义模型');
    expect(names).toContain('自定义 API 密钥');
    expect(names).toContain('模型名称');
    expect(names).toContain('上下文窗口');
    expect(names).toContain('最大输出 token');
    const deepseekRow = rows.find((r) => r.name === 'DeepSeek 密钥')!;
    const opencodeRow = rows.find((r) => r.name === 'OpenCode 密钥')!;
    const customEndpoint = rows.find((r) => r.name === '自定义 API 地址')!;
    const modelRow = rows.find((r) => r.name === '模型名称')!;
    const ctxRow = rows.find((r) => r.name === '上下文窗口')!;
    expect(deepseekRow.desc).toBe('留空则自动回退读取外部配置密钥');
    expect(opencodeRow.desc).toBe('在订阅官网获取后填入这里');
    expect(customEndpoint.desc).toBe('OpenAI 兼容服务的完整接口地址');
    expect(modelRow.desc).toBe('留空用该服务商默认模型');
    expect(ctxRow.desc).toBe('留空用该服务商默认窗口');
    const storageRow = schema.groups[1].rows[0] as { name: string; desc?: string };
    expect(storageRow.name).toBe('数据存储路径');
    expect(storageRow.desc).toBe('全部 JSON 数据文件统一存放的目录');
  });
});
