/**
 * 第二大脑行为单源 · sim 启动入口（issue 251 / ADR-0106 / ADR-0110）
 *
 * 评审壳侧启动器：把真行为层（panel/chat-panel/reference-panel 及其依赖链）在浏览器里
 * 跑起来。与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（setApp 真身）：vault = localStorage 文件系统（带 adapter
 *     存储面，secondbrain.json / secondbrain.vec 的读写与占用统计全真）；
 *   - 种子数据：window.SBD_SIM（prototype-data.js，真实库快照精简同构：65 篇样本笔记
 *     + 真实 AI 库摘要 + 真实建链记录 + 真实上一场对话）首启写为 CONFIG/STORAGE 下的
 *     secondbrain.json——真 VectorStore.load 原样装载，isIndexReady 即刻为真；
 *   - 检索：原型无 Ollama → 真 VectorStore.search 走「降级文本匹配」真降级链
 *     （参考列表出现降级脚注 = 真实语义）；对话 RAG 每问独立检索同链；
 *   - AI：fake-sim patch window.fetch 拦截 /chat/completions，按关键词返回策划回答的
 *     SSE 流——core/ai 的流式解析 / onDelta / AbortController 取消全真跑；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入 secondbrain
 *     实际键；linkAgentEnabled=false 避免启动 bundle 的 link-agent 空转）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_secondbrain，壳只调 boot + 三个 open。
 * 插件的 ui 行为文件（panel/chat-panel/reference-panel/float-window/ui-tools）与
 * core 服务一律零改动——行为代码单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider, setSettingsSaver } from '../core/settings-provider';
import { setAISettingsProvider } from '../core/ai';
import { SecondBrainPanel } from './panel';
import { ChatPanel } from './chat-panel';
import { ReferencePanel } from './reference-panel';
import { MobilePanel } from './mobile-panel';
import { IS_MOBILE } from './config';

/**
 * SimVectorStore：VectorStore 的数据面假实现（ADR-0106；真 VectorStore 的 refresh
 * 运维语义要求白名单内存在真实 vault 笔记，演示快照无法满足——白名单空会按 ticket 103
 * 语义清库）。UI 行为层消费面（meta/initialLoad/isIndexReady/isRefreshing/
 * hasPendingChanges/refresh/rebuildAll/vectors/search + 移动抽屉面 initMobile/
 * searchMobile/notes）逐一鸭子类型实现：
 *   - search = 演示快照上的真实文本匹配（标题+段落包含计分），与真降级链同形态；
 *   - refresh/rebuildAll = 模拟进度文案（onboard 进度视图全真渲染）。
 */
