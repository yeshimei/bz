/**
 * 主设置页 schema（ticket 131，ADR-0064）：BzSettingTab.display() 两区块（AI / 数据存储路径）
 * 的声明式定义。归属 core 的理由：两区块均为跨域全局项（ADR-0009 设置所有权），且文案
 * lint（ticket 100）需以纯数据方式全量断言（本模块只依赖 core 与设置类型，node 环境可安全加载）。
 *
 * 行为零变化锚点：
 * - AI 服务商切换 → 密钥行显隐由 visibleWhen 声明（注册表驱动）；ticket 171 起全部注册表提供商各生成
 *   一行密钥（apiKeyLabel 标题、apiKeyDesc 描述）——行列表由 AI_PROVIDER_REGISTRY 驱动，新增提供商
 *   零 schema 改动；issue 411/ADR-0179 起表内只留 deepseek / zhipu-plan / ollama 三条通道，
 *   custom（自定义 OpenAI 兼容端点）连同其两行一并退役；
 * - 思考档位行（issue 411/ADR-0179）随服务商重取选项：档位词表是 provider 属性（deepseek 有
 *   「关闭」无「中」/ 智谱 Plan 强制思考无「关闭」/ ollama 走 reasoning_effort），面板只列该家
 *   真支持的档，值也按 provider 分开存（aiThinkingOverrides）——旧版全局五档已退役；
 * - ticket 172 per-provider 配置（模型/max token）：模型行 custom（内嵌「获取模型名」
 *   按钮，行级联动 onRefresh）；最大输出 token 为标准 number 行（三函数 binding +
 *   refreshKey 随「AI 服务商」切换联动刷新，不再走 custom 套原生 Setting——统一两渲染器视觉）；
 *   issue 342/ADR-0151 起，未填覆盖时按「当前模型名」查官方最大档（core/model-limits）；
 *   「上下文窗口」行 issue 342 后续删除——模型固有属性、插件零消费点，非可调参数
 *   （aiContextOverrides 设置键一并退役）；
 * - issue 187 曾新增「采样参数」组，2026-09-08 拍板整体退役（UI 组 + 请求透传 + 设置键一并移除）；
 * - issue 331 重新分组：「AI 与凭据」单组（ADR-0133）拆为「服务商」「模型配置」「数据源凭据」
 *   三组；B站 Cookie / 豆瓣 Cookie 行当时由单行输入框改 textarea（Cookie 串长，便于粘贴检查），
 *   「从 CLI 导入」按钮经 actions 保留。键与行为零变化；
 * - 2026-09-23 凭据组三行统一回单行 secret（用户拍板「加密的做成多行框看着怪」）：textarea 的
 *   masked 档位在凭据组退役，行序改为 ApiZero Key → B站 Cookie → 豆瓣 Cookie；
 * - 存储路径行 onCommit 的 warning 提示文案逐字保留（f1 防错提示，正文不带 emoji，铁律 7）；
 * - 区块标题 DOM 契约 .bz-setting-section-title 不破（无 icon 分组 = 区块标题平铺形态）。
 * - ticket 100 文案修正（键名/行为不动）：两个 API Key 行标题收短为「DeepSeek 密钥」「OpenCode 密钥」，
 *   全部描述改写为约 20 字自然句、去符号花样（原描述含括号/斜杠/域名/超长枚举，lint 不过）。
 */

import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, getProviderDescriptor, thinkingLevelsOf } from './ai';
import { resolveModelLimits } from './model-limits';
import { notice } from './notice';
import { tryGetSettings, saveSettings, getSettings } from './settings-provider';
import { fetchProviderModels, providerDescriptorOf } from './ai-models';
import { openModelPicker } from './settings-model-picker';
import type { NumberRow, SettingsSchema, SettingsRow, SettingsRowContext } from './settings-schema';

