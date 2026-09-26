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
 * - issue 431/ADR-0189：重排双通道二选一——「启用重排」改常显总闸（desc 写双通道门槛），新增
 *   「重排走 Jev」开关（键 secondBrainRerankJev，总闸开才显示，开启后走 JEV 组的 Jev 通道）、
 *   「重排模型」行改本地通道专属（可见性叠 Jev 关，Jev 开时隐藏）。运行期判定单源
 *   secondbrain/config rerankChannel（off/local/jev）。
 * - issue 444：AI 区块追加「语音转写」组（JEV 之后、凭据之前）——「转写引擎」下拉
 *   （SenseVoice-Small 缺省 / faster-whisper 备选）+「Whisper 档位」下拉
 *   （仅 faster-whisper 时显示，visibleWhen）；知识盒视频录入转文字按该组下发，
 *   旧 knowledgeWhisperModel 经 migrateAsrKeys 一次性迁移为 asrWhisperModel。
 */

import { AI_PROVIDER_REGISTRY, DEFAULT_AI_PROVIDER, getProviderDescriptor, testAIConnectivity, thinkingLevelsOf } from './ai';
import { JEV_PROVIDER_REGISTRY, DEFAULT_JEV_PROVIDER, getJevProviderDescriptor, fetchJevModels, testJevConnectivity } from './jev';
import { resolveModelLimits } from './model-limits';
import { notice } from './notice';
import { tryGetSettings, saveSettings, getSettings } from './settings-provider';
import { fetchEmbeddingModels, fetchProviderModels, fetchRerankModels, hasRerankNamed, isQwen3Embedding8b, providerDescriptorOf } from './ai-models';
import { openModelPicker } from './settings-model-picker';
import { downloadManual, hasManual, openManual } from './manual';
import { getApp } from './app';
import type { NumberRow, RowAction, SettingsSchema, SettingsRow, SettingsRowContext } from './settings-schema';

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
    desc: 'AI 生成使用的模型',
    help:
      '生成通道用哪个模型，按服务商分别存储，切服务商互不覆盖；留空就用该服务商的注册表默认模型。「获取模型名」从当前服务商的模型列表接口拉取（Ollama 读本机 /api/tags，其余走 /models），选中即回填；拉取期间切了服务商，这批结果作废、需要重取。' +
      '这一行是自由文本，不校验模型是否存在：名字写错面板不会拦，请求会被服务端直接拒绝。',
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
    desc: '单次回复的长度上限',
    help:
      '请求里的 max_tokens，是封顶值，不是每次都消耗这么多。解析顺序：本行按服务商存的覆盖值 > 按当前模型名查内置档位表（各模型的官方最大档，8K 到 384K 不等）> 该服务商注册表默认值；留空或填 0 都按未填处理。' +
      '输入框只做 0 到 200000 的格式钳制，与模型真实上限无关：填得比模型官方档位还大时插件不拦，由服务端以 400 拒绝整个请求。',
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
 * issue 433：行内「测试」按钮（输入框左侧，RowAction 统一渲染序）——对该行所属服务商发一次
 * 真实极小请求验证连通（testAIConnectivity 按 id 解析该家设置，不受当前下拉选中影响）。
 */
