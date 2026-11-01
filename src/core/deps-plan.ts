/* ============================================================
 * bz · 外部依赖清单与提示词（core/deps-plan.ts）
 *
 * 这里只有**数据**和**纯函数**：清单长什么样、勾了哪几项、拼出来的提示词是
 * 什么文本。渲染与交互在 core/deps-guide.ts，两边的分界线就是「能不能跑 node 单测」。
 *
 * 为什么是「生成提示词」而不是「插件自己装」（这是这一版的核心立场）：
 *   1. 这些依赖没有一样该落进 Obsidian 仓库或插件目录——
 *      Ollama 是系统服务、Node/Python/ffmpeg 是系统运行时、pip 包进的是 Python 自己的
 *      site-packages。插件目录是**插件自己**的地盘，用户换个仓库、卸载重装就没了；
 *      而这些是「装一次、全机器能用」的东西，落错地方等于装了个只能在这个库里用的影子。
 *   2. 插件没有装它们的权限与稳定性：Ollama 安装器要 UAC、pip 一次跑 5–15 分钟、
 *      中途关窗就断。把「装」交给用户自己那条最靠得住的通道（终端 / 安装器 / AI 助手），
 *      插件只负责**把要装什么讲清楚**。
 *   3. 所以提示词必须自足：粘给任何一个 AI 或自己照着敲，都能走完，不需要回头翻文档。
 *
 * 提示词里的路径有两类来源，别混：
 *   - 插件目录 / 仓库目录：渲染时按本机真实路径填（`PlanContext`），用来交代「别装这里」；
 *   - 装完的位置：一律写系统位置（Program Files、PATH、Ollama 自己的模型目录），
 *     不写插件目录下的任何相对位置。
 * ============================================================ */

import { isQwen3Embedding8b } from './ai-models';

/** 一个可勾选的条目标识；`embed:` / `rerank:` / `asr:` 前缀用来表达「组内单选」 */
export type PlanItemId = string;

export interface PlanItem {
  id: PlanItemId;
  /** 分组（渲染顺序 = 下面 PLAN_ITEMS 里首次出现的顺序） */
  group: string;
  /** 清单里显示的名称 */
  name: string;
  /** 体积（MB）。0 = 不下载任何东西（例如「不安装重排」），不计入汇总 */
  mb: number;
  /** 右侧显示的人话体积 */
  size: string;
  /** 必装：勾选框固定勾上、不可取消 */
  required?: boolean;
  /** 组内单选：同一个值的条目互斥（`embed` / `rerank` / `asr`） */
  radio?: 'embed' | 'rerank' | 'asr';
  /** 单选组里的默认项（多选的默认项用 required 表达） */
  pickedByDefault?: boolean;
  /** 名称后的徽章 */
  pill?: string;
  /** 徽章走弱化配色（「英文」这种限定词，不是推荐） */
  pillDim?: boolean;
  /** 名称链到哪（Ollama 库页 / 下载页） */
  url?: string;
  /** 嵌入模型：MTEB 参考分（跨模型横着比的那一列；没有单一分数的写口径说明） */
  score?: string;
  /** 嵌入模型：跑起来大概吃多少显存（「6–8 GB」这种区间，比下载体积更影响选型） */
  vram?: string;
  /** 转写引擎：支持哪些语言 */
  lang?: string;
}

/* ---------- 分组顺序（渲染按它来；条目按这个顺序排好） ---------- */

export const PLAN_GROUPS: readonly string[] = [
  '运行时',
  '向量检索',
  '音视频处理',
  '语音转写',
  '脸谱',
];

/* ---------- 清单 ---------- */