/** 存储路径改动防错提示（f1；正文不带 emoji，铁律 7）——文案逐字冻结，勿改 */
export const STORAGE_PATH_COMMIT_NOTICE = '存储路径已修改：仅改路径，文件不会自动迁移，旧数据需自行迁移；重载插件后生效。';

/** 桌面端判定（ADR-0133；零依赖版，口径同 core/mobile 的 window.require 门禁——
 *  本模块须保持 node 环境可安全加载，故不 import obsidian 侧模块、并显式防 window 缺失） */
function isDesktopShell(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w && typeof w.require === 'function');
}

/** 「从 CLI 导入」：读 CLI 凭据文件 ~/.bilibili-cookies.json 填入 B站 Cookie（ADR-0133；失败静默提示） */
function importCliBilibiliCookie(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  try {
    const fs = w.require('fs');
    const os = w.require('os');
    const path = w.require('path');
    const file = path.join(os.homedir(), '.bilibili-cookies.json');
    const json = JSON.parse(String(fs.readFileSync(file, 'utf8')));
    const cookie = String((json && json.cookie) || '').trim();
    if (!cookie) { notice('CLI cookie 文件里没有 cookie', 'warning'); return; }
    getSettings().bilibiliCookie = cookie;
    void saveSettings();
    notice('已导入 B站 Cookie', 'success');
  } catch {
    notice('导入失败：找不到 CLI 的 ~/.bilibili-cookies.json', 'error');
  }
}

/** per-provider 覆盖 map 键集合（ticket 172；issue 342 后续：aiContextOverrides 随「上下文窗口」行退役） */
type OverrideMapKey = 'aiModelOverrides' | 'aiMaxTokensOverrides';

/** 当前 provider id（设置未显式时取注册表缺省服务商） */
function currentProviderId(): string {
  const s = tryGetSettings() as any;
  return s.aiProvider || DEFAULT_AI_PROVIDER;
}

/** 读当前 provider 的值（覆盖 > 按当前模型查官方档位 > 注册表默认） */
function providerValue(kind: 'model' | 'maxTokens'): string {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  const mapKey: OverrideMapKey = kind === 'model' ? 'aiModelOverrides' : 'aiMaxTokensOverrides';
  const over = s[mapKey]?.[id];
  if (over !== undefined && over !== null && over !== '') return String(over);
  const d = getProviderDescriptor(id);
  if (kind === 'model') return d.model || '';
  // 未填覆盖：按「当前模型名」取官方最大档（issue 342/ADR-0151 单一事实源，与 ai.ts 解析同源）
  return String(resolveModelLimits(String(d.model || ''))?.maxOutput ?? d.defaultMaxTokens);
}

/** 读当前 provider 的思考档位：档位不在该服务商档位表内（含历史遗留值）→ 回落 auto。
 *  与请求侧 thinkingBodyFor「不在表内不注入」同口径——显示值与实际生效值不许背离。 */
function providerThinkingValue(): string {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  const v = String(s.aiThinkingOverrides?.[id] ?? '');
  return thinkingLevelsOf(id).some((l) => l.value === v) ? v : 'auto';
}

/** 写当前 provider 的思考档位（auto = 删键，回落「不注入」；与两个 per-provider 行同口径） */
function setProviderThinkingValue(v: string): void {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  if (!s.aiThinkingOverrides || typeof s.aiThinkingOverrides !== 'object') s.aiThinkingOverrides = {};
  const map = s.aiThinkingOverrides as Record<string, string>;
  if (v === 'auto' || v === '') delete map[id];
  else map[id] = v;
  void saveSettings();
}

/** 写当前 provider 的覆盖值（空 = 清除覆盖，回落注册表默认） */
function setProviderValue(mapKey: OverrideMapKey, raw: string): void {
  const id = currentProviderId();
  const s = tryGetSettings() as any;
  const v = raw.trim();
  if (!s[mapKey] || typeof s[mapKey] !== 'object') s[mapKey] = {};
  const map = s[mapKey] as Record<string, any>;
  if (v === '' || v === '0') {
    delete map[id];
  } else {
    map[id] = mapKey === 'aiModelOverrides' ? v : Number(v);
  }
  void saveSettings();
}

