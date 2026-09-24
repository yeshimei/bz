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
 * - issue 422/ADR-0182 按模型族收敛：撤销「服务商」组（行并入 LLM 组首部），「模型配置」更名
 *   「LLM」、「Jev 决策通道」更名「JEV」，新增「Embedding」组（第二大脑迁移来的向量化模型行，
 *   行内「获取模型」按钮拉 Ollama 已装 embedding 模型：bge-m3 / nomic-embed-text /
 *   qwen3-embedding:8b…）。四组 = LLM / Embedding / JEV / 数据源凭据；键与行为零变化；
 *   注意本模块须保持 node 环境可安全加载（文案 lint 直接 import），故新增逻辑不 import
 *   obsidian 侧模块——移动端判定走 core/mobile（obsidian Platform），与域侧口径同源；
 * - issue 423/ADR-0183：「Embedding」组再收第二大脑迁来的两行 Ollama 地址（本地 URL +
 *   移动端远程地址，地址在前、模型在后）。远程地址另有桌面端启动自动写入（当时的「只补空值、
 *   不覆盖手改值」已由下条 issue 424 的跟随语义取代）；探测实现留在 secondbrain/local-ip
 *   ——本模块仍不 import 域侧模块，node 可加载口径不变；
 * - issue 424/ADR-0184（用户拍板五处删改）：「Embedding」组「移动端远程地址」行删除（远程
 *   地址改由桌面端启动**自动跟随本机 IP**，见 secondbrain/local-ip.ensureRemoteOllamaUrl）；
 *   「JEV」组收口为服务商 / 密钥 / 模型三行——「启用 Jev 判定」开关退役（常开：填了密钥即
 *   接管，清空即回落 LLM）、「Jev 端点」退役（改「Jev 服务商」下拉，列表源自 core/jev 的
 *   JEV_PROVIDER_REGISTRY）、「Jev 超时」退役（固化十秒）、「Jev 模型」加
 *   行内「获取模型」（拉服务商 /v1/models 自选，留空跟随服务商缺省）；
 * - issue 430：「Jev 服务商」下拉新增博查（bocha-jev-v1，与 Typesafe 报文同构、国内直连），
 *   模型缺省改按服务商各配（typesafe → jev-latest，博查 → bocha-jev-v1）；
 * - 2026-09-23 凭据组三行统一回单行 secret（用户拍板「加密的做成多行框看着怪」）：textarea 的
 *   masked 档位在凭据组退役，行序改为 ApiZero Key → B站 Cookie → 豆瓣 Cookie；
 * - 存储路径行 onCommit 的 warning 提示文案逐字保留（f1 防错提示，正文不带 emoji，铁律 7）；
 * - 区块标题 DOM 契约 .bz-setting-section-title 不破（无 icon 分组 = 区块标题平铺形态）。
 * - ticket 100 文案修正（键名/行为不动）：两个 API Key 行标题收短为「DeepSeek 密钥」「OpenCode 密钥」，
 *   全部描述改写为约 20 字自然句、去符号花样（原描述含括号/斜杠/域名/超长枚举，lint 不过）。
 * - issue 429：「Embedding」组尾补「重排模型」行（开启重排才显示），行内「获取模型」拉同一台
 *   Ollama 的已装模型（名字含 rerank 的优先）；键 secondBrainRerankModel，留空回落
 *   secondbrain/config 的 RERANK_MODEL（Qwen3-Reranker-4B）。重排是纯换序层，换模型不重建索引。
 */

import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, getProviderDescriptor, thinkingLevelsOf } from './ai';
import { JEV_PROVIDER_REGISTRY, getJevProviderDescriptor, fetchJevModels } from './jev';
import { resolveModelLimits } from './model-limits';
import { notice } from './notice';
import { tryGetSettings, saveSettings, getSettings } from './settings-provider';
import { fetchEmbeddingModels, fetchProviderModels, fetchRerankModels, hasRerankNamed, isQwen3Embedding8b, providerDescriptorOf } from './ai-models';
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
          // 等选择器真正关闭再返回：渲染器在动作 Promise 完成后才重读绑定回填输入框，
          // 而 openModelPicker 是「打开即返回」的弹窗——不等就会先回填旧值，用户选中后
          // 输入框不刷新，要再点一次按钮才变（2026-09-24 用户报「选中两次才变」）。
          await new Promise<void>((resolve) => {
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
              // 选中/取消（遮罩、Esc）统一在此收口——动作 Promise 必有归宿，不回填悬空
              onClose: () => resolve(),
            });
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

