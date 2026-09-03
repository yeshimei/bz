/**
 * 主设置页 schema（ticket 131，ADR-0064）：BzSettingTab.display() 两区块（AI / 数据存储路径）
 * 的声明式定义。归属 core 的理由：两区块均为跨域全局项（ADR-0009 设置所有权），且文案
 * lint（ticket 100）需以纯数据方式全量断言（本模块只依赖 core 与设置类型，node 环境可安全加载）。
 *
 * 行为零变化锚点：
 * - AI 服务商切换 → 密钥行显隐由 visibleWhen 声明（deepseek 显示 DeepSeek 行，其余显示 OpenCode 行，
 *   与原 refreshKeys 的 toggleClass 口径等价）；ticket 170 起 custom 显示自定义端点行；issue 187 起
 *   「自定义模型」行退役（模型统一走「模型名称」行，setProviderValue 特判 custom → aiCustomModel）；
 *   ticket 171 起全部注册表提供商各生成一行密钥（apiKeyLabel 标题、apiKeyDesc 描述）——行列表由
 *   AI_PROVIDER_REGISTRY 驱动，新增提供商零 schema 改动；
 * - ticket 172 per-provider 配置三行（模型/上下文/max token）：模型行 custom（内嵌「获取模型名」
 *   按钮，行级联动 onRefresh）；上下文/最大输出 token 为标准 number 行（三函数 binding +
 *   refreshKey 随「AI 服务商」切换联动刷新，不再走 custom 套原生 Setting——统一两渲染器视觉）；
 * - issue 187 新增「采样参数」组（温度/top_p/频率惩罚/存在惩罚，string 键数字项，'' = 不发字段），
 *   同期删除全局 aiMaxTokens 孤儿键（请求链不再读）；
 * - 存储路径行 onCommit 的 warning 提示文案逐字保留（f1 防错提示，正文不带 emoji，铁律 7）；
 * - 区块标题 DOM 契约 .bz-setting-section-title 不破（无 icon 分组 = 区块标题平铺形态）。
 * - ticket 100 文案修正（键名/行为不动）：两个 API Key 行标题收短为「DeepSeek 密钥」「OpenCode 密钥」，
 *   全部描述改写为约 20 字自然句、去符号花样（原描述含括号/斜杠/域名/超长枚举，lint 不过）。
 */
import { Setting } from 'obsidian';
import { AI_PROVIDER_REGISTRY, getProviderDescriptor } from './ai';
import { notice } from './notice';
import { tryGetSettings, saveSettings } from './settings-provider';
import { fetchProviderModels, providerDescriptorOf } from './ai-models';
import { openModelPicker } from './settings-model-picker';
import type { NumberRow, SettingsSchema, SettingsRow, SettingsRowContext } from './settings-schema';

/** 存储路径改动防错提示（f1；正文不带 emoji，铁律 7）——文案逐字冻结，勿改 */
export const STORAGE_PATH_COMMIT_NOTICE = '存储路径已修改：仅改路径，文件不会自动迁移，旧数据需自行迁移；重载插件后生效。';

/** per-provider 覆盖 map 键集合（ticket 172） */
type OverrideMapKey = 'aiModelOverrides' | 'aiContextOverrides' | 'aiMaxTokensOverrides';

/** 当前 provider id（设置未显式时默认 opencode-go） */
function currentProviderId(): string {
  const s = tryGetSettings() as any;
  return s.aiProvider || 'opencode-go';
}

/** 读当前 provider 的值（覆盖 > 注册表默认；custom 模型用 aiCustomModel） */
function providerValue(kind: 'model' | 'context' | 'maxTokens'): string {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  if (id === 'custom' && kind === 'model') return String(s.aiCustomModel || '');
  const mapKey: OverrideMapKey =
    kind === 'model' ? 'aiModelOverrides' : kind === 'context' ? 'aiContextOverrides' : 'aiMaxTokensOverrides';
  const over = s[mapKey]?.[id];
  if (over !== undefined && over !== null && over !== '') return String(over);
  const d = getProviderDescriptor(id);
  if (kind === 'model') return d.model || '';
  return String(kind === 'context' ? d.defaultContextWindow : d.defaultMaxTokens);
}

/** 写当前 provider 的覆盖值（空 = 清除覆盖，回落注册表默认）。
 *  issue 187 特判：custom 的模型覆盖不写 aiModelOverrides[custom]（providerValue custom
 *  分支只读 aiCustomModel，写覆盖表是读不到的死值——原「模型名称」手输在 custom 下不生效的根因），
 *  统一落到 aiCustomModel。 */