export const PLAN_ITEMS: readonly PlanItem[] = [
  /* ---- 运行时 ---- */
  {
    id: 'node',
    group: '运行时',
    name: 'Node.js',
    mb: 100,
    size: '约 100 MB',
    required: true,
    url: 'https://nodejs.org/zh-cn/download',
  },
  {
    id: 'python',
    group: '运行时',
    name: 'Python 3.12',
    mb: 120,
    size: '约 120 MB',
    required: true,
    url: 'https://www.python.org/downloads/release/python-3129/',
  },

  /* ---- 向量检索：Ollama + 9 个嵌入模型 + 2 个重排模型 ---- */
  {
    id: 'ollama',
    group: '向量检索',
    name: 'Ollama',
    mb: 700,
    size: '约 700 MB',
    required: true,
    url: 'https://ollama.com/download',
  },
  { id: 'embed:qwen3-embedding:8b', group: '向量检索', name: 'qwen3-embedding:8b', mb: 4812, size: '4.7 GB', score: '70.58 多语言', vram: '6–8 GB', radio: 'embed', pill: '高配推荐', url: 'https://ollama.com/library/qwen3-embedding:8b' },
  { id: 'embed:qwen3-embedding:4b', group: '向量检索', name: 'qwen3-embedding:4b', mb: 2560, size: '2.5 GB', score: '69.45 多语言', vram: '3–4 GB', radio: 'embed', url: 'https://ollama.com/library/qwen3-embedding:4b' },
  { id: 'embed:mxbai-embed-large', group: '向量检索', name: 'mxbai-embed-large', mb: 670, size: '670 MB', score: '64.68 英文', vram: '0.6–0.7 GB', radio: 'embed', pill: '英文', pillDim: true, url: 'https://ollama.com/library/mxbai-embed-large' },
  { id: 'embed:qwen3-embedding:0.6b', group: '向量检索', name: 'qwen3-embedding:0.6b', mb: 639, size: '639 MB', score: '64.33 多语言', vram: '1–1.5 GB', radio: 'embed', url: 'https://ollama.com/library/qwen3-embedding:0.6b' },
  { id: 'embed:nomic-embed-text:v1.5', group: '向量检索', name: 'nomic-embed-text v1.5', mb: 274, size: '274 MB', score: '62.28 英文', vram: '约 0.5 GB', radio: 'embed', pill: '英文', pillDim: true, url: 'https://ollama.com/library/nomic-embed-text:v1.5' },
  { id: 'embed:embeddinggemma', group: '向量检索', name: 'embeddinggemma', mb: 622, size: '622 MB', score: '61.15 多语言', vram: '0.2–0.6 GB', radio: 'embed', url: 'https://ollama.com/library/embeddinggemma' },
  { id: 'embed:snowflake-arctic-embed2', group: '向量检索', name: 'snowflake-arctic-embed2', mb: 1229, size: '约 1.2 GB', score: '55.6 BEIR', vram: '0.8–1.6 GB', radio: 'embed', url: 'https://ollama.com/library/snowflake-arctic-embed2' },
  { id: 'embed:bge-m3', group: '向量检索', name: 'bge-m3', mb: 1229, size: '约 1.2 GB', score: '多模式，无单一分数', vram: '0.8–1.2 GB', radio: 'embed', pickedByDefault: true, pill: '低配推荐', url: 'https://ollama.com/library/bge-m3' },
  { id: 'embed:all-minilm', group: '向量检索', name: 'all-minilm', mb: 46, size: '46 MB', score: '未提供', vram: '约 0.2 GB', radio: 'embed', pill: '英文', pillDim: true, url: 'https://ollama.com/library/all-minilm' },
  { id: 'rerank:dengcao/Qwen3-Reranker-4B:Q4_K_M', group: '向量检索', name: 'dengcao/Qwen3-Reranker-4B:Q4_K_M', mb: 2560, size: '约 2.5 GB', radio: 'rerank', pill: '高配推荐', url: 'https://ollama.com/dengcao/Qwen3-Reranker-4B' },
  { id: 'rerank:dengcao/Qwen3-Reranker-8B:Q4_K_M', group: '向量检索', name: 'dengcao/Qwen3-Reranker-8B:Q4_K_M', mb: 5120, size: '约 5 GB', radio: 'rerank', url: 'https://ollama.com/dengcao/Qwen3-Reranker-8B' },
  { id: 'rerank:', group: '向量检索', name: '不安装重排', mb: 0, size: '—', radio: 'rerank', pickedByDefault: true, pill: '低配推荐' },

  /* ---- 音视频处理：两个 exe 同属一个包，清单里分两行显示，装一次同时拿到 ---- */
  {
    id: 'ffmpeg',
    group: '音视频处理',
    name: 'ffmpeg',
    mb: 90,
    size: '约 90 MB',
    required: true,
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest',
  },
  {
    id: 'ffprobe',
    group: '音视频处理',
    name: 'ffprobe',
    // 与 ffmpeg 同一个压缩包（一个包解出两个 exe），体积只在 ffmpeg 那行计一次：
    // 两行各记一遍会让底栏的「约 X GB」凭空多出一份 88 MB。
    mb: 0,
    size: '随 ffmpeg',
    required: true,
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/latest',
  },

  /* ---- 语音转写：二选一，没有「不装」 ---- */
  { id: 'asr:sensevoice', group: '语音转写', name: 'SenseVoice-Small', mb: 922, size: '约 0.9 GB', lang: '中英日韩粤', radio: 'asr', pickedByDefault: true, pill: '推荐' },
  { id: 'asr:whisper', group: '语音转写', name: 'faster-whisper', mb: 1024, size: '75 MB–3.1 GB', lang: '99 种语言', radio: 'asr' },

  /* ---- 脸谱 ---- */
  { id: 'pycryptodome', group: '脸谱', name: 'pycryptodome', mb: 3, size: '约 3 MB', required: true },
];

