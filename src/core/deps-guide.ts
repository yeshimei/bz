/* ============================================================
 * bz · 「bz 依赖什么」弹窗（core/deps-guide.ts）
 *
 * 引导页的下载队列只管「搬得进插件目录」的东西。剩下几层（Node、Python、Ollama、
 * 向量模型、ffmpeg、pip 依赖）搬不动也不该搬——它们是**系统级**运行时而插件只有
 * 一个仓库目录。所以这个弹窗不做安装，只做三件事：
 *
 *   1. 把要装什么列成一张勾选清单（体积、必装、组内单选都由 deps-plan 的数据驱动）；
 *   2. 按勾选实时生成一段**自足的提示词**——粘给 AI 或自己照着敲都能走完；
 *   3. 复制走。
 *
 * 为什么单独成模块而不是留在 setup-wizard 里：**三个地方都要它**——
 * 引导完成屏的「安装外部工具」、设置 → AI → Embedding 的「怎么装」、
 * 第二大脑失败态的「Ollama 没装或没启动？」。同一份清单、同一套文案，
 * 分头写三遍必然漂。
 *
 * 形制（2026-11-01 用户拍板「1:1 复刻原型」）：照 .scratch/deps-guide-proto 定稿稿，
 * 逐段——头行 / 正文（分组卡：普通项走行，模型项走表）/ 提示词 / 底栏。
 * 为什么这里不套引导页那套 .bz-setup-* 皮：这一屏是**挑东西**，嵌入模型要横着比
 * 分数、体积、显存，逐行清单比不出来。两套皮各有各的读法，别互相迁就。
 *
 * 数据与提示词在 deps-plan.ts（纯函数，能单测）；这里只管画和点。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { embeddingServiceUrl } from './ai-models';
import { tryGetSettings } from './settings-provider';
import { getApp } from './app';
import { notice } from './notice';
import { pluginDirOf, vaultBasePathOf } from './plugin-path';
import {
  PLAN_GROUPS,
  PLAN_ITEMS,
  PLAN_TUTORIAL_URL,
  buildPlanPrompt,
  defaultPicked,
  formatSize,
  summarize,
  toggleRadio,
  type PlanItem,
  type PlanItemId,
} from './deps-plan';

/* ---------- 最小 DOM 工具 ---------- */

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- 本机探测（外部消费方在用，不是本弹窗的渲染依赖） ---------- */

/** 云端 AI 配没配（与 env-check 的 aiConfigured 同口径：本地 Ollama 无需密钥即视为已配） */
export function cloudAiConfigured(): boolean {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    const provider = String(s?.aiProvider || 'deepseek');
    if (provider === 'ollama') return true;
    const key = provider === 'zhipu-plan' ? s?.zhipuPlanApiKey : s?.deepseekApiKey;
    return !!String(key ?? '').trim();
  } catch {
    return false;
  }
}

/** Ollama 服务探活（超时 → 当没起；服务没起不是错误，只是这一项还没配） */
export async function probeOllamaService(timeoutMs = 3000): Promise<{ up: boolean; models: string[] }> {
  if (typeof fetch !== 'function') return { up: false, models: [] };
  const base = embeddingServiceUrl().replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) return { up: false, models: [] };
    const data = (await res.json().catch(() => null)) as { models?: Array<{ name?: unknown }> } | null;
    const models = Array.isArray(data?.models) ? data.models.map((m) => String(m?.name || '')) : [];
    return { up: true, models };
  } catch {
    return { up: false, models: [] };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 勾选框 ---------- */

/**
 * 一个勾选框：必装项固定勾上并 disabled——`disabled` 的 input 不进 Tab 序列、
 * `change` 也不触发，所以它不会参与 picked 的增删（picked 里那几项由 defaultPicked()
 * 一次性放进去，之后没人动它们）。
 *
 * 外观全部自绘（.bz-deps-ck，`:checked` 用伪元素画勾）：原生 checkbox 在 Obsidian 里
 * 会被主题重写成不同的填充与勾形，同一个弹窗在别人的主题下就变样了。
 */
function checkboxOf(item: PlanItem): HTMLInputElement {
  const input = document.createElement('input');
  input.type = item.radio ? 'radio' : 'checkbox';
  if (item.radio) input.name = `bz-deps-${item.radio}`;
  input.className = item.radio ? 'bz-deps-ck bz-deps-ck--r' : 'bz-deps-ck';
  input.value = item.id;
  input.checked = !!(item.required || item.pickedByDefault);
  if (item.required) input.disabled = true;
  input.setAttribute('aria-label', item.name);
  return input;
}

/** 名称（可链到下载页 / Ollama 库页）+ 徽章 */
function nameNode(item: PlanItem): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (item.url) {
    const a = document.createElement('a');
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.className = 'bz-deps-a';
    a.textContent = item.name;
    frag.appendChild(a);
  } else {
    frag.appendChild(document.createTextNode(item.name));
  }
  if (item.pill) {
    frag.appendChild(el('i', `bz-deps-pill${item.pillDim ? ' bz-deps-pill--dim' : ''}`, item.pill));
  }
  return frag;
}