/** 「模型名称」per-provider 行（ticket 172/173）：声明式 text + 行内「获取模型名」按钮
 *  （actions，渲染器统一实现——custom 插槽已退役）；refreshKey 随服务商切换联动回填 */
function providerModelCustomRow(): SettingsRow {
  return {
    type: 'text',
    name: '模型名称',
    desc: '留空用该服务商默认模型',
    placeholder: '默认模型',
    binding: {
      get: () => providerValue('model'),
      set: (v) => setProviderValue('aiModelOverrides', v),
      save: () => {},
    },
    refreshKey: () => providerValue('model'),
    actions: [{
      text: '获取模型名',
      onClick: async (_value, ctx) => {
        try {
          await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
          const providerId = String((tryGetSettings() as any).aiProvider || DEFAULT_AI_PROVIDER);
          const desc = providerDescriptorOf(providerId);
          const models = await fetchProviderModels(providerId);
          // 拉取期间模型行仍可能被 provider 切换刷新——以当前 provider 为准
          const curProvider = String((tryGetSettings() as any).aiProvider || DEFAULT_AI_PROVIDER);
          if (curProvider !== providerId) {
            notice('服务商已切换，请重新获取', 'warning');
            return;
          }
          openModelPicker({
            providerLabel: desc.label,
            current: providerValue('model'),
            models,
            onPick: (m) => {
              // 与输入框 onChange 同口径（issue 411：custom 通道退役后无特判，统一落 aiModelOverrides）
              setProviderValue('aiModelOverrides', m.id);
              ctx.refreshVisibility();
              notice(`模型已设为 ${m.id}`, 'success');
            },
          });
        } catch (e) {
          notice(e instanceof Error ? e.message : String(e), 'error');
        }
      },
    }],
  } as SettingsRow;
}

/**
 * 「最大输出 token」per-provider 行（ticket 172）：标准 number 行（不再走 custom 套原生
 * Setting——统一 core / settings-panel 两渲染器的视觉与交互）。三函数 binding 读写当前
 * provider 的覆盖值（未填时按「当前模型名」取官方最大档，issue 342/ADR-0151；未收录才回落
 * 注册表默认）；refreshKey 随「AI 服务商」切换联动刷新显示值。
 * 「上下文窗口」行已删（issue 342 后续，2026-09-16 用户拍板）：上下文窗口是模型固有属性、
 * 插件全链零消费点（纯展示），不是可调参数——aiContextOverrides 键一并退役。
 * issue 331 起归「模型配置」组——refreshKey 联动链是全 schema 级的，跨组不受影响。
 */
function providerMaxTokensRow(): NumberRow {
  return {
    type: 'number',
    name: '最大输出 token',
    desc: '留空时取该模型官方上限',
    // N4：负数原直通 max_tokens → 服务商 400（负数 truthy 过 overrideMaxTokens 短路）——钳下界 0
    //（'0'/0 已有 setProviderValue 删键回落默认语义，口径自洽）
    // 2026-09-23 补上界：原只有 min，手滑多打几个 0 会直送服务商（400/超长请求）；
    // 20 万是当前最大上下文模型的量级上沿，够用且拦得住误触
    min: 0,
    max: 200000,
    binding: {
      // 读当前 provider 的值：覆盖 > 注册表默认（providerValue 恒返回数字字符串；NaN 兜底 0）
      get: () => {
        const n = Number(providerValue('maxTokens'));
        return Number.isFinite(n) ? n : 0;
      },
      // 写当前 provider 的覆盖（0 = 清除覆盖回落默认，与 setProviderValue 删键语义一致）
      set: (v: number) => {
        setProviderValue('aiMaxTokensOverrides', String(v));
      },
      save: () => saveSettings(),
    },
    refreshKey: () => providerValue('maxTokens'),
    placeholder: '默认上限',
  };
}