/** 「LLM」组行（issue 422/ADR-0182）：「服务商」组撤销后与其「模型配置」组合卡——
 *  接入行（服务商下拉 + 各家密钥，visibleWhen 随 aiProvider 显隐）在前，
 *  模型参数三行在后：先选通道与密钥、再配这一通道用哪个模型。键与行为零变化。 */
function llmGroupRows(): SettingsRow[] {
  return [...providerGroupRows(), ...modelGroupRows()];
}

/**
 * 「Embedding 模型」行（issue 422/ADR-0182）：原第二大脑设置页「服务」组迁入 AI 面板。
 * 行内「获取模型」按钮照 LLM 模型行范式：拉向量化服务已装模型（Ollama /api/tags 按
 * embedding 能力过滤：bge-m3 / nomic-embed-text / qwen3-embedding:8b…）弹选择器，选中即写入。
 * 键 secondBrainEmbeddingModel 不变——secondbrain/config.ts 读取与 smartcat「留空跟随」回退
 * 口径零改动；换模型后维度不同（bge-m3 1024 维 / qwen3-embedding:8b 4096 维），
 * 第二大脑下次打开自动全量重建（vector-store 记录产出模型，ADR-0182 §2）。
 */
function embeddingModelRow(): SettingsRow {
  return {
    type: 'text',
    name: 'Embedding 模型',
    desc: '向量化用的嵌入模型名，留空用默认 bge-m3',
    placeholder: 'bge-m3',
    binding: { key: 'secondBrainEmbeddingModel' },
    actions: [{
      text: '获取模型',
      onClick: async (_value, ctx) => {
        try {
          await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
          const models = await fetchEmbeddingModels();
          // 与 LLM 模型行同款：等选择器真正关闭再返回（渲染器在动作 Promise 完成后才重读
          // 绑定回填输入框，openModelPicker 是「打开即返回」的弹窗——2026-09-24 用户报「选中两次才变」）
          await new Promise<void>((resolve) => {
            openModelPicker({
              providerLabel: 'Ollama 向量化',
              current: String((tryGetSettings() as any).secondBrainEmbeddingModel || ''),
              models,
              onPick: (m) => {
                (tryGetSettings() as any).secondBrainEmbeddingModel = m.id;
                void saveSettings();
                // 与手输 onChange 同口径（手输走 binding 防抖落盘）；回填显示值由渲染器动作链负责
                ctx.refreshVisibility();
                notice(`Embedding 模型已设为 ${m.id}，第二大脑下次打开将重建向量索引`, 'success');
              },
              // 选中/取消（遮罩、Esc）统一在此收口——动作 Promise 必有归宿，不回填悬空
              onClose: () => resolve(),
            });
          });
        } catch (e) {
          notice(e instanceof Error ? e.message : String(e), 'error');
        }
      },
    }],
  } as SettingsRow;
}

/**
 * 「Ollama 本地 URL」行（issue 423/ADR-0183 自第二大脑「服务」组迁入）：桌面向量化服务地址。
 * 键 secondBrainOllamaUrl 不变，secondbrain/config.ts 与 vector-store / weekly / link-agent
 * 的消费口径零改动；「移动端远程地址」行 issue 424/ADR-0184 删除（桌面端启动自动跟随本机 IP，
 * 见 secondbrain/local-ip.ensureRemoteOllamaUrl）。
 */
function ollamaLocalUrlRow(): SettingsRow {
  return {
    type: 'text',
    name: 'Ollama 本地 URL',
    desc: '本地 Ollama 服务地址，留空用默认端口',
    binding: { key: 'secondBrainOllamaUrl' },
    inputMode: 'url',
    // text 行 trim 落盘（沿用原 onChange 口径：v.trim() 写内存，防抖落盘读内存值）
    onChange: (v: string) => {
      (tryGetSettings() as Record<string, unknown>).secondBrainOllamaUrl = v.trim();
    },
  };
}

/**
 * 「JEV」组行（issue 391/ADR-0173 §6 起；issue 424/ADR-0184 收口；issue 430 加博查）：
 * 服务商下拉 + 密钥 + 模型，照「LLM」组同序（先选通道与密钥、再配这一通道用哪个模型）。
 * - 「启用 Jev 判定」开关**退役**（用户拍板「默认启动，无需设置」）：`isJevConfigured` 只看
 *   密钥齐备，清空密钥即回落 LLM——设置里不再有第二处「要不要用」的真相；
 * - 「Jev 端点」退役 → 「Jev 服务商」下拉（列表由 `JEV_PROVIDER_REGISTRY` 驱动；
 *   issue 430 起两家，在册者与 SystemOne 报文同构，端点不再是设置项）；
 * - 「Jev 超时」退役 → 固定十秒（`JEV_DEFAULT_TIMEOUT_MS`）；
 * - 「Jev 模型」加行内「获取模型」按钮（拉服务商模型列表，留空跟随服务商缺省——
 *   typesafe → `jev-latest`，博查 → `bocha-jev-v1`）。
 * 密钥行用掩码档位（secret）：Jev 密钥是新引入的第三方凭据，不复用 providerGroupRows 的明文口径。
 * 注意两家密钥互不通用：Typesafe 与博查各发各的 key，换服务商须连同密钥、模型一起换。
 */