function setProviderValue(mapKey: OverrideMapKey, raw: string): void {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  const v = raw.trim();
  if (mapKey === 'aiModelOverrides' && id === 'custom') {
    s.aiCustomModel = v === '0' ? '' : v;
    void saveSettings();
    return;
  }
  if (!s[mapKey] || typeof s[mapKey] !== 'object') s[mapKey] = {};
  const map = s[mapKey] as Record<string, any>;
  if (v === '' || v === '0') {
    delete map[id];
  } else {
    map[id] = mapKey === 'aiModelOverrides' ? v : Number(v);
  }
  void saveSettings();
}

/** 「模型名称」per-provider 行（ticket 172/173）：custom 渲染（内嵌「获取模型名」按钮——
 *  原生 Setting 的 addText + addButton 组合，标准行无同行按钮原语），onRefresh 随切换联动 */
function providerModelCustomRow(): SettingsRow {
  const label = '模型名称';
  const desc = '留空用该服务商默认模型';
  return {
    type: 'custom',
    name: label,
    desc,
    visibleWhen: () => true, // 常显（随 provider 联动内容）
    render: (body: HTMLElement, ctx: SettingsRowContext) => {
      const setting = new Setting(body).setName(label);
      if (desc) setting.setDesc(desc);
      let input: { setValue: (v: string) => unknown } | null = null;
      setting.addText((t) => {
        input = t;
        t.setValue(providerValue('model'));
        t.setPlaceholder('默认模型');
        t.onChange((v) => setProviderValue('aiModelOverrides', v));
      });
      // ticket 173「获取模型名」：行内嵌按钮（输入框右侧）——拉取当前服务商模型列表弹选择器回填
      setting.addButton((b) => {
        b.setButtonText('获取模型名').onClick(() => {
          void (async () => {
            if (b.disabled) return; // 加载中防连点
            b.setDisabled(true);
            b.setButtonText('获取中…');
            try {
              await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
              const providerId = String((tryGetSettings() as any).aiProvider || 'opencode-go');
              const desc = providerDescriptorOf(providerId);
              const models = await fetchProviderModels(providerId);
              // 打开弹窗前模型行仍可能被 provider 切换刷新——以当前 provider 为准
              const curProvider = String((tryGetSettings() as any).aiProvider || 'opencode-go');
              if (curProvider !== providerId) {
                notice('服务商已切换，请重新获取', 'warning');
                return;
              }
              openModelPicker({
                providerLabel: desc.label,
                current: providerValue('model'),
                models,
                onPick: (m) => {
                  // 与输入框 onChange 同口径（issue 187：setProviderValue 已统一 custom → aiCustomModel）
                  setProviderValue('aiModelOverrides', m.id);
                  ctx.refreshVisibility();
                  if (input) input.setValue(m.id);
                  notice(`模型已设为 ${m.id}`, 'success');
                },
              });
            } catch (e) {
              notice(e instanceof Error ? e.message : String(e), 'error');
            } finally {
              b.setDisabled(false);
              b.setButtonText('获取模型名');
            }
          })();
        });
      });
      // 保存输入框引用供 onRefresh 用（行级闭包挂到包装容器）
      (body as any).__providerInput = input;
      void ctx;
    },
    // onRefresh 由渲染器在 reevaluate 时调用：重读当前 provider 值写回输入框
    onRefresh: (ctx: SettingsRowContext) => {
      const input = (ctx.rowEl as any).__providerInput;
      if (input && typeof input.setValue === 'function') {
        input.setValue(providerValue('model'));
      }
    },
  } as SettingsRow;
}

/**
 * 「上下文窗口 / 最大输出 token」per-provider 行（ticket 172）：标准 number 行（不再走 custom
 * 套原生 Setting——统一 core / settings-panel 两渲染器的视觉与交互）。三函数 binding 读写当前
 * provider 的覆盖值（未填回落注册表默认）；refreshKey 随「AI 服务商」切换联动刷新显示值。
 */
function providerNumberConfigRow(kind: 'context' | 'maxTokens'): NumberRow {
  const mapKey: OverrideMapKey = kind === 'context' ? 'aiContextOverrides' : 'aiMaxTokensOverrides';
  const label = kind === 'context' ? '上下文窗口' : '最大输出 token';
  const desc = kind === 'context' ? '留空用该服务商默认窗口' : '留空用该服务商默认上限';
  const placeholder = kind === 'context' ? '默认窗口' : '默认上限';
  return {
    type: 'number',
    name: label,
    desc,
    binding: {
      // 读当前 provider 的值：覆盖 > 注册表默认（providerValue 恒返回数字字符串；NaN 兜底 0）
      get: () => {
        const n = Number(providerValue(kind));
        return Number.isFinite(n) ? n : 0;
      },
      // 写当前 provider 的覆盖（0 = 清除覆盖回落默认，与 setProviderValue 删键语义一致）
      set: (v: number) => {
        setProviderValue(mapKey, String(v));
      },
      save: () => saveSettings(),
    },
    refreshKey: () => providerValue(kind),
    placeholder,
  };
}