/** 教程视频地址（用户后续提供；空 = 按钮禁用并提示） */
export const PLAN_TUTORIAL_URL = '';

/* ---------- 选中态 ---------- */

/** 默认勾选：必装项 + 各单选组的默认项 */
export function defaultPicked(): Set<PlanItemId> {
  const out = new Set<PlanItemId>();
  for (const item of PLAN_ITEMS) {
    if (item.required || item.pickedByDefault) out.add(item.id);
  }
  return out;
}

/**
 * 组内单选：确保 `id` 所在 radio 组只有它一个。
 * 返回新的集合（不改入参），渲染层拿它直接重算；`id` 不在任何 radio 组里时原样返回副本。
 */
export function toggleRadio(picked: ReadonlySet<PlanItemId>, id: PlanItemId): Set<PlanItemId> {
  const next = new Set(picked);
  const item = PLAN_ITEMS.find((i) => i.id === id);
  if (!item?.radio) return next;
  for (const other of PLAN_ITEMS) {
    if (other.radio === item.radio && other.id !== id) next.delete(other.id);
  }
  next.add(id);
  return next;
}

/**
 * 汇总：项数与总体积（MB）。
 *
 * `mb === 0` 的两类意思要分开：一类是「压根不下载任何东西」（不安装重排），连**项数**都不该占；
 * 另一类是「体积并进了同组的另一行」（ffprobe 跟着 ffmpeg 一起来），项数照算、体积记 0。
 * 用 `required` 区分它们——必装项一定是要装的东西，只是体积不在这行计。
 */
export function summarize(picked: ReadonlySet<PlanItemId>): { count: number; mb: number } {
  let count = 0;
  let mb = 0;
  for (const item of PLAN_ITEMS) {
    if (!picked.has(item.id)) continue;
    if (item.mb <= 0 && !item.required) continue;
    count += 1;
    mb += item.mb;
  }
  return { count, mb };
}

