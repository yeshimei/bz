/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：保存到剪藏本（写剪藏笔记）。
 *
 * 语义迁移自 src/news/reader.ts saveToClip（逐字保留 frontmatter 契约 P1-24 +
 * dataviewjs 摘要块）：news 条目标记已保存 → 写 `剪藏目录/<cleanTitle>.md`。
 * - frontmatter：url/author/site/summary/tags/date/created（created 本地时间戳
 *   ——UTC+8 凌晨不落昨日；date 转 UTC 本地串）
 * - 正文剥离 frontmatter/dataviewjs 块后写入，尾部嵌 dataviewjs 摘要 view
 * - 同名文件已存在 → 覆盖确认（flow-dialog 三出口：覆盖/另存为新剪藏/取消，效率#3）
 * - B站视频条目保存分流文献盒（ADR-0068：openLiteratureAddTask），不写剪藏
 *
 * 调用方：UI 保存动作（doAct save）。成功后由调用方触发重渲染 + 目录刷新。
 */
import { TFile } from 'obsidian';
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';
import { notice, notify, notifySaveError, type NoticeHandle } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { localDatetime, toDatetime, articleKeyOf } from './constants';
import { readArticleTracking, applyBodyTransforms, clearArticleTracking, linkAliasText } from './anchor';
import type { ClipSavedImage } from './data';

// C27：先转义反斜杠（\ → \\）再转义引号/换行——否则 url/author/summary 含 `\` 时
// 产出 `\\"` 之类被 YAML 当转义序列解读，值读取时变形。
// 一致#1 收编：转义实现单源 core/utils（escapeYamlText 裸转义核心——引号由下方
// md 模板内嵌，yamlEscapeQuoted 是恒包裹出口，此处用裸核心保持原语义逐值等价）
import { escapeYamlText as yamlEscape } from '../core/utils';

/**
 * 剪藏目录单源（CB4/A3）：读设置 articleDirectory，尾斜杠归一（去尾 `/{1,}`）——
 * 写盘/事件 clipPath/扫描/自动刷新命中判定/引用同步五面共用此一处，缺省串也只此一处。
 * （原 clipDirOf 独缺尾斜杠归一，设置带尾斜杠时写盘路径与其余各面分叉。）
 */