/**
 * 「服务商」组行（issue 331 拆组）：服务商下拉 + 每家注册表提供商一行密钥（visibleWhen 随
 * aiProvider 显隐）。
 * 密钥行标题/描述取自 descriptor 的 apiKeyLabel / apiKeyDesc（文案 lint 与注册表单一事实源）；
 * issue 411/ADR-0179：只留 deepseek / zhipu-plan / ollama 三条通道，custom 的端点/密钥两行退役
 * （新通道按注册表加一行即可，不再需要「自填端点」这一档）。
 * 密钥行全走「密钥型」档位（type:'secret' → 密码框 + 眼睛切明文），凭据不裸奔。
 */
function providerGroupRows(): SettingsRow[] {
  const rows: SettingsRow[] = [
    {
      type: 'select',
      name: 'AI 服务商',
      desc: '切换服务商后显示对应的配置项',
      binding: { key: 'aiProvider' },
      options: AI_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })),
    },
  ];
  for (const p of AI_PROVIDER_REGISTRY) {
    rows.push({
      type: 'secret',
      name: p.apiKeyLabel,
      desc: p.apiKeyDesc,
      binding: { key: p.apiKeyKey as never },
      placeholder: '粘贴密钥',
      visibleWhen: (snapshot) => snapshot.aiProvider === p.id,
    });
  }
  return rows;
}

/** 思考档位行（issue 411/ADR-0179）：选项随「AI 服务商」重取——档位词表与参数名是 provider 属性
 *  （core/ai 的 descriptor.thinking 单一事实源）：deepseek = 关闭/低/高/最高；智谱 Plan 强制思考
 *  = 低/高/最高（无关闭档）；ollama = 关闭/低/中/高（走 reasoning_effort）。
 *  值按 provider 分开存（aiThinkingOverrides），切服务商互不污染；显示值与请求注入同源，
 *  不列该家不支持的档——旧版全局五档（对每条通道都发不生效的参数）已退役。 */
function providerThinkingRow(): SettingsRow {
  return {
    type: 'select',
    name: '思考 reasoning',
    desc: '关闭可省判定类小任务开销，档位随服务商显示',
    binding: {
      get: () => providerThinkingValue(),
      set: (v) => setProviderThinkingValue(v),
      save: () => {},
    },
    options: (snap) =>
      thinkingLevelsOf(String((snap as { aiProvider?: string }).aiProvider || DEFAULT_AI_PROVIDER)).map((l) => ({
        value: l.value,
        label: l.label,
      })),
    refreshKey: () => providerThinkingValue(),
  } as SettingsRow;
}

/** 「模型配置」组行（issue 331 拆组）：ticket 172 per-provider 两行——模型行 custom
 *  （内嵌「获取模型名」按钮）+ 最大输出 token 标准 number 行
 *  （refreshKey 随服务商切换联动，跨组生效）+ 思考档位（issue 411/ADR-0179 起随服务商显示）。
 *  「上下文窗口」行已删（issue 342 后续）：模型固有属性、零消费点，非可调参数。 */
function modelGroupRows(): SettingsRow[] {
  return [
    providerModelCustomRow(),
    providerMaxTokensRow(),
    providerThinkingRow(),
  ];
}

/**
 * 「数据源凭据」组行（issue 331 拆组，ADR-0133「AI 与凭据」单组退役）：与 AI 服务商无关的
 * 第三方数据源凭据集中一卡——影院 ApiZero Key / 豆瓣 Cookie（原影院「数据抓取」组挪入）+
 * B站 Cookie（知识盒档位查询；桌面端可从 CLI 导入）。
 * 三行一律单行 secret（password 掩码 + 眼睛切明文）——2026-09-23 用户报「加密的做成多行框
 * 看着怪」，Cookie 行的 textarea(masked) 档位退役；行序按用户要求（「第二项放到前面」）：
 * ApiZero Key → B站 Cookie → 豆瓣 Cookie。
 */
