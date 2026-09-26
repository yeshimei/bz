/* ============================================================
 * bz · 设置面板「在线资源」组（settings-panel/online-resources.ts）——ADR-0203
 *
 * 通用域最后一组：更新日志 / 使用手册 / 皮肤三行统一状态机
 * （未下载 → 下载 [N]；有更新 → 更新 N；已最新 → 已下载 禁用；动作中转圈禁用）。
 * 状态永远从**磁盘单源**现算（缓存清单 + 本地文件 sha256），组内不持久任何状态；
 * 打开时顺手后台核对一次清单（60s 节流），失败有缓存沿用缓存渲染 + 细字提示，
 * 无缓存三行禁用 + 失败横条 + 检查/重试按钮。**半自动铁则的 UI 面**：本组按钮
 * 与手册/日志导航入口是仅有的两个下载触发点。
 * ============================================================ */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import type { GroupDecl, SettingsRow, SettingsRowContext } from '../core/settings-schema';
import {
  cachedManifest,
  docStatus,
  refreshManifest,
  type DocStatus,
  type DownloadManifest,
  type ManifestDocEntry,
} from '../core/download-manifest';
import { downloadSkinUpdates, skinStatus, type SkinStatus } from '../core/skin-pack';
import { ensureAssetWithHash } from '../core/remote-asset';
import { loadCategoryTable } from '../core/category-table';

/** 无缓存清单时的行骨架（行名内置；有清单后以清单 name 为准）。分类表排皮肤之后（数据表跟在文档/皮肤后面，行序稳定） */
const FALLBACK_ROWS: Array<{ id: string; name: string }> = [
  { id: 'changelog', name: '更新日志' },
  { id: 'manual', name: '使用手册' },
  { id: 'skins', name: '皮肤' },
  { id: 'belongings-categories', name: '归物分类表' },
];

/** 打开组时后台核对的节流窗（快速开关面板不狂拉；启动链每次启动独立跑不受此限） */
const CHECK_THROTTLE_MS = 60_000;
let lastCheckAt = 0;
/** 本次会话最近一次核对是否失败（有缓存时以细字提示降级呈现） */
let checkFailed = false;

/** 重置节流与失败标记（测试用；生产进程内随会话存续无需重置） */
export function resetOnlineResourcesState(): void {
  lastCheckAt = 0;
  checkFailed = false;
}

/** 行渲染所需的全部事实（一次算齐，渲染函数保持纯同步） */
interface RowState {
  /** 清单条目 id（动作分发用） */
  id: string;
  /** 行名（清单 name 优先，回退内置表） */
  name: string;
  /** doc 行状态；皮肤行/无清单 null */
  doc: DocStatus | null;
  /** 皮肤行三态计数；doc 行/无清单 null */
  skin: SkinStatus | null;
  /** 分类表行专用：本地已就绪表的规模（归物本 AI 归类与选择器的候选池），其余行 null */
  catInfo: { groups: number; items: number } | null;
}

/** 组内容一次性算齐（缓存清单 + 本地文件实测） */
async function computeRowStates(app: unknown): Promise<{ rows: RowState[]; manifest: DownloadManifest | null }> {
  const manifest = await cachedManifest(app);
  const rows: RowState[] = [];
  for (const fb of FALLBACK_ROWS) {
    if (fb.id === 'skins') {
      rows.push({ id: fb.id, name: fb.name, doc: null, skin: manifest ? await skinStatus(app, manifest) : null, catInfo: null });
    } else {
      const entry = manifest?.docs.find((d) => d.id === fb.id) ?? null;
      const doc = entry ? await docStatus(app, entry) : null;
      // 分类表行：就绪时把表规模读出来（loadCategoryTable 有内存缓存，二次打开零读盘）
      let catInfo: RowState['catInfo'] = null;
      if (fb.id === 'belongings-categories' && doc === 'ready') {
        const t = await loadCategoryTable(app);
        if (t) catInfo = { groups: t.groups.length, items: t.groups.reduce((n, g) => n + g.items.length, 0) };
      }
      rows.push({
        id: fb.id,
        name: entry?.name ?? fb.name,
        doc,
        skin: null,
        catInfo,
      });
    }
  }
  return { rows, manifest };
}

/** 行状态 → 描述文案（设置项文案规范：一句自然句，无符号花样） */
function rowDesc(st: RowState): string {
  if (st.skin) {
    const { ready, missing, updated } = st.skin;
    if (updated > 0) return missing > 0 ? `${updated} 套皮肤有更新，另有 ${missing} 套未下载` : `${updated} 套皮肤有更新`;
    if (missing > 0) return `${missing} 套皮肤可下载，已就绪 ${ready} 套`;
    return '全部皮肤已是最新';
  }
  if (st.doc === 'missing') return '尚未下载，下载后即可查看';
  if (st.doc === 'updated') return '有新版本，可更新到最新';
  if (st.doc === 'ready') {
    return st.catInfo ? `已是最新版本（${st.catInfo.groups} 组 ${st.catInfo.items} 条）` : '已是最新版本';
  }
  return '等待检查更新';
}