class SimVectorStore {
  meta: { version: number; notes: Record<string, { mtime: number; chunks: { text: string }[] }>; _dim: number };
  dim = 1024;
  vectors = new Float32Array(0);
  initialLoad: Promise<void> = Promise.resolve();
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    const sim = window.SBD_SIM!;
    this.meta = sim.store.meta;
    // vectors.length / dim = 行数：与 meta 段数一致 → 主面板健康判定「索引一致」自洽
    const rows = Object.keys(this.meta.notes).length;
    this.vectors = new Float32Array(rows * this.dim);
  }

  isIndexReady(): boolean {
    return Object.keys(this.meta.notes).length > 0;
  }
  isRefreshing(): boolean {
    return this.refreshPromise !== null;
  }
  hasPendingChanges(): boolean {
    return false;
  }
  /** 移动端检索面（mobile-panel 消费）：与桌面 search 同一演示匹配链 */
  async searchMobile(query: string, topK = 20): Promise<Array<{ path: string; chunk: string; score: number }>> {
    return this.search(query, topK);
  }
  /** mobile-panel AI tab 欢迎语消费面（store.notes 键数） */
  get notes(): Record<string, { mtime: number; chunks: { text: string }[] }> {
    return this.meta.notes;
  }
  async refresh(cb?: (msg: string) => void): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      cb?.('扫描 vault 变更…');
      await new Promise((r) => setTimeout(r, 350));
      cb?.('✅ 向量化完成：演示快照无变更');
    })();
    await this.refreshPromise;
    this.refreshPromise = null;
  }
  async rebuildAll(cb?: (msg: string) => void): Promise<void> {
    const total = Object.keys(this.meta.notes).length;
    for (let i = 1; i <= 5; i++) {
      cb?.(`向量化: ${Math.round((i / 5) * total)}/${total}`);
      await new Promise((r) => setTimeout(r, 280));
    }
    cb?.('✅ 向量化完成：演示快照（全量重嵌）');
  }
  /** 移动端初始化（index.ts IS_MOBILE 分支调用；演示快照已就绪，无事可做） */
  async initMobile(): Promise<string | null> {
    return null;
  }
  /** 演示检索：标题+段落包含计分（真 search 的降级文本匹配同形态输出） */
  async search(query: string, topK = 20): Promise<Array<{ path: string; chunk: string; score: number }>> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // 中文无空格分词：整句 + 二元滑窗（「为什么会遗忘」→ 为什么/什么/会遗/遗忘…）
    const termSet = new Set<string>();
    for (const t of q.split(/\s+|，|,|？|\?|。|、/)) if (t.length >= 2) termSet.add(t);
    for (let i = 0; i < q.length - 1; i++) {
      const g = q.slice(i, i + 2);
      if (/[一-鿿]/.test(g)) termSet.add(g);
    }
    const terms = [...termSet];
    const scored: Array<{ path: string; chunk: string; score: number }> = [];
    for (const [path, entry] of Object.entries(this.meta.notes)) {
      const name = path.split('/').pop()!.replace(/\.md$/i, '');
      let score = 0;
      for (const t of terms) {
        if (name.toLowerCase().includes(t)) score += 0.45;
        for (const c of entry.chunks) {
          if (c.text.toLowerCase().includes(t)) score += 0.2;
        }
      }
      if (score > 0) {
        score = Math.min(0.95, score);
        scored.push({ path, chunk: entry.chunks[0]?.text || '', score: Math.round(score * 100) / 100 });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

declare global {
  interface Window {
    SBD_SIM?: {
      store: {
        version: number;
        meta: { version: number; notes: Record<string, { mtime: number; chunks: { text: string }[] }>; _dim: number };
        panel: { summary: string; generatedAt: number };
        link: { queue: unknown[]; state: Record<string, { hash: string; linkedAt: string }> };
        chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
      };
      fakeVecB64: string;
    };
  }
}

const STORE_JSON = 'CONFIG/STORAGE/secondbrain.json';
const STORE_VEC = 'CONFIG/STORAGE/secondbrain.vec';

let simApp: FakeApp | null = null;
let store: SimVectorStore | null = null;
let panel: SecondBrainPanel | null = null;
let chat: ChatPanel | null = null;
let reference: ReferencePanel | null = null;
let mobile: MobilePanel | null = null;

/** 演示问句 → 策划回答（fetch 拦截用；关键词覆盖推荐问法与常见说法） */
const DEMO_ANSWERS: Array<[string[], string]> = [
  [
    ['遗忘', '记不住', '记忆'],
    '根据库内检索结果，与遗忘直接相关的记录有几条：\n\n1. **艾宾浩斯遗忘曲线**（92%）——遗忘在学习之后立即开始，先快后慢。\n2. **短时记忆遗忘**（86%）——短时记忆未复述约 30 秒内消退。\n\n综合来看：对抗遗忘的核心是**在遗忘临界点前主动提取**（复述/测试），这与费曼学习法的「讲给别人听」是同一原理。',
  ],
  [
    ['享乐', '快乐', '幸福'],
    '库里关于享乐适应积累较厚：**享乐适应**——无论发生什么好事或坏事，幸福感都会回归基线；**PERMA模型**给出了幸福感可操作的五个支柱。\n\n换个角度看，它提醒人们的或许不是快乐终将消失，而是**快乐太容易融入日常，以至于不再被察觉**。',
  ],
  [
    ['笔记', '记笔记', '卢曼'],
    '与记笔记最相关的是**卢曼卡片笔记法**：知识网络的价值来自笔记之间的连接而非数量。配合**费曼学习法**（以教代学）效果最好。',
  ],
  [
    ['睡', '失眠', 'REM'],
    '库内与睡眠相关的记录：**REM睡眠**（快速眼动期与记忆巩固相关）、**褪黑素**（昼夜节律）、**CBTI**（失眠的认知行为疗法，一线非药物方案）。',
  ],
  [['闪电'], '库里有两篇与闪电相关：**闪电化石**（雷击石英留下的管状玻璃，可用于追溯远古雷暴）与**精灵闪电**（雷暴云顶上方的短暂放电现象）。'],
  [
    ['王阳明', '心学'],
    '与王阳明相关：**王阳明心学精要**（知行合一/致良知）、**安心立命**。心学强调「事上磨练」——知识与行动在第二大脑里也是同一件事。',
  ],
];

function pickAnswer(q: string): string {
  for (const [kws, ans] of DEMO_ANSWERS) if (kws.some((k) => q.includes(k))) return ans;
  return `已检索库内相关段落（演示环境走降级文本匹配）。这个问题在当前演示快照里的直接命中不多——试试「遗忘」「享乐」「记笔记」「睡眠」「闪电」「王阳明」这些库里积累较厚的方向。`;
}

/** 拦截 /chat/completions：把策划回答包装成 SSE 流（core/ai 的流式解析全真跑） */
function patchFetch(): void {
  if ((globalThis as any).__bzSbFetchPatched) return;
  (globalThis as any).__bzSbFetchPatched = true;
  const orig = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/chat/completions')) {
      let q = '';
      try {
        const body = JSON.parse(String(init?.body || '{}'));
        const m = String(body.messages?.[0]?.content || '').match(/【问题】\n([\s\S]*)$/);
        q = m ? m[1] : '';
      } catch {}
      const text = pickAnswer(q);
      const sse = text
        .match(/[\s\S]{1,24}/g)!
        .map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
        .join('') + 'data: [DONE]\n\n';
      const stream = new Response(sse).body;
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    // 其余请求（嵌入等）：网络层不存在，直接失败走真降级链
    return orig(input as never, init);
  }) as typeof fetch;
}