function jevGroupRows(): SettingsRow[] {
  return [
    {
      type: 'select',
      name: 'Jev 服务商',
      desc: '判定通道的服务商，各家密钥不通用',
      binding: { key: 'jevProvider' },
      options: JEV_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })),
    },
    {
      type: 'secret',
      name: 'Jev 密钥',
      desc: '填写后判定通道即启用，清空则回落语言模型',
      binding: { key: 'jevApiKey' },
      placeholder: '粘贴 Jev 密钥',
    },
    jevModelRow(),
  ];
}

/** 「Jev 模型」行（issue 424/ADR-0184）：声明式 text + 行内「获取模型」按钮，照 Embedding 模型行范式
 *  （选中即回填一次到位——等选择器关闭再 resolve 动作 Promise，见该行注释）。空值回落服务商缺省
 *  （issue 430 起按服务商各配，见 core/jev 描述符的 defaultModel）。placeholder 钉 `jev-latest`
 *  只是示例展示（它在博查亦是有效别名），非全局缺省。 */
function jevModelRow(): SettingsRow {
  return {
    type: 'text',
    name: 'Jev 模型',
    desc: '判定使用的模型，留空跟随服务商缺省',
    placeholder: 'jev-latest',
    binding: { key: 'jevModel' },
    actions: [{
      text: '获取模型',
      onClick: async (_value, ctx) => {
        try {
          await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
          const models = await fetchJevModels();
          await new Promise<void>((resolve) => {
            openModelPicker({
              providerLabel: getJevProviderDescriptor(String((tryGetSettings() as any).jevProvider || '')).label,
              current: String((tryGetSettings() as any).jevModel || ''),
              models,
              onPick: (m) => {
                (tryGetSettings() as any).jevModel = m.id;
                void saveSettings();
                // 与手输 onChange 同口径（手输走 binding 防抖落盘）；回填显示值由渲染器动作链负责
                ctx.refreshVisibility();
                notice(`Jev 模型已设为 ${m.id}`, 'success');
              },
              // 选中/取消（遮罩、Esc）统一在此收口——动作 Promise 必有归宿，不回填悬空
              onClose: () => resolve(),
            });
          });
        } catch (e) {
          notice(e instanceof Error ? e.message : String(e), 'error');
        }
      },
    }],
  } as SettingsRow;
}

/**
 * 「Embedding」组行（issue 422/ADR-0182）：向量化服务地址在前、向量化模型在后
 * （先知道服务在哪台机器，再拉它的模型列表）。第二大脑与跟随回退的小橘记忆库共用同一模型键。
 * issue 424/ADR-0184：「移动端远程地址」行删除——该值由桌面端启动自动跟随本机 IP
 * （secondbrain/local-ip.ensureRemoteOllamaUrl），不再需要人工看/改。
 * issue 429：重排开关之后接「重排模型」行（开启重排才显示）——重排器也是 Ollama 上的模型，
 * 与嵌入同一台服务，可选可换。
 */
function embeddingGroupRows(): SettingsRow[] {
  return [ollamaLocalUrlRow(), embeddingModelRow(), rerankToggleRow(), rerankModelRow()];
}

/**
 * 「启用重排」开关（issue 427/ADR-0186）：召回结果交 Qwen3-Reranker 交叉编码重排，头部若干条按
 * 重排分排序（分数与阈值仍走原始余弦单尺，重排只改顺序，见 secondbrain/vector-store）。
 * 默认开；只在「Embedding 模型 = Qwen3-Embedding-8B」时显示——可见性判定与检索侧生效条件
 * 共用 core `isQwen3Embedding8b`（行藏起来时检索侧也不生效，不留暗态开关）。
 */
function rerankToggleRow(): SettingsRow {
  return {
    type: 'toggle',
    name: '启用重排',
    desc: '召回结果再用重排模型精排，相关笔记排序更准',
    binding: { key: 'secondBrainRerank' },
    visibleWhen: (snapshot) => isQwen3Embedding8b(snapshot.secondBrainEmbeddingModel),
  };
}