function providerGroupRows(): SettingsRow[] {
  const rows: SettingsRow[] = [
    {
      type: 'select',
      name: 'AI 服务商',
      desc: '当前使用的 AI 服务商',
      help:
        '切换服务商不影响已填内容：密钥、模型名、最大输出 token、思考档位都是按服务商分别存储（per-provider 覆盖），切回哪家就是哪家上次的值。' +
        '当前只有 deepseek、智谱 Plan、Ollama 三条通道。',
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
      actions: [{
        text: '测试',
        // issue 434 拍板：状态长在按钮上——点击转圈、成功绿✓、失败红✕，不弹通知不显详情
        stateful: true,
        onClick: async () => {
          await saveSettings(); // 先落盘防抖中的手输密钥——所配即所测
          await testAIConnectivity(p.id); // 抛错 = 红✕；成功 = 绿✓
        },
      }],
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
    desc: '思考档位，随服务商不同',
    help:
      '思考档位（reasoning effort），按服务商分别存储，切换服务商时选项表随之更换：DeepSeek 为关、低、高、最高；智谱 Plan 无关闭档（强制思考），只有低、高、最高；Ollama 为关、低、中、高。' +
      '选「跟随」＝不注入任何思考参数，交由模型默认。',
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
    desc: '向量化使用的嵌入模型',
    help:
      '第二大脑向量化用的模型，留空回落 bge-m3。换模型会改变向量维度，已建索引全部失效：第二大脑下次打开时自动全量重建，重建期间周期性落盘，中途关掉下次自动续建。' +
      '「获取模型」按 embedding 能力过滤，但只在 Ollama 返回 capabilities 字段时有效，旧版会把聊天模型一并列出。',
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
    desc: '本地 Ollama 服务地址',
    help:
      '桌面端第二大脑连接的 Ollama 地址，留空回落 http://localhost:11434。' +
      '移动端不读这一键：它读 secondBrainRemoteOllamaUrl，由桌面端启动时按本机 IP 自动维护。下面 Embedding 模型、重排模型两处「获取模型」就是去这个服务拉列表。',
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
 * issue 433/ADR-0190 起密钥/模型**按服务商分存**（`jevApiKeys` / `jevModels`，键 = 服务商 id）：
 * 密钥行与模型行走三函数绑定读当前服务商槽位 + refreshKey——切下拉两行显示值原地换成该家存的
 * 那份，互不覆盖（旧全局键经 onload 迁移进 typesafe 槽位，存量用户无感）。
 */
function jevGroupRows(): SettingsRow[] {
  return [
    {
      type: 'select',
      name: 'Jev 服务商',
      desc: '判定通道的服务商',
      help:
        'Jev 是与生成通道并存的判定通道：输入状态与类型化问题，输出类型化答案与校准概率，不生成文本，知识盒的关联判定走它。' +
        '可选 Typesafe 与博查两家，与上面生成内容用的 AI 服务商互不影响；切换后密钥与模型各自换成那一家。',
      binding: { key: 'jevProvider' },
      options: JEV_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })),
    },
    {
      type: 'secret',
      name: 'Jev 密钥',
      desc: '判定通道的接口密钥',
      binding: {
        get: () => jevScopedValue('keys'),
        set: (v) => setJevScopedValue('keys', v),
        save: () => {},
      },
      placeholder: '粘贴 Jev 密钥',
      refreshKey: () => jevScopedValue('keys'),
      actions: [jevTestAction()],
    },
    jevModelRow(),
  ];
}

/** 当前 Jev 服务商 id（设置未显式时取注册表缺省；口径同 core/jev 的 resolveJevConfig） */
function currentJevProviderId(): string {
  const s = tryGetSettings() as any;
  return String(s.jevProvider || '') || DEFAULT_JEV_PROVIDER;
}

/** 读当前服务商的分存槽位（keys = 密钥 map，model = 模型 map；空 = 显示空，回落逻辑在消费侧） */
function jevScopedValue(kind: 'keys' | 'model'): string {
  const s = tryGetSettings() as any;
  const map = kind === 'keys' ? s.jevApiKeys : s.jevModels;
  return String(map?.[currentJevProviderId()] ?? '');
}

/** 写当前服务商的分存槽位（空值 = 删键：密钥删即回落 LLM，模型删即回落该家缺省） */
function setJevScopedValue(kind: 'keys' | 'model', raw: string): void {
  const s = tryGetSettings() as any;
  const field = kind === 'keys' ? 'jevApiKeys' : 'jevModels';
  if (!s[field] || typeof s[field] !== 'object') s[field] = {};
  const map = s[field] as Record<string, string>;
  const v = raw.trim();
  if (v === '') delete map[currentJevProviderId()];
  else map[currentJevProviderId()] = v;
  void saveSettings();
}

/** 「测试」按钮（issue 434 拍板：状态长在按钮上——点击转圈、成功绿✓、失败红✕，不弹通知不显详情）。
 *  先落盘防抖中的手输值——所配即所测；失败经 reject 交给渲染器翻红叉，文案不外弹。 */
function jevTestAction(): RowAction {
  return {
    text: '测试',
    stateful: true,
    onClick: async () => {
      await saveSettings();
      await testJevConnectivity(); // 抛错 = 红✕；成功 = 绿✓
    },
  };
}

/** 「Jev 模型」行（issue 424/ADR-0184）：声明式 text + 行内「获取模型」按钮，照 Embedding 模型行范式
 *  （选中即回填一次到位——等选择器关闭再 resolve 动作 Promise，见该行注释）。空值回落服务商缺省
 *  （issue 430 起按服务商各配，见 core/jev 描述符的 defaultModel）。placeholder 钉 `jev-latest`
 *  只是示例展示（它在博查亦是有效别名），非全局缺省。
 *  issue 433：绑定改三函数读写当前服务商槽位 + refreshKey，随「Jev 服务商」切换联动换值；
 *  「获取模型」期间服务商被切则弃用结果（照 LLM 模型行的竞态口径）。 */