function seed(): void {
  const sim = window.SBD_SIM;
  if (!sim) throw new Error('prototype-data.js 未载入（window.SBD_SIM 缺失）');
  const set = (path: string, content: string) => localStorage.setItem('bz-sb-sim:' + path, content);
  if (!localStorage.getItem('bz-sb-sim:' + STORE_JSON)) {
    set(STORE_JSON, JSON.stringify(sim.store));
    set(STORE_VEC, sim.fakeVecB64);
  }
}

/** 注入 secondbrain 实际设置键（真 settings-provider 实现；无持久化需求走内存默认值） */
function injectSettings(): void {
  const settings: Record<string, unknown> = {
    secondBrainEnabled: true,
    aiProvider: 'deepseek', // 对话走 deepseek 通道；网络层由 patchFetch 拦截（无真实请求）
    deepseekApiKey: 'demo-key',
    linkAgentEnabled: false, // 原型不跑自动双链（避免空转队列）
    secondBrainTopK: '20',
    secondBrainChatTopK: '20',
    secondBrainChunkMinLength: '50',
    secondBrainContextLimit: '600',
    secondBrainDebounceDelay: '300',
    secondBrainCursorPollInterval: '500',
    secondBrainMaxHistory: '10',
    secondBrainOllamaUrl: 'http://localhost:11434',
    secondBrainEmbeddingModel: 'bge-m3',
    secondBrainDeepseekModel: 'deepseek-v4-flash',
    secondbrainSkin: 'default',
    secondbrainSkinTheme: 'graphite',
  };
  setSettingsProvider(() => settings as never);
  setSettingsSaver(async () => {});
  // core/ai 独立设置面（AI 服务商解析）：deepseek + 占位密钥，网络层由 patchFetch 拦截
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'demo-key' } as never));
}

/** 确保共享依赖就绪 + 真 VectorStore 装载种子库 */
export function bootSecondBrainSim(): void {
  const g = globalThis as any;
  if (g.__bzSbSimBooted) return;
  g.__bzSbSimBooted = true;
  seed();
  patchFetch();
  const app = new FakeApp();
  simApp = app;
  setApp(app as never);
  injectSettings();
}

async function ensureStore(): Promise<SimVectorStore> {
  if (!simApp) bootSecondBrainSim();
  if (!store) {
    store = new SimVectorStore();
    await new Promise((r) => setTimeout(r, 120)); // 模拟装载节奏（进度态可感知）
  }
  return store;
}

/** 打开主面板（命令 bz-secondbrain-open 同语义） */
export async function openPanel(): Promise<void> {
  const s = await ensureStore();
  if (!panel) {
    panel = new SecondBrainPanel(simApp as never, s as never, {
      onOpenReference: () => void openRef(),
      onOpenChat: () => void openChat(),
    });
  }
  await panel.open();
}

/** 打开 AI 对话（命令 bz-secondbrain-chat 同语义；移动端与 index.ts 同分发→抽屉 AI tab） */
export async function openChat(): Promise<void> {
  const s = await ensureStore();
  if (IS_MOBILE) {
    mobile ??= new MobilePanel(simApp as never, s as never);
    mobile.switchTab('chat');
    mobile.show();
    return;
  }
  if (!chat) chat = new ChatPanel(s as never, simApp as never);
  chat.show();
}

/** 打开灵感参考（命令 bz-secondbrain-open/reference 同语义；移动端→抽屉参考 tab） */
export async function openRef(): Promise<void> {
  const s = await ensureStore();
  if (IS_MOBILE) {
    mobile ??= new MobilePanel(simApp as never, s as never);
    mobile.show();
    return;
  }
  if (!reference || !reference.alive) reference = new ReferencePanel(simApp as never, s as never);
  reference.fw.show();
}

/**
 * 演示辅助：注入「当前编辑笔记上下文」并驱动参考面板刷新——
 * FakeEditor 只实现 getCurrentContext 消费的 getCursor/getLine 面，
 * 真检索链（getCurrentContext → store.search → 渲染）原样跑。
 */
export function demoReferenceQuery(query: string): void {
  if (!simApp) bootSecondBrainSim();
  const editor = {
    getCursor: () => ({ line: 0, ch: 3 }),
    getLine: () => query,
    getValue: () => query,
  };
  (simApp!.workspace as { activeEditor: unknown }).activeEditor = { editor };
  void openRef().then(() => {
    // 移动端抽屉无 ReferencePanel 实例：直接喂演示检索（否则要等光标轮询一拍）
    if (IS_MOBILE) {
      void mobile?.refreshResults(query);
      return;
    }
    void reference?.refreshWithDebounce();
  });
}