/** 行状态 → 按钮文案与禁用态（更新优先于下载；两者并存的差额在描述里说清） */
function rowButton(st: RowState, hasManifest: boolean): { text: string; disabled: boolean; action: boolean } {
  if (st.skin) {
    const { missing, updated } = st.skin;
    if (updated > 0) return { text: `更新 ${updated}`, disabled: false, action: true };
    if (missing > 0) return { text: missing > 1 ? `下载 ${missing}` : '下载', disabled: false, action: true };
    return { text: '已下载', disabled: true, action: false };
  }
  if (st.doc === 'missing') return { text: '下载', disabled: false, action: true };
  if (st.doc === 'updated') return { text: '更新', disabled: false, action: true };
  if (st.doc === 'ready') return { text: '已下载', disabled: true, action: false };
  // 无清单 = 状态未知：按钮保持下载字样但禁用（等信息到位，不误导「已是最新」）
  return { text: '下载', disabled: !hasManifest ? true : false, action: false };
}

/**
 * 「在线资源」组（通用域 schema loader 尾部追加）。
 * 单 custom 行自绘整组内容：提示行（条件出现）+ 三行状态机。
 */
export function onlineResourcesGroup(): GroupDecl {
  const row: SettingsRow = {
    type: 'custom',
    render: (body, ctx) => {
      void renderGroupBody(body, ctx);
    },
  };
  return { name: '在线资源', icon: 'cloud-download', rows: [row] };
}

/** 渲染整组（每次全量重画——三行状态与提示行彼此联动，全量比局部 patch 简单可靠） */
async function renderGroupBody(body: HTMLElement, ctx: SettingsRowContext): Promise<void> {
  const app = getApp();
  const { rows, manifest } = await computeRowStates(app);

  body.empty();
  body.className = 'bz-sp-res';

  // 提示行：无缓存清单（从未成功拉到）→ 横条 + 检查/重试；有缓存但核对失败 → 细字提示 + 重试
  if (!manifest || checkFailed) {
    const fail = body.createDiv({ cls: manifest ? 'bz-sp-res-stale' : 'bz-sp-res-fail' });
    fail.createSpan({
      cls: 'bz-sp-res-fail-text',
      text: checkFailed ? '检查更新失败，可能是网络不可用' : '尚未检查更新',
    });
    const retry = fail.createEl('button', {
      cls: 'bz-btn bz-sp-res-fail-retry',
      text: checkFailed ? '重试' : '检查更新',
    });
    retry.addEventListener('click', () => {
      retry.disabled = true;
      retry.textContent = '检查中';
      void checkInBackground(body, ctx);
    });
  }

  for (const st of rows) {
    const line = body.createDiv({ cls: 'bz-sp-res-row' });
    const info = line.createDiv({ cls: 'bz-sp-res-info' });
    info.createDiv({ cls: 'bz-sp-res-name', text: st.name });
    info.createDiv({ cls: 'bz-sp-res-desc', text: rowDesc(st) });

    const btn = rowButton(st, !!manifest);
    const el = line.createEl('button', { cls: 'bz-btn bz-sp-res-btn', text: btn.text });
    el.disabled = btn.disabled;
    const isReady = st.skin ? st.skin.missing === 0 && st.skin.updated === 0 : st.doc === 'ready';
    if (isReady) el.classList.add('bz-sp-res-btn--done');
    if (btn.action) {
      el.addEventListener('click', () => {
        el.disabled = true;
        el.textContent = '下载中';
        el.classList.add('is-loading');
        void runAction(el, body, ctx, st, manifest!);
      });
    }
  }

  // 打开组顺手核对一次（60s 节流；节流窗在 checkInBackground 内**无论成败都记**，
  // 失败重画不会滚雪球成无限核对）；只更新数据与重绘，不打扰用户
  if (Date.now() - lastCheckAt > CHECK_THROTTLE_MS) {
    void checkInBackground(body, ctx);
  }
}

/** 后台核对清单；成败都重画——失败态就在重画里呈现。
 *  节流窗**无论成败都记**：失败也重画，若不记窗，重画尾部会再次触发核对 → 无限循环；
 *  「重试」按钮直调本函数（不经尾部节流判断），失败后立即可重试。 */
async function checkInBackground(body: HTMLElement, ctx: SettingsRowContext): Promise<void> {
  lastCheckAt = Date.now();
  try {
    await refreshManifest(getApp());
    checkFailed = false;
  } catch (e) {
    checkFailed = true;
    console.warn('[bz] 在线资源清单核对失败:', (e as Error)?.message || e);
  }
  await renderGroupBody(body, ctx);
}

/** 行动作：doc → downloadAsset（覆盖写）；皮肤 → downloadSkinUpdates（拉全部非就绪） */
async function runAction(
  el: HTMLElement,
  body: HTMLElement,
  ctx: SettingsRowContext,
  st: RowState,
  manifest: DownloadManifest,
): Promise<void> {
  const app = getApp();
  try {
    if (st.skin) {
      const r = await downloadSkinUpdates(app, manifest);
      if (r.failed > 0) notice(`${r.failed} 套皮肤下载失败，可稍后重试`, 'error');
    } else {
      const entry: ManifestDocEntry | undefined = manifest.docs.find((d) => d.id === st.id);
      // 走 sha256 校验通道（与皮肤同口径）：清单 hash 对不上即拒收，不把坏内容写进本地
      if (entry) await ensureAssetWithHash(app, entry.file, entry.sha256, entry.name);
    }
  } catch (e) {
    notice(e instanceof Error ? e.message : String(e), 'error');
  } finally {
    // 动作完成（成败皆然）→ 磁盘事实已变，全量重算重绘（按钮翻转成「已下载 / 更新 N」）
    await renderGroupBody(body, ctx);
  }
}

/** doc 行下载走 ensureAssetWithHash 的清单 sha256 校验，内容校验由 hash 承担（无遗留函数） */