function jevModelRow(): SettingsRow {
  return {
    type: 'text',
    name: 'Jev 模型',
    desc: '判定通道使用的模型',
    help:
      '判定通道用哪个模型，按 Jev 服务商分别存储；留空就用该家的缺省模型（Typesafe 是 jev-latest，博查是 bocha-jev-v1）。「获取模型」调当前服务商的模型列表，拉取期间切了服务商则弃用结果、需要重取。' +
      '与「模型名称」一样是自由文本，不做格式校验，名字写错由服务端报错。',
    placeholder: 'jev-latest',
    binding: {
      get: () => jevScopedValue('model'),
      set: (v) => setJevScopedValue('model', v),
      save: () => {},
    },
    refreshKey: () => jevScopedValue('model'),
    actions: [{
      text: '获取模型',
      onClick: async (_value, ctx) => {
        try {
          await saveSettings(); // 先落盘防抖中的手输值，再读当前状态拉取
          const providerId = currentJevProviderId();
          const models = await fetchJevModels();
          // 拉取期间服务商仍可能被切——以当前为准，不一致即弃用（照 LLM 模型行口径）
          if (currentJevProviderId() !== providerId) {
            notice('服务商已切换，请重新获取', 'warning');
            return;
          }
          await new Promise<void>((resolve) => {
            openModelPicker({
              providerLabel: getJevProviderDescriptor(providerId).label,
              current: jevScopedValue('model'),
              models,
              onPick: (m) => {
                setJevScopedValue('model', m.id);
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
 * issue 431/ADR-0189：行序 = 地址 → 嵌入模型 → 重排总闸（改常显）→ 「重排走 Jev」（通道二选一）
 * → 「重排模型」（本地通道专属，Jev 开时隐藏）。
 */
function embeddingGroupRows(): SettingsRow[] {
  return [ollamaLocalUrlRow(), embeddingModelRow(), rerankToggleRow(), jevRerankToggleRow(), rerankModelRow()];
}

/**
 * 「启用重排」总闸（issue 427/ADR-0186 建；issue 431/ADR-0189 改常显）：召回结果交重排通道精排，
 * 相关笔记排序更准（分数与阈值仍走原始余弦单尺，重排只改顺序，见 secondbrain/vector-store）。
 * 默认开。原「仅 8B 嵌入时可见」的门随 Jev 第二通道的引入收窄给本地通道（`rerankChannel()`）——
 * 总闸常显、desc 静态写明双通道各自门槛（Q7 拍板：非 8B + Jev 关 / Jev 无密钥的「总闸开着但
 * 无通道生效」状态靠 desc 交代，不做动态警示）。
 */
function rerankToggleRow(): SettingsRow {
  return {
    type: 'toggle',
    name: '启用重排',
    desc: '召回结果再精排，相关笔记排序更准',
    help:
      '检索分两段：先用向量召回一批候选，再用 rerank 模型对这批候选重新排序。' +
      '只改顺序、不动向量索引，关掉照样搜得到，只是排序精度下降。它是下面「重排走 Jev」「重排模型」两行的总开关。',
    binding: { key: 'secondBrainRerank' },
  };
}

/**
 * 「重排走 Jev」开关（issue 431/ADR-0189）：与「启用重排」总闸构成通道二选一——开启后检索重排
 * 走 AI 面板 JEV 组配置的 Jev 通道（noul 判定，见 secondbrain/rerank-jev），本地「重排模型」行
 * 隐藏；不绑 8B 嵌入门（云端判定不吃本地显存，任何嵌入模型可用）。可见性 = 总闸开（通道选择
 * 只在重排开启时有意义）；Jev 未配密钥时运行期自动回余弦序（judgeOrFallback 类别①不发请求），
 * desc 静态交代、不做动态警示（Q7 拍板）。
 */
function jevRerankToggleRow(): SettingsRow {
  return {
    type: 'toggle',
    name: '重排走 Jev',
    desc: '改用 Jev 模型云端重排',
    help:
      '重排有两个通道：本地 rerank 模型，或 Jev 判定通道（云端）。' +
      '开启即改用 Jev，下面本地「重排模型」一行随之隐藏。Jev 未配密钥时运行期自动回落余弦相似度排序，不报错。',
    binding: { key: 'secondBrainRerankJev' },
    visibleWhen: (snapshot) => snapshot.secondBrainRerank !== false,
  };
}

/**
 * 「重排模型」行（issue 429，用户拍板「开启重排之后还要显示一个选择重排模型的选项」）：
 * 照 Embedding 模型行范式——行内「获取模型」拉同一台 Ollama 的已装模型（名字含 rerank 的
 * 优先，见 core/ai-models pickRerankModels），选中即写入 secondBrainRerankModel。
 * 可见性 = 8B 嵌入 ∧ 总闸非关 ∧ Jev 关（issue 431/ADR-0189：本行是**本地通道**专属，
 * Jev 通道开时隐藏——通道二选一；换它不动向量索引，下一次检索即生效，重排是纯换序层）。
 */
function rerankModelRow(): SettingsRow {
  return {
    type: 'text',
    name: '重排模型',
    desc: '重排通道使用的模型',
    help:
      '本地 rerank 模型，留空回落内置的 Qwen3-Reranker-4B。' +
      '本地重排只在嵌入模型是 Qwen3-Embedding-8B 时可用：换成别的嵌入模型后，即便总闸开着，重排通道判定为 off，这一行也不会出现。',
    placeholder: 'dengcao/Qwen3-Reranker-4B:Q4_K_M',
    binding: { key: 'secondBrainRerankModel' },
    visibleWhen: (snapshot) =>
      isQwen3Embedding8b(snapshot.secondBrainEmbeddingModel) &&
      snapshot.secondBrainRerank !== false &&
      snapshot.secondBrainRerankJev !== true,
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
      desc: '豆瓣字段接口的密钥',
      help:
        '影院取豆瓣字段的密钥，用来补齐评分、导演、主演、类型、地区、片长这些字段。留空则不走这条通道，改由内置的演职员信息兜底，能取到多少算多少。' +
        '它只影响影院条目的字段来源，不参与搜索，也不决定抓取本身能不能跑起来。',
      binding: { key: 'cinemaApizeroKey' },
      placeholder: '粘贴密钥',
    },
    {
      type: 'secret',
      name: 'B站 Cookie',
      desc: '视频录入解析清晰度用的凭据',
      help:
        '录入 B 站视频时解析可用清晰度的登录凭据；没有它只回落固定清晰度列表。值可从浏览器登录后的请求头复制。' +
        '桌面端有「从 CLI 导入」，读本机 ~/.bilibili-cookies.json 填进来；移动端没有这个按钮，因为读不到本机文件。',
      binding: { key: 'bilibiliCookie' },
      placeholder: '粘贴从浏览器复制的 Cookie',
      actions: isDesktopShell() ? [{ text: '从 CLI 导入', onClick: () => importCliBilibiliCookie() }] : [],
    },
    {
      type: 'secret',
      name: '豆瓣 Cookie',
      desc: '豆瓣搜索被风控时用的登录凭据',
      help:
        '豆瓣搜索的风控凭据：被风控后抓取失败，填上登录 Cookie 可缓解（三条检索链路都会带上）。' +
        '拦截会由队列聚合通知与表单提示报出来，不会静默失败。',
      binding: { key: 'cinemaDoubanCookie' },
      placeholder: '粘贴从浏览器复制的 Cookie',
    },
  ];
}

/**
 * 「语音转写」组行（issue 444）：知识盒视频录入转文字的引擎二选一——SenseVoice-Small（缺省，
 * funasr 识别，中文效果更好）/ faster-whisper（备选）。两种引擎共用文献盒的 Python 路径
 * （knowledgePythonPath，原「工具」组 2026-09-16 移除后键保留、值继续生效）。
 * - 「Whisper 档位」行仅 faster-whisper 引擎时显示（visibleWhen）——SenseVoice 模型固定
 *   iic/SenseVoiceSmall，无档位可调；
 * - 下发链路（knowledge/processor.ts）：engine 恒下发，whisperModel 仅 faster-whisper 时下发。
 */
function asrGroupRows(): SettingsRow[] {
  return [
    {
      type: 'select',
      name: '转写引擎',
      desc: '视频转文字的识别引擎',
      help:
        '知识盒把视频转成文字时用哪个引擎。SenseVoice-Small 是缺省档，走 funasr，中文识别更好；faster-whisper 是备选，选它之后才会多出「Whisper 档位」这一行。' +
        '两者都通过外部 Python 执行，环境里缺对应的包时整批转写会失败，错误提示里会点名缺的是哪个。',
      binding: { key: 'asrEngine' },
      options: [
        { value: 'sensevoice', label: 'SenseVoice-Small' },
        { value: 'faster-whisper', label: 'faster-whisper' },
      ],
    },
    {
      type: 'select',
      name: 'Whisper 档位',
      desc: 'faster-whisper 的模型档位',
      binding: { key: 'asrWhisperModel' },
      options: [
        { value: 'tiny', label: 'tiny（最快）' },
        { value: 'base', label: 'base' },
        { value: 'small', label: 'small（缺省）' },
        { value: 'medium', label: 'medium' },
        { value: 'large-v2', label: 'large-v2' },
        { value: 'large-v3', label: 'large-v3（最准）' },
      ],
      visibleWhen: (snapshot) => snapshot.asrEngine === 'faster-whisper',
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
 *  服务商 / 密钥 / 模型三行（总开关、端点、超时三行退役——常开、端点由服务商决定、超时固定）。
 *  issue 444：追加「语音转写」组（转写引擎二选一 + Whisper 档位，知识盒视频录入转文字消费）。 */
export function aiSettingsSchema(): SettingsSchema {
  return {
    groups: [
      { icon: 'cpu', name: 'LLM', rows: llmGroupRows() },
      { icon: 'binary', name: 'Embedding', rows: embeddingGroupRows() },
      { icon: 'route', name: 'JEV', rows: jevGroupRows() },
      { icon: 'mic', name: '语音转写', rows: asrGroupRows() },
      { icon: 'key-round', name: '数据源凭据', rows: credentialGroupRows() },
    ],
  };
}

/** 通用设置组（原「全局」数据存储路径区块；issue 186 拆出 AI 后的剩余全局项）。
 *  2026-09-12：通知组拆出为独立面板页（noticeSettingsSchema），本组只剩数据存储路径。
 *  2026-09-26：补「使用手册」按钮（core/manual 单源）——手册不随构建分发，
 *  点按钮从 GitHub 拉取写进插件安装目录，已下载则直接打开（一个控件按状态分岔）。 */
export function generalSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'book-open',
        name: '使用手册',
        rows: [
          {
            type: 'button',
            name: '使用手册',
            desc: '首次点击从 GitHub 拉取手册写入插件目录并自动打开，已下载则直接打开',
            buttonText: '使用手册',
            onClick: () => {
              void (async () => {
                const app = getApp();
                try {
                  if (!(await hasManual(app))) {
                    notice('正在从 GitHub 下载使用手册…', 'info');
                    await downloadManual(app);
                    notice('手册已下载到插件目录', 'success');
                  }
                  openManual(app);
                } catch (e) {
                  notice((e as Error)?.message || '手册下载失败', 'error');
                }
              })();
            },
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '数据存储路径',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '数据存储路径',
            desc: '全部 JSON 数据文件统一存放的目录',
            help:
              '各域的明文数据都在这里，一个域一份 JSON。加密密文放在本目录下的 .ENCRYPT 子目录里，剪藏的网页图片等媒体仍走 vault 附件目录。带 .vec 的是向量文件，二进制，打不开看。' +
              '\n- belongings.json 归物本\n- clipbook.json 剪藏本侧写\n- news.json 剪藏未读流\n- favorites.json 收藏本' +
              '\n- memo.json 备忘录\n- pomodoro.json 番茄钟\n- review.json 复习计划\n- review-fit.json 复习拟合参数\n- quiz.json 复习做题' +
              '\n- knowledge.json 知识盒\n- mount-suggest.json 挂载建议缓存\n- secondbrain.json 第二大脑\n- secondbrain.vec 第二大脑向量' +
              '\n- home.json 内容首页\n- smartcat.json 小橘\n- smartcat-memory.json 小橘记忆流\n- smartcat-memory-vectors.vec 小橘记忆向量' +
              '\n- smartcat-behavior.json 小橘行为流\n- people.json 脸谱\n- people-preview.json 脸谱预览缓存\n- people-jobs.json 脸谱导入任务' +
              '\n- lock-stats.json 锁屏统计\n- weave-data.json 书库阅读数据',
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
            desc: '展示哪些级别的通知',
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
            desc: '每条通知停留的时长',
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
            desc: '通知弹出的屏幕位置',
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
            desc: '同屏最多的通知条数',
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