/**
 * 构造 AI 区块行（ticket 171 注册表驱动）：服务商下拉 + 每家提供商一行密钥（visibleWhen 随
 * aiProvider 显隐）+ custom 的端点/模型两行 + per-provider 配置三行。
 * 密钥行标题/描述取自 descriptor 的 apiKeyLabel / apiKeyDesc（文案 lint 与注册表单一事实源）。
 */
function aiGroupRows(): SettingsRow[] {
  const rows: SettingsRow[] = [
    {
      type: 'select',
      name: 'AI 服务商',
      desc: '切换服务商后显示对应的配置项',
      binding: { key: 'aiProvider' },
      options: AI_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })),
    },
  ];
  // 每家注册表提供商一行密钥（custom 的密钥行排在自定义端点之后，故先跳过）
  for (const p of AI_PROVIDER_REGISTRY) {
    if (p.id === 'custom') continue;
    rows.push({
      type: 'text',
      name: p.apiKeyLabel,
      desc: p.apiKeyDesc,
      binding: { key: p.apiKeyKey as never },
      visibleWhen: (snapshot) => snapshot.aiProvider === p.id,
    });
  }
  // custom：端点 / 密钥两行（issue 187 起「自定义模型」行退役——模型统一走「模型名称」行，
  // 手输经 setProviderValue 特判落 aiCustomModel，带「获取模型名」按钮）
  rows.push(
    {
      type: 'text',
      name: '自定义 API 地址',
      desc: 'OpenAI 兼容服务的完整接口地址',
      binding: { key: 'aiCustomEndpoint' },
      placeholder: 'https://api.example.com/v1',
      visibleWhen: (snapshot) => snapshot.aiProvider === 'custom',
    },
    {
      type: 'text',
      name: '自定义 API 密钥',
      desc: '在服务官网获取后填入这里',
      binding: { key: 'aiCustomApiKey' },
      visibleWhen: (snapshot) => snapshot.aiProvider === 'custom',
    },
    // ticket 172 per-provider 配置三行：模型行 custom（内嵌「获取模型名」按钮）+
    // 上下文/最大输出 token 标准 number 行（refreshKey 随服务商切换联动）
    providerModelCustomRow(),
    providerNumberConfigRow('context'),
    providerNumberConfigRow('maxTokens'),
  );
  return rows;
}

/** 采样参数组（issue 187）：四键 string 键数字项，'' = 不发该字段（API 默认） */
export function samplingGroup(): SettingsSchema['groups'][number] {
  return {
    icon: 'sliders-horizontal',
    name: '采样参数',
    rows: [
      {
        type: 'text',
        name: '采样温度',
        desc: '采样温度，留空用 API 默认',
        binding: { key: 'aiTemperature' as never },
        num: true,
        placeholder: 'API 默认',
      },
      {
        type: 'text',
        name: '核采样上限',
        desc: '核采样概率上限，留空用 API 默认',
        binding: { key: 'aiTopP' as never },
        num: true,
        placeholder: 'API 默认',
      },
      {
        type: 'text',
        name: '频率惩罚',
        desc: '降低重复内容的倾向，留空用 API 默认',
        binding: { key: 'aiFrequencyPenalty' as never },
        num: true,
        placeholder: 'API 默认',
      },
      {
        type: 'text',
        name: '存在惩罚',
        desc: '鼓励引入新内容的倾向，留空用 API 默认',
        binding: { key: 'aiPresencePenalty' as never },
        num: true,
        placeholder: 'API 默认',
      },
    ],
  };
}

/** AI 设置组（issue 186：设置面板拆独立域；⚙️ 主设置页与本域共用同一组定义） */
export function aiSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'sparkles',
        name: 'AI',
        rows: aiGroupRows(),
      },
      samplingGroup(),
    ],
  };
}

/** 通用设置组（原「全局」数据存储路径区块；issue 186 拆出 AI 后的剩余全局项） */
export function generalSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '数据存储路径',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '数据存储路径',
            desc: '全部 JSON 数据文件统一存放的目录',
            binding: { key: 'storagePath' },
            onCommit: () => {
              notice(STORAGE_PATH_COMMIT_NOTICE, 'warning');
            },
          },
        ],
      },
    ],
  };
}

/** 构造主设置页 schema（⚙️ 原生设置页两区块 = AI + 数据存储路径；每次 display 重建，visibleWhen 在渲染器内重求值） */
export function mainSettingsSchema(): SettingsSchema {
  return {
    groups: [...aiSettingsSchema().groups, ...generalSettingsSchema().groups],
  };
}