/**
 * 「重排模型」行（issue 429，用户拍板「开启重排之后还要显示一个选择重排模型的选项」）：
 * 照 Embedding 模型行范式——行内「获取模型」拉同一台 Ollama 的已装模型（名字含 rerank 的
 * 优先，见 core/ai-models pickRerankModels），选中即写入 secondBrainRerankModel。
 * 可见性 = 与「启用重排」开关同一条件链（8B 嵌入 + 开关非关）；换它不动向量索引，
 * 下一次检索即生效（重排是纯换序层，无重建语义）。
 */
function rerankModelRow(): SettingsRow {
  return {
    type: 'text',
    name: '重排模型',
    desc: '重排用的模型名，留空用默认 Qwen3-Reranker-4B',
    placeholder: 'dengcao/Qwen3-Reranker-4B:Q4_K_M',
    binding: { key: 'secondBrainRerankModel' },
    visibleWhen: (snapshot) =>
      isQwen3Embedding8b(snapshot.secondBrainEmbeddingModel) && snapshot.secondBrainRerank !== false,
    actions: [{
      text: '获取模型',
      onClick: async (_value, ctx) => {
        try {
          await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
          const models = await fetchRerankModels();
          // 与 Embedding 模型行同款：等选择器真正关闭再返回（渲染器在动作 Promise 完成后才重读
          // 绑定回填输入框，openModelPicker 是「打开即返回」的弹窗）
          await new Promise<void>((resolve) => {
            openModelPicker({
              // 一个 rerank 都没匹配到 = 列的是全部模型（不是筛选失败）：标题里说明，用户才知道为何列表这么长
              // （标题模板自带一层全角括号，这里用间隔号续句，避免嵌套括号）
              providerLabel: hasRerankNamed(models) ? 'Ollama 重排' : 'Ollama 重排 · 未找到 rerank 字样模型，已列出全部',
              current: String((tryGetSettings() as any).secondBrainRerankModel || ''),
              models,
              onPick: (m) => {
                (tryGetSettings() as any).secondBrainRerankModel = m.id;
                void saveSettings();
                // 与手输 onChange 同口径（手输走 binding 防抖落盘）；回填显示值由渲染器动作链负责
                ctx.refreshVisibility();
                notice(`重排模型已设为 ${m.id}，下次检索即生效`, 'success');
              },
              // 选中/取消（遮罩、Esc）统一在此收口——动作 Promise 必有归宿，不回填悬空
              onClose: () => resolve(),
            });
          });
        } catch (e) {
          notice(e instanceof Error ? e.message : String(e), 'error');
        }
      },
    }],
  } as SettingsRow;
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

/** AI 页设置组（issue 186：设置面板拆独立域；⚙️ 主设置页与本域共用同一组定义。
 *  issue 331 重新分组：「AI 与凭据」单组（ADR-0133）拆为「服务商」「模型配置」「数据源凭据」
 *  三组——接入（选谁+密钥）/ 模型参数（用哪个模型+窗口）/ 数据源凭据（非 AI 的第三方凭据）
 *  三层各归各卡；键与行为零变化。issue 391 追加「Jev 决策通道」组（判定通道，独立于生成通道）。
 *  issue 422/ADR-0182：按模型族收敛为 LLM / Embedding / JEV 三张模型卡 + 数据源凭据——
 *  「服务商」组撤销，其行并入「LLM」组首部（先选服务商与密钥、再配模型参数，同卡一条链）；
 *  第二大脑的「Embedding 模型」行迁入「Embedding」组（键 secondBrainEmbeddingModel 不变，
 *  消费方 secondbrain/config.ts 与 smartcat 跟随回退口径零改动）。
 *  issue 423/ADR-0183：「Embedding」组再收两行 Ollama 地址（本地 URL + 移动端远程地址）。
 *  issue 424/ADR-0184：「移动端远程地址」行删（桌面端自动跟随本机 IP）；JEV 组收口为
 *  服务商 / 密钥 / 模型三行（总开关、端点、超时三行退役——常开、端点由服务商决定、超时固定）。 */
export function aiSettingsSchema(): SettingsSchema {
  return {
    groups: [
      { icon: 'cpu', name: 'LLM', rows: llmGroupRows() },
      { icon: 'binary', name: 'Embedding', rows: embeddingGroupRows() },
      { icon: 'route', name: 'JEV', rows: jevGroupRows() },
      { icon: 'key-round', name: '数据源凭据', rows: credentialGroupRows() },
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