function credentialGroupRows(): SettingsRow[] {
  return [
    {
      type: 'secret',
      name: 'ApiZero Key',
      desc: '豆瓣字段接口的密钥，不填时字段走豆瓣演职员接口兜底',
      binding: { key: 'cinemaApizeroKey' },
      placeholder: '粘贴密钥',
    },
    {
      type: 'secret',
      name: 'B站 Cookie',
      desc: '视频录入解析清晰度档位用，留空则档位回落固定列表',
      binding: { key: 'bilibiliCookie' },
      placeholder: '粘贴从浏览器复制的 Cookie',
      actions: isDesktopShell() ? [{ text: '从 CLI 导入', onClick: () => importCliBilibiliCookie() }] : [],
    },
    {
      type: 'secret',
      name: '豆瓣 Cookie',
      desc: '搜索被风控时粘贴浏览器Cookie可提高成功率，不填也能抓',
      binding: { key: 'cinemaDoubanCookie' },
      placeholder: '粘贴从浏览器复制的 Cookie',
    },
  ];
}

/**
 * 「Jev 决策通道」组行（issue 391 / ADR-0173 §6）：启用总开关 + 端点 / 密钥 / 模型 / 超时四行
 * （后四行 visibleWhen 跟随总开关）。Jev 是判定通道（输出不计费、无 max_tokens），不挂进生成通道
 * AI_PROVIDER_REGISTRY——独立成组（issue 391 决策 1）。
 * 密钥行刻意用掩码档位（secret）：Jev 密钥是新引入的第三方凭据，不复用 providerGroupRows 的明文
 * 口径（issue 391 决策 3）。**2026-09-23 起** secret 已收编进 core 的 SettingsRow 判别联合，
 * 这里直接写行字面量——原先「core 层够不着 settings-panel/renderer 的 secretRow()，只能
 * `as unknown as SettingsRow` 就地断言」的跨层 hack 随之退场（providerGroupRows 也已改用同档位）。
 */
function jevGroupRows(): SettingsRow[] {
  return [
    {
      type: 'toggle',
      name: '启用 Jev 判定',
      desc: '开启后关联判定改走 Jev 决策通道',
      binding: { key: 'jevEnabled' },
    },
    {
      type: 'text',
      name: 'Jev 端点',
      desc: '判定服务接口地址，一般无需改动',
      binding: { key: 'jevEndpoint' },
      placeholder: 'https://api.typesafe.ai/v1/systemone',
      inputMode: 'url',
      visibleWhen: (snapshot) => snapshot.jevEnabled === true,
    },
    {
      type: 'secret',
      name: 'Jev 密钥',
      desc: '连接 Jev 决策通道所需的密钥',
      binding: { key: 'jevApiKey' },
      placeholder: '粘贴 Jev 密钥',
      visibleWhen: (snapshot) => snapshot.jevEnabled === true,
    },
    {
      type: 'text',
      name: 'Jev 模型',
      desc: '判定使用的模型，默认固定版本',
      binding: { key: 'jevModel' },
      placeholder: 'jev-1.13.0',
      visibleWhen: (snapshot) => snapshot.jevEnabled === true,
    },
    {
      type: 'number',
      name: 'Jev 超时',
      desc: '单次判定超时毫秒，留空用默认十秒',
      binding: { key: 'jevTimeoutMs' },
      min: 0,
      max: 120000,
      placeholder: '10000',
      visibleWhen: (snapshot) => snapshot.jevEnabled === true,
    },
  ];
}

/** AI 页设置组（issue 186：设置面板拆独立域；⚙️ 主设置页与本域共用同一组定义。
 *  issue 331 重新分组：「AI 与凭据」单组（ADR-0133）拆为「服务商」「模型配置」「数据源凭据」
 *  三组——接入（选谁+密钥）/ 模型参数（用哪个模型+窗口）/ 数据源凭据（非 AI 的第三方凭据）
 *  三层各归各卡；键与行为零变化。issue 391 追加「Jev 决策通道」组（判定通道，独立于生成通道）。 */