/** MB → 「3.2 GB」/「480 MB」；≥1024 换算并留一位小数 */
export function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB` : `${Math.round(mb)} MB`;
}

/* ---------- 提示词 ---------- */

export interface PlanContext {
  /** 插件目录绝对路径（值守脚本在这里，绕不开） */
  pluginDir: string;
  /** 仓库根绝对路径（用来交代「别装这里」） */
  vaultDir: string;
}

/** 取某个前缀唯一选中的那项；同一前缀不会有两项（radio 保证） */
function pickPrefix(picked: ReadonlySet<PlanItemId>, prefix: string): string {
  for (const item of PLAN_ITEMS) {
    if (!item.id.startsWith(prefix) || !picked.has(item.id)) continue;
    return item.id.slice(prefix.length);
  }
  return '';
}

/** Windows 路径在提示词里统一用反斜杠（用户看着顺眼，复制到 cmd 也能直接用） */
function winPath(p: string): string {
  return String(p || '').replace(/\//g, '\\');
}

/**
 * 「勾了重排、但本地通道不会生效」——嵌入模型不是 qwen3-embedding:8b 时就是这个状态。
 *
 * 判据不能自己写一条正则：本地重排的门在 `secondbrain/config.ts` 的 `rerankChannel()`
 * （`isQwen3Embedding8b`），设置页「重排模型」行的可见性也吃同一条判定。这里再抄一份，
 * 将来门一改，弹窗就会给出与插件行为相反的结论——所以直接调同一个函数。
 *
 * 为什么值得单独成一个函数：界面要在勾选时就地提示，提示词要按它把总闸写成 false，
 * 两处必须同一个答案。
 */
export function localRerankBlocked(picked: ReadonlySet<PlanItemId>): boolean {
  const rerank = pickPrefix(picked, 'rerank:');
  if (!rerank) return false;
  return !isQwen3Embedding8b(pickPrefix(picked, 'embed:'));
}

/* ---------- 回填：data.json 里要改哪些键 ---------- */

export interface BackfillField {
  /** data.json 里的键名（与设置面板同一套键，不是另起一套叫法） */
  key: string;
  /** 该写成什么：值的来源与形状，一句话说完 */
  value: string;
}

/**
 * 插件设置文件的绝对路径。
 *
 * Obsidian 的插件设置永远是**插件目录下的 data.json**（saveData 的固定落点）；而插件目录名
 * 由用户决定（`bz` / `包仔` / `bz-test`），所以只能按 pluginDir 算，写死必然错位。
 */
export function dataFilePath(ctx: PlanContext): string {
  return winPath(`${String(ctx.pluginDir || '').replace(/[\\/]+$/, '')}/data.json`);
}

/**
 * 这次装的东西要写回 data.json 的哪些键。
 *
 * 为什么连键名一起交给 AI：插件不负责装，也就没机会自己回填——提示词粘给 AI 之后，
 * 「装好了，你去设置里填一下」是最容易断的一环（填哪一行、填绝对路径还是命令名、端口写不写，
 * 全靠猜）。所以键名、类型、值的口径都写死在这里，AI 直接改文件。
 *
 * 顺序按设置面板走（外部工具 → Embedding → 语音转写），不是按安装顺序——用户拿着它核对时，
 * 眼睛是贴着那一页从上往下走的。
 */
export function backfillFields(picked: ReadonlySet<PlanItemId>): BackfillField[] {
  const embed = pickPrefix(picked, 'embed:');
  const rerank = pickPrefix(picked, 'rerank:');
  const asr = pickPrefix(picked, 'asr:');
  const out: BackfillField[] = [];

  if (picked.has('python')) {
    out.push({
      key: 'pythonPath',
      value: '刚装好的 python.exe 完整路径（where python 里能打印 3.12.x 的那条；应用商店那个占位符不算）',
    });
  }
  if (picked.has('ffmpeg')) {
    out.push({ key: 'ffmpegPath', value: 'ffmpeg.exe 的绝对路径；已经能在 PATH 上直接敲 ffmpeg 就写空串 ""' });
  }
  if (picked.has('ffprobe')) {
    out.push({ key: 'ffprobePath', value: 'ffprobe.exe 的绝对路径；已经能在 PATH 上直接敲 ffprobe 就写空串 ""' });
  }
  if (picked.has('ollama')) {
    out.push({ key: 'secondBrainOllamaUrl', value: 'http://127.0.0.1:11434（端口改过才换数字，末尾不要留斜杠）' });
  }
  if (embed) {
    out.push({
      key: 'secondBrainEmbeddingModel',
      value: `"${embed}"（与 ollama list 里的名字一字不差；换模型会让旧向量索引失效，bz 下次打开第二大脑自动重建，第一次检索会慢）`,
    });
  }
  // 重排是「总闸 + 模型名」两个键：只写模型名而总闸是 false，装了也不会生效。
  // 反过来——嵌入不是 8B 时本地通道本来就不启用（localRerankBlocked），这时把总闸写 true
  // 会让设置页显示「已开启」而实际不生效：宁可写 false，让界面与行为说同一句话。
  if (rerank) {
    if (localRerankBlocked(picked)) {
      out.push({
        key: 'secondBrainRerank',
        value: `false（本地重排只在嵌入模型是 qwen3-embedding:8b 时生效，你选的是 ${embed || '其他嵌入模型'}，开了也不会跑；模型可以先装着，换嵌入后才用得上）`,
      });
      out.push({ key: 'secondBrainRerankModel', value: `"${rerank}"` });
    } else {
      out.push({ key: 'secondBrainRerank', value: 'true' });
      out.push({ key: 'secondBrainRerankModel', value: `"${rerank}"` });
    }
  } else if (picked.has('rerank:')) {
    out.push({ key: 'secondBrainRerank', value: 'false（这次不装重排模型，总闸关掉）' });
  }
  if (asr === 'sensevoice') {
    out.push({ key: 'asrEngine', value: '"sensevoice"' });
  } else if (asr === 'whisper') {
    out.push({ key: 'asrEngine', value: '"faster-whisper"' });
    out.push({ key: 'asrWhisperModel', value: '"small"（缺省档；机器够快想要更准就写 "large-v3"）' });
  }
  return out;
}

/**
 * 按勾选生成提示词。
 *
 * 空勾选也会返回一段话（不是空串）：用户什么都没选时，提示词里只剩值守那一步——
 * 它不受勾选控制（见下），弹窗那边也不会走到「提示词是空的」这种死路。
 */
export function buildPlanPrompt(picked: ReadonlySet<PlanItemId>, ctx: PlanContext): string {
  const plugin = winPath(ctx.pluginDir);
  const vault = winPath(ctx.vaultDir);
  const embed = pickPrefix(picked, 'embed:');
  const rerank = pickPrefix(picked, 'rerank:');
  const asr = pickPrefix(picked, 'asr:');

  /** @type {Array<[string, string[]]>} */
  const steps: Array<[string, string[]]> = [];

  if (picked.has('node')) {
    steps.push([
      'Node.js（工具坞、知识盒、值守的运行环境）',
      [
        '装 LTS 版（v22 以上）的系统安装包，默认落 C:\\Program Files\\nodejs\\。',
        '验证：新开一个终端，node -v 有版本号、where node 能查到路径。',
      ],
    ]);
  }

  if (picked.has('python')) {
    steps.push([
      'Python 3.12（语音转写、脸谱用；别装 3.13 / 3.14）',
      [
        '装 python.org 的系统版 3.12，安装第一屏勾上 Add python.exe to PATH。',
        '注意：应用商店那个 python.exe 是占位符，装它不算数——要能打印出 3.12.x 才算。',
        '装完记下它的绝对路径（where python 有多条时，取能打印 3.12.x 的那条），最后一步你自己写进设置。',
        '后面几项 pip 都用 py -3.12 跑；没有 py launcher 就换成上面那个 python.exe 的完整路径。',
      ],
    ]);
  }

  if (picked.has('ollama')) {
    steps.push([
      'Ollama（本地模型服务，端口 11434）',
      [
        'ollama.com 打不开就用 GitHub Releases 上的 windows-amd64 安装包，或国内镜像站。',
        '装完先设用户环境变量 OLLAMA_MODELS，指到一个空余空间够的盘（别放 C 盘、别放仓库目录），再启动服务——模型一个 1–5 GB，默认位置在 C:\\Users\\<你>\\.ollama\\models。',
        '验证：新开终端 ollama list 有输出，或 curl http://127.0.0.1:11434/api/tags 有返回。',
      ],
    ]);
  }

  if (embed) {
    steps.push([`向量模型 ${embed}`, [`ollama pull ${embed}`, '拉完 ollama list 里能看到它。']]);
  }

  if (rerank) {
    const lines = [`ollama pull ${rerank}`, '拉完 ollama list 里能看到它。'];
    if (localRerankBlocked(picked)) {
      lines.unshift(`注意：bz 的重排只在嵌入模型是 qwen3-embedding:8b 时启用，现在的选择是 ${embed || '没选嵌入模型'}——装了也不会生效，最后一步的总闸我会写成 false。`);
    }
    steps.push([`重排模型 ${rerank}`, lines]);
  }

  if (picked.has('ffmpeg') || picked.has('ffprobe')) {
    steps.push([
      'ffmpeg / ffprobe',
      [
        'winget install --id Gyan.FFmpeg -e；没有 winget 就下 BtbN 的 win64-lgpl 包，解压到任意固定目录（例如 C:\\ffmpeg），再把它下面的 bin 加进 PATH。',
        '验证：新开一个终端，ffmpeg -version 与 ffprobe -version 都有输出。',
        'bz 会从 PATH 上找这两个；PATH 里没有的话，最后一步你把它们的绝对路径写进设置。',
      ],
    ]);
  }

  if (asr === 'sensevoice') {
    steps.push([
      '语音转写 SenseVoice（Python 包）',
      [
        'py -3.12 -m pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu',
        'py -3.12 -m pip install --no-cache-dir funasr',
        'torch 必须带 --index-url，不然会拉 CUDA 版（2.5 GB 起）。',
      ],
    ]);
  } else if (asr === 'whisper') {
    steps.push([
      '语音转写 faster-whisper（Python 包）',
      [
        'py -3.12 -m pip install --no-cache-dir faster-whisper',
        '另外需要 bz 的 Python 是 3.11 以上——上面装的就是 3.12，满足。',
      ],
    ]);
  }

  if (picked.has('pycryptodome')) {
    steps.push([
      'pycryptodome（脸谱导入微信记录用）',
      [
        'py -3.12 -m pip install --no-cache-dir pycryptodome',
        '脸谱的解密链路还依赖 pymem、psutil、pywin32、zstandard、protobuf、pillow、xmltodict、lxml、dateparser、aiofiles、yara-python；缺哪个它自己的 doctor 会打出来，照着装。',
      ],
    ]);
  }

  // 值守不受勾选控制：它不在清单里（不是「装什么」而是「让它开机自启」），
  // 但不做这一步，关掉 Obsidian 之后自动任务就不会跑了。
  steps.push([
    '工具坞值守：注册登录自启（必做，清单里没有也要做）',
    [
      `powershell -ExecutionPolicy Bypass -File "${plugin}\\downloads\\tools\\dock-watch\\install.ps1" -Vault "${vault}" -Node "<第 1 步 where node 查到的完整路径>"`,
      '-Node 要给绝对路径。install.ps1 里用 Get-Command node 找 node，PATH 上没有就直接退出；计划任务的环境不一定继承 PATH，显式传才稳。',
      `跑完执行 node "${plugin}\\downloads\\tools\\dock-watch\\cli.js" --status，确认心跳是刚才的时间。`,
      '计划任务被拒时会自动回退到「启动」文件夹；两个都没有就是没装上，把 install.ps1 的报错原文给我。',
    ],
  ]);

  const out: string[] = [
    '帮我把 Obsidian 插件「包仔 bz」要用的外部工具装好。每一项先检查，已经装好的跳过，不要重复安装；每装完一项告诉我装到哪、怎么验证。',
    '',
    '装的位置：一律装到系统位置（Program Files、用户目录、PATH 上、Python 自己的 site-packages）。',
    `不要装进 Obsidian 仓库 ${vault}，也不要装进插件目录 ${plugin}——那是插件自己的地盘，换仓库或重装插件就没了。`,
    '',
    `环境：Windows。Obsidian 仓库 ${vault}；插件目录 ${plugin}；插件设置文件 ${dataFilePath(ctx)}`,
    '',
  ];

  steps.forEach(([title, lines], i) => {
    out.push(`${i + 1}. ${title}`);
    for (const line of lines) out.push(`   ${line}`);
    out.push('');
  });

  const fields = backfillFields(picked);
  out.push(
    [
      '失败就说清楚卡在哪一步、报了什么错，别自己删文件或改系统设置。',
      '',
      '最后一步：由你自己改 bz 的插件设置文件，别把这件事交回给我。',
      '',
      `文件：${dataFilePath(ctx)}（Obsidian 的插件设置，一个 JSON 对象）`,
      // 这一条必须是第一句。Obsidian 端存设置是**整份覆盖写**（saveData 把内存里那份全写回），
      // 插件开着时用户拖一下面板尺寸、改一个开关，就会把这里刚写进去的键整份盖回旧值——
      // 症状是「装完了、设置没进去」，没有任何报错。所以改文件的前提是先让进程退干净。
      '  · 先让 Obsidian 完全退出（退进程，不是关窗口；任务栏/托盘里也不能还留着）。它开着时，插件下一次保存会把这份文件整份覆盖掉，这里改的就白改了。',
      '  · 动手前把原文件复制一份成 data.json.bak。',
      '  · 只改下面这些键：其余键原样保留，不增、不删、不重排；写回后必须是合法 JSON（不能有尾逗号、不能带注释）。',
      '  · 值是路径时，反斜杠写成两个（"C:\\\\Program Files\\\\nodejs\\\\node.exe"），或者整条路径改用正斜杠。',
      '  · 这个文件只在 Obsidian 启动时读一次：写完后立刻把它重新打开（别让我去动文件），再读回文件确认键值确实写进去了。',
      '',
      '要改的键（等号后面就是该写成的值）：',
      ...(fields.length
        ? fields.map((f) => `  ${f.key.padEnd(26)} = ${f.value}`)
        : ['  （这次没有要回填的键）']),
      '',
      'Node.js 与 pip 包不写进这个文件：前者只要在 PATH 上就够，后者装在 Python 自己身上。别去 data.json 里找它们。',
      '',
      '流程到这里结束：上面的键由你改完、核对完再回话。',
    ].join('\n'),
  );
  return out.join('\n').trimEnd() + '\n';
}