export function clipDir(): string {
  const s = tryGetSettings() as any;
  return String((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

/**
 * 标题清洗单源（新-4，save 写盘与 flow 事件 clipPath 共用）：剥文件系统非法字符
 * `[\\/:*?"<>|]` + Windows 命名边界——尾点/尾空格剥掉（Windows 禁止）、保留设备名
 * （con/prn/aux/nul/com1-9/lpt1-9，大小写不敏感）前置 `_`，否则 vault.create 恒失败。
 */
export function cleanClipTitleOf(title: unknown): string {
  let t = String(title ?? '').replace(/[\\/:*?"<>|]/g, '').trim();
  t = t.replace(/[. ]+$/, '');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(t)) t = `_${t}`;
  return t;
}

/** 剪藏文件路径组装单源（CB4/A3）：`clipDir() + 清洗标题 + .md`——save 写盘与
 *  flow 事件 clipPath 共用此一函数，防两处手拼再次漂移。 */
export function clipFilePathOf(title: unknown): string {
  return `${clipDir()}/${cleanClipTitleOf(title)}.md`;
}

// C10：原 saveArticle 分流导出已删（无调用方——flow.ts 内联 B站/写剪藏分流）；
// B站分流逻辑在 flow.flowSave 内实现。

/** 写剪藏笔记（news 原文 raw）。返回是否写盘成功；空标题/取消覆盖/写盘异常均返回 false（调用方不得标已处理）。
 *  保存物化（issue 329 / ADR-0144）：落盘前 body 过 applyBodyTransforms——划词标记替换为
 *  别名双链、已存图片外链换 `![[本地路径]]`；写盘成功后清该条目侧写追踪，并对每个待升级
 *  文献笔记回写 source 为 `[[剪藏路径|条目标题]]`（source 两态：外链 URL → 内部路径）。写盘失败不清理（重存再物化）。
 *  全量图片本地化（issue 329 追加修订）：覆盖确认之后、写 md 之前把正文**所有**外链图
 *  下载落盘并组进换链映射（确认前不网络等待；复用侧写 savedImages 不重下；单张失败保留外链）。
 *  同名覆盖三出口（效率#3）：覆盖更新=现语义；另存为新剪藏=文件名追加 ` · N` 序号去重
 *  循环后走正常写盘；取消/ESC/遮罩=false（不写盘）。 */
export async function writeClipNote(raw: any): Promise<boolean> {
  const app = getApp();
  const cleanTitle = cleanClipTitleOf(raw && raw.title);
  if (!cleanTitle) {
    notice('标题为空', 'error');
    return false;
  }
  let filePath = clipFilePathOf(cleanTitle);

  if (app.vault.getAbstractFileByPath(filePath)) {
    const verdict = await confirmOverwrite(filePath);
    if (verdict === 'rename') {
      // 另存为新剪藏：` · N` 序号去重循环（首个空位落座，永不覆盖既有文件）
      let n = 2;
      while (app.vault.getAbstractFileByPath(clipFilePathOf(`${cleanTitle} · ${n}`))) n++;
      filePath = clipFilePathOf(`${cleanTitle} · ${n}`);
    } else if (verdict !== 'ok') {
      return false; // 取消/ESC/遮罩：现取消语义，不写盘
    }
  }

  const tagsYaml = (raw.tags || []).map((t: string) => `  - "${yamlEscape(t)}"`).join('\n');
  const now = localDatetime();
  const pubDate = raw.date ? toDatetime(String(raw.date)) : '';
  // C10：剥离外壳必须锚定串首（去 m 标志）——带 m 时 `^` 匹配任意行首，正文中两条
  // `---` 分隔线之间的整段会被当 frontmatter 静默删掉（已复现：intro/中段/outro 丢中段）
  const rawBody = String(raw.body || '')
    .replace(/^\s*---[\s\S]*?---\s*/, '')
    .replace(/^\s*```dataviewjs[\s\S]*?```\s*/, '')
    .trim();
  // issue 329：保存物化——落盘前按侧写追踪（划词 marks + 已存图片映射）变换正文
  const key = articleKeyOf(raw);
  const tracking = await readArticleTracking(key);
  // 全量图片本地化：所有外链图下载落盘后组 src→local 全量映射，与划词同一 imageSwaps 管线换链
  const imageSwaps = await localizeImagesForSave(rawBody, tracking.images);
  const transformed = applyBodyTransforms(rawBody, tracking.marks, imageSwaps);
  const body = transformed.body;

  const md = `---
url: "${yamlEscape(raw.url || '')}"
author: "${yamlEscape(raw.author || '')}"
site: "${yamlEscape(raw.platform || '')}"
summary: "${yamlEscape(raw.summary || '')}"
tags:
${tagsYaml}
date: "${yamlEscape(pubDate)}"
created: ${now}
---
\`\`\`dataviewjs
await dv.view(\`CONFIG/SCRIPTS/DataView/摘要\`)
\`\`\`

${body}`;

  try {
    const dir = clipDir();
    const dirAf = app.vault.getAbstractFileByPath(dir);
    if (!dirAf) await app.vault.createFolder(dir);
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing) await app.vault.modify(existing as TFile, md);
    else await app.vault.create(filePath, md);
    // 保存成功通知挂动作（效率#3 半）：给「打开笔记」出口——openLinkText 实际写盘路径
    // （另存分支为 ` · N` 新路径，打开的正是刚写出的那篇）
    notify(`已保存：${cleanTitle}`, {
      type: 'success',
      action: {
        label: '打开笔记',
        onClick: () => void getApp().workspace.openLinkText(filePath, ''),
      },
    });
    // 物化收尾：清侧写追踪 + 待升级 source 回写内部双链（升级失败静默——断链代价可接受，ADR-0144 后果）
    await materializeTracking(key, filePath, cleanTitle);
    return true;
  } catch (e) {
    console.error('[剪藏本] 保存剪藏失败', e);
    notifySaveError(e, '剪藏');
    return false;
  }
}

/**
 * 保存前全量图片本地化编排（issue 329 追加修订）：多张时开 progress 通知原地更新
 * （`正在保存图片 2/8…`）；完成后按可感知性原则收口——本地化 ≥1 张 → success（含张数，
 * 有失败数一并报）；全部失败 → warning（含失败数）；零图片 → 不弹任何额外通知。
 * 返回 src→local 全量映射（复用 + 新下），供 applyBodyTransforms 换链。
 */
async function localizeImagesForSave(body: string, existing: ClipSavedImage[]): Promise<ClipSavedImage[]> {
  // image-save 反向 import 本模块（clipDir 单源）→ 顶层互访环在此侧延迟解析（ADR-0002）
  const { extractImageUrls, localizeArticleImages } = await import('./image-save');
  const total = extractImageUrls(body).length;
  if (!total) return existing;
  // 多张才开进度框（单张瞬时完成不值得占一条常驻通知）
  const ph: NoticeHandle | null = total > 1 ? notify(`正在保存图片 1/${total}…`, { type: 'progress' }) : null;
  try {
    const res = await localizeArticleImages({
      body,
      existing,
      onProgress: (done, t) => ph?.setMessage(`正在保存图片 ${done}/${t}…`),
    });
    const partial = res.failed > 0 ? `，${res.failed} 张失败保留外链` : '';
    if (res.swaps.length > 0) {
      // 复用的张数（此前单图已存过）单列，避免「已本地化 N 张」与实际新下载数对不上（issue 333 评审）
      const reused = res.swaps.length - res.localized;
      const reusedTxt = reused > 0 ? `（复用 ${reused} 张）` : '';
      const msg = `已本地化 ${res.swaps.length} 张图片${reusedTxt}${partial}`;
      if (ph) { ph.setType('success'); ph.setMessage(msg); }
      else notice(msg, 'success');
    } else {
      const msg = `${res.failed} 张图片保存失败，正文保留原外链`;
      if (ph) { ph.setType('warning'); ph.setMessage(msg); }
      else notice(msg, 'warning');
    }
    return res.swaps;
  } catch (e) {
    // 编排层兜底（单张失败已在 localize 内消化，走到这里属异常态）：不阻断保存
    console.warn('[剪藏本] 全量图片本地化异常，正文保留原外链', e);
    ph?.hide();
    return existing;
  }
}

/** 物化收尾（issue 329）：清该条目 marks/savedImages/pendingSource，对每个待升级文献笔记
 *  调 knowledge upgradeNoteSourceInternal 回写 `[[剪藏路径|条目标题]]`（契约 API 由 knowledge
 *  域并行实现，运行时按存在调用；无该导出（旧版本）跳过，侧写已清不再重试——接受）。
 *  升级名单 = pendingSource ∪ marks.notePath（保序去重，Bug 4 修复）：修复前的存量侧写
 *  只记 marks 未登记 pendingSource（升级链死路），并集一并救回；两段重复路径去重，
 *  已升级目标不重复写。 */
async function materializeTracking(key: string, clipPath: string, title: string): Promise<void> {
  let before;
  try {
    before = await clearArticleTracking(key);
  } catch (e) {
    console.warn('[剪藏本] 物化清理侧写失败', e);
    return; // 清理失败时不做 source 回写（下次保存再物化，避免半物化态）
  }
  const upgrades: string[] = [];
  for (const p of [...before.pendingSource, ...before.marks.map((m) => m.notePath)]) {
    if (p && !upgrades.includes(p)) upgrades.push(p);
  }
  if (!upgrades.length) return;
  const app = getApp();
  try {
    const mod: any = await import('../knowledge');
    if (typeof mod.upgradeNoteSourceInternal !== 'function') return;
    const link = `[[${clipPath}|${linkAliasText(title)}]]`;
    for (const notePath of upgrades) {
      try {
        await mod.upgradeNoteSourceInternal(app, notePath, link);
      } catch (e) {
        console.warn('[剪藏本] 回写文献来源失败（接受，静默）', notePath, e);
      }
    }
  } catch (e) {
    console.warn('[剪藏本] knowledge 模块不可用，source 回写跳过', e);
  }
}

/**
 * 同名覆盖确认（效率#3）：自绘遮罩弹窗退役，改走 openFlowDialog 统一皮
 * （`.bz-clip-dialog-editorial` 编辑部皮，与删除/全部已读确认同款）+ 三出口——
 * - 'ok'：覆盖更新（现语义：modify 既有文件）；
 * - 'rename'：另存为新剪藏（调用方按 ` · N` 序号落新文件）；
 * - undefined：取消（ESC/遮罩/被顶替的 flow-dialog 取消语义，不写盘）。
 * message 披露文件名 + 副文案，明示覆盖后果；主动作为危险动作（danger）时焦点反落
 * 「取消」（Enter=取消，防误触），随 flow-dialog 自动被 cancelActiveFlowDialog 收口，
 * 旧 esc id 'clipbook-confirm' 退役。
 */
function confirmOverwrite(filePath: string): Promise<'ok' | 'rename' | undefined> {
  return openFlowDialog({
    className: 'bz-clip-dialog-editorial',
    title: '已存在同名剪藏',
    message: `「${filePath.split('/').pop() || filePath}」已存在\n将覆盖现有摘要、标签与正文编辑`,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '另存为新剪藏', value: 'rename' },
      { label: '覆盖更新', value: 'ok', cta: true, danger: true },
    ],
  }).then((v) => (v === 'ok' || v === 'rename' ? v : undefined));
}