export function aiSettingsSchema(): SettingsSchema {
  return {
    groups: [
      { icon: 'plug-zap', name: '服务商', rows: providerGroupRows() },
      { icon: 'cpu', name: '模型配置', rows: modelGroupRows() },
      { icon: 'key-round', name: '数据源凭据', rows: credentialGroupRows() },
      { icon: 'route', name: 'Jev 决策通道', rows: jevGroupRows() },
    ],
  };
}

/** 通用设置组（原「全局」数据存储路径区块；issue 186 拆出 AI 后的剩余全局项）。
 *  2026-09-12：通知组拆出为独立面板页（noticeSettingsSchema），本组只剩数据存储路径。 */
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
            note: '改动仅改路径不迁移旧数据；重载插件后生效',
            binding: { key: 'storagePath' },
            onCommit: () => {
              notice(STORAGE_PATH_COMMIT_NOTICE, 'warning');
            },
          },
        ],
      },
      // 通知组已拆出（2026-09-12 用户拍板）：见下方 noticeSettingsSchema ——
      // 设置面板里独立成一页，不再挤在「通用」域里
    ],
  };
}

/** 通知设置组（2026-09-12 用户拍板：自「通用」域拆出，设置面板里独立成一页）。
 *  不建业务域——core notice toast 是横切偏好，schema 留 core，面板只多一个导航页。
 *  issue 297：行型全 select，原生设置页与面板双渲染器通用。 */
export function noticeSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'bell',
        name: '通知',
        rows: [
          {
            type: 'select',
            name: '通知级别',
            desc: '低档位静默常规通知，带撤销按钮的通知不受影响',
            binding: { key: 'noticeLevel' },
            options: [
              { value: 'all', label: '全部' },
              { value: 'important', label: '仅警告与错误' },
              { value: 'error', label: '仅错误' },
            ],
          },
          {
            type: 'select',
            name: '停留时长',
            desc: '长文案自动延长，撤销类 6 秒反悔窗口不受影响',
            binding: { key: 'noticeDuration' },
            options: [
              { value: 'quick', label: '干脆（2 秒）' },
              { value: 'standard', label: '标准（3 秒）' },
              { value: 'relaxed', label: '从容（5 秒）' },
              { value: 'persistent', label: '常驻（点击才关）' },
            ],
          },
          {
            type: 'select',
            name: '弹出位置',
            desc: '桌面端四角任选，移动端恒顶部居中',
            binding: { key: 'noticePosition' },
            options: [
              { value: 'top-right', label: '右上（默认）' },
              { value: 'bottom-right', label: '右下' },
              { value: 'bottom-left', label: '左下' },
              { value: 'top-left', label: '左上' },
            ],
          },
          {
            type: 'select',
            name: '同屏上限',
            desc: '超出时挤掉最旧的一条',
            binding: { key: 'noticeMaxVisible' },
            options: [
              { value: '3', label: '3 条' },
              { value: '5', label: '5 条' },
              { value: '8', label: '8 条' },
            ],
          },
        ],
      },
    ],
  };
}

/** 全局设置聚合视图（AI + 数据存储路径 + 通知；每次调用重建，visibleWhen 在渲染器内重求值）。
 *  issue 345（2026-09-16 用户拍板）：原生设置页退役平铺（BzSettingTab 只留「打开设置面板」按钮），
 *  本聚合器不再有 UI 消费方——保留作测试与文案 lint 的全量断言入口；面板分页各用
 *  aiSettingsSchema / generalSettingsSchema / noticeSettingsSchema。 */
export function mainSettingsSchema(): SettingsSchema {
  return {
    groups: [...aiSettingsSchema().groups, ...generalSettingsSchema().groups, ...noticeSettingsSchema().groups],
  };
}