/* ---------- 模型表（嵌入 / 重排 / 转写） ---------- */

/** 单选组 → 表头 + 其余列怎么取（名称列单独画，含勾选框与链接） */
const RADIO_TABLES: Record<
  'embed' | 'rerank' | 'asr',
  { head: string[]; cells: (item: PlanItem) => Array<{ text: string; wrap?: boolean }> }
> = {
  embed: {
    head: ['向量模型', 'MTEB 参考分', '下载体积', '显存'],
    // 分数这一列允许换行：口径说明（「多模式，无单一分数」）比数字长，压成一行会把表挤歪
    cells: (i) => [
      { text: i.score || '—', wrap: true },
      { text: i.size },
      { text: i.vram || '—' },
    ],
  },
  rerank: {
    head: ['重排模型', '体积'],
    cells: (i) => [{ text: i.size }],
  },
  asr: {
    head: ['引擎', '语言', '模型体积'],
    cells: (i) => [{ text: i.lang || '—', wrap: true }, { text: i.size }],
  },
};

/** 一张模型表：行 = 组内单选项；`推荐` 徽章有意的那两行铺一层极淡品牌底（原型 tr.hl） */
function tableOf(
  kind: 'embed' | 'rerank' | 'asr',
  items: PlanItem[],
  sink: Array<{ item: PlanItem; input: HTMLInputElement }>,
): HTMLElement {
  const spec = RADIO_TABLES[kind];
  const table = el('table', 'bz-deps-tb');

  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of spec.head) htr.appendChild(el('th', '', h));
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const item of items) {
    const tr = document.createElement('tr');
    if (item.pill && !item.pillDim) tr.className = 'is-hl';

    const nameTd = el('td', 'bz-deps-name');
    const input = checkboxOf(item);
    nameTd.appendChild(input);
    nameTd.appendChild(nameNode(item));
    tr.appendChild(nameTd);
    sink.push({ item, input });

    for (const c of spec.cells(item)) {
      tr.appendChild(el('td', `bz-deps-num${c.wrap ? ' bz-deps-num--wrap' : ''}`, c.text));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

/* ---------- 弹窗 ---------- */

/**
 * 打开「bz 依赖什么」。
 *
 * @param app 插件 app（用来取仓库与插件目录的绝对路径，好把「别装这里」写清楚）；
 *   不传就现取——调用方（设置页、面板）都不必自己持有 app 引用。
 */
export function openDepsGuide(app: unknown = getApp()): void {
  const ctx = { pluginDir: pluginDirOf(app), vaultDir: vaultBasePathOf(app) };
  let picked = defaultPicked();

  const root = el('div', 'bz-deps');

  /* 头行：标题 + 关闭（uiModal 的头行只有标题，这里要原型那颗 ✕） */
  const head = el('div', 'bz-deps-h');
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'bz-deps-x';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', '关闭');
  head.append(el('span', 'bz-deps-t', 'bz 依赖什么'), closeBtn);

  const body = el('div', 'bz-deps-b');
  root.append(head, body);

  const handles: Array<{ item: PlanItem; input: HTMLInputElement }> = [];
  /** 普通项右格（Ollama 那一行要换成探活结果，得留个引用） */
  const valNodes = new Map<PlanItemId, HTMLElement>();

  for (const groupName of PLAN_GROUPS) {
    const items = PLAN_ITEMS.filter((i) => i.group === groupName);
    if (!items.length) continue;

    const group = el('div', 'bz-deps-grp');
    group.appendChild(el('div', 'bz-deps-grp-h', groupName));
    const card = el('div', 'bz-deps-card');

    // 先普通项（Ollama / ffmpeg / pycryptodome 这些），再模型表——原型的顺序就是这么排的
    for (const item of items.filter((i) => !i.radio)) {
      const row = el('div', 'bz-deps-row');
      const input = checkboxOf(item);
      const key = el('span', 'bz-deps-key');
      key.appendChild(nameNode(item));
      if (item.required) key.appendChild(el('i', 'bz-deps-req', '必装'));
      const val = el('span', 'bz-deps-val', item.size);
      row.append(input, key, val);
      card.appendChild(row);
      handles.push({ item, input });
      valNodes.set(item.id, val);
    }

    // 模型项按单选组分表（嵌入 / 重排叠在同一张卡里，第二种起加一条分隔线）
    const kinds = [...new Set(items.filter((i) => i.radio).map((i) => i.radio!))];
    if (kinds.length) {
      const wrap = el('div', 'bz-deps-tw');
      kinds.forEach((kind, idx) => {
        const table = tableOf(kind, items.filter((i) => i.radio === kind), handles);
        if (idx === 0) {
          wrap.appendChild(table);
        } else {
          const sub = el('div', 'bz-deps-sub');
          sub.appendChild(table);
          wrap.appendChild(sub);
        }
      });
      card.appendChild(wrap);
    }

    group.appendChild(card);
    body.appendChild(group);
  }

  // 提示词预览：勾选一变就重写文本（不是按需生成——用户要能看到「我选了什么」的即时结果）
  // 提示词框上面不再挂「改动写进哪个文件 / 要改哪几个键」的说明（2026-11-01 用户拍板：
  // 那两行是给实现看的，不是给用户看的）——数据文件路径与键名都在提示词正文里，
  // 复制出去 AI 拿得到就够了。
  const pbox = el('div', 'bz-deps-pbox');
  const phead = el('div', 'bz-deps-pbox-h');
  phead.append(el('span', '', '复制给 AI 的提示词'), el('span', '', '路径按你本机自动填好'));
  const pre = document.createElement('pre');
  pbox.append(phead, pre);
  body.appendChild(pbox);

  /* 底栏：汇总 + 两个动作 */
  const bar = el('div', 'bz-deps-bar');
  const sum = el('span', 'bz-deps-sum');
  const cntNode = el('b', '', '0');
  const sizeNode = el('b', '', '0');
  sum.append(document.createTextNode('已选 '), cntNode, document.createTextNode(' 项 · 约 '), sizeNode);

  const acts = el('div', 'bz-deps-acts');
  const videoBtn = document.createElement('button');
  videoBtn.type = 'button';
  videoBtn.className = 'bz-btn';
  videoBtn.textContent = '看教程视频';
  if (!PLAN_TUTORIAL_URL) {
    videoBtn.disabled = true;
    videoBtn.title = '教程视频地址待定';
  }
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'bz-btn bz-btn--primary';
  copyBtn.textContent = '复制提示词';
  acts.append(videoBtn, copyBtn);
  bar.append(sum, acts);
  root.appendChild(bar);

  /** 重算汇总与提示词（唯一入口：勾选变化、打开时都走它） */
  function refresh(): void {
    const { count, mb } = summarize(picked);
    cntNode.textContent = String(count);
    sizeNode.textContent = formatSize(mb);
    pre.textContent = buildPlanPrompt(picked, ctx);
  }

  for (const h of handles) {
    if (h.item.required) continue;
    h.input.addEventListener('change', () => {
      if (h.item.radio) {
        // radio 取消不掉：change 只会因为「选中」触发
        picked = toggleRadio(picked, h.item.id);
      } else if (h.input.checked) {
        picked.add(h.item.id);
      } else {
        picked.delete(h.item.id);
      }
      refresh();
    });
  }

  if (PLAN_TUTORIAL_URL) {
    videoBtn.addEventListener('click', () => {
      window.open(PLAN_TUTORIAL_URL, '_blank', 'noopener');
    });
  }

  copyBtn.addEventListener('click', () => {
    const text = buildPlanPrompt(picked, ctx);
    void navigator.clipboard.writeText(text).then(
      () => notice('提示词已复制，粘给 AI 就行', 'success'),
      () => notice('复制失败：手动选中下面的提示词再复制', 'error'),
    );
  });

  refresh();

  const modal = uiModal({
    head: false,
    title: 'bz 依赖什么',
    content: root,
    maxWidth: 760,
    className: 'bz-deps-modal',
    autofocus: false,
  });
  closeBtn.addEventListener('click', () => modal.close());

  // Ollama 那一行右格不给体积给**状态**（原型就是这么写的）：装了没起、起没起，
  // 决定用户还要不要跑「装 Ollama」这一步——比「约 700 MB」有用得多。
  const ollamaVal = valNodes.get('ollama');
  if (ollamaVal) {
    void probeOllamaService().then((r) => {
      ollamaVal.textContent = r.up ? '运行中' : '没检测到';
      ollamaVal.classList.toggle('bz-deps-val--ok', r.up);
      ollamaVal.classList.toggle('bz-deps-val--bad', !r.up);
    });
  }
}
