/**
 * 设置面板 → 日记本 → 分类：清单式编辑器（2026-11 用户定稿形态）。
 *
 * - 全部平级：一行一个分类（emoji + 名字），没有主标签/二级标签，没有展开面板；
 * - 拖动排序、↑↓ 按钮（键盘可达）、点 emoji 换图标、点名字直接改；
 * - 底部「＋ 添加分类」；删除时有日记在用会说明「已有日记不会被改」；
 * - 默认 3 个示例，存在 settings.diaryTypes（JSON），每次改动即时落盘；
 * - 操作图标一律 lucide（grip/arrow-up/arrow-down/x/plus），分类自己的图标是 emoji。
 *
 * 用量（「N 篇在用」）：挂载后后台扫一遍日记目录（新格式读 frontmatter，旧格式拆块），
 * 只用于删除提示与行内小字，不落盘、不阻塞渲染。
 */
import { getApp } from '../core/app';
import { getSettings, saveSettings } from '../core/settings-provider';
import { notify, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { topifyZ } from '../core/z-order';
import { iconSpan } from '../core/ui/str';
import { mountIcons } from '../core/ui';
import { diaryMetaFromEntryPath, parseDiaryEntryFile } from '../core/diary-format';
import {
  applyDiaryTypes,
  currentDiaryTypes,
  serializedDiaryTypes,
  DIARY_DIRECTORY,
  diaryDayDateOf,
  type DiaryTypeConfig,
} from './config';
import { parseLegacyDayFile } from './legacy';

/** 常用 emoji（点图标时弹出；也支持手动粘贴一个） */
const EMOJI_CHOICES = [
  '📖', '✍️', '📝', '🌙', '🌟', '😶', '🤝', '💭', '🎧', '📚',
  '✈️', '🍜', '☕', '🌿', '🐱', '🐶', '🏠', '💻', '🎮', '🎬',
  '📷', '🚴', '🧘', '🎨', '🔖', '⭐', '📌', '🕯️', '☀️', '🌊',
  '🏔️', '🍂', '🧩', '🎵', '💌', '🗒️', '🌱', '🍵', '🏛️', '🎞️',
];

function esc(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/** 经典 sortable 的 HTML5 拖拽（桌面）；触屏/键盘走 ↑↓ 按钮 */
function attachDrag(root: HTMLElement, onReorder: (from: number, to: number) => void): void {
  let from = -1;
  root.addEventListener('dragstart', (e) => {
    const grip = (e.target as HTMLElement).closest<HTMLElement>('[data-grip]');
    if (!grip) return;
    from = Number(grip.getAttribute('data-grip'));
    const row = grip.closest<HTMLElement>('.bz-diary-type-row');
    row?.classList.add('is-dragging');
    try {
      e.dataTransfer?.setData('text/plain', String(from));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    } catch (err) {
      /* 老环境 dataTransfer 不可用：不影响拖拽事件本身 */
    }
  });
  root.addEventListener('dragend', () => {
    from = -1;
    root.querySelectorAll('.is-dragging,.is-drop').forEach((n) => n.classList.remove('is-dragging', 'is-drop'));
  });
  root.addEventListener('dragover', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.bz-diary-type-row');
    if (!row || from < 0) return;
    e.preventDefault();
    root.querySelectorAll('.is-drop').forEach((n) => n.classList.remove('is-drop'));
    row.classList.add('is-drop');
  });
  root.addEventListener('drop', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.bz-diary-type-row');
    if (!row || from < 0) return;
    e.preventDefault();
    const to = Number(row.getAttribute('data-idx'));
    if (Number.isFinite(to) && to !== from) onReorder(from, to);
    from = -1;
  });
}

/** 挂在 body 上的 emoji 选择浮层（不穿设置面板皮，走组件库 --bz-* token）。
 *
 * 2026-11-05 用户报「点击图标打开的窗口被设置面遮挡」：浮层此前只有 CSS 里一档静态
 * `z-index: 10050`，而设置面板走动态发号（ADR-0067，100000+），一进面板就永远压在下面。
 * 现在与全站 overlay 同口径：append 后 `topifyZ`，谁后显示谁在上。 */
function openEmojiPicker(anchor: HTMLElement, onPick: (emoji: string) => void): void {
  document.querySelector('.bz-diary-type-emoji-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'bz-diary-type-emoji-pop';
  pop.innerHTML =
    `<div class="bz-diary-type-emoji-grid">` +
    EMOJI_CHOICES.map((e) => `<button type="button" class="bz-diary-type-emoji-cell" data-e="${e}">${e}</button>`).join('') +
    `</div>` +
    `<div class="bz-diary-type-emoji-custom"><input type="text" maxlength="8" placeholder="或粘贴一个 emoji" aria-label="自定义 emoji"><button type="button" class="bz-btn bz-btn--sm" data-ok>用这个</button></div>`;
  document.body.appendChild(pop);
  topifyZ(pop);

  const rect = anchor.getBoundingClientRect();
  const width = 262;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left - 8))}px`;
  pop.style.top = `${Math.min(window.innerHeight - 210, rect.bottom + 7)}px`;

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('mousedown', onOutside, true);
    pop.remove();
  };
  function onOutside(e: MouseEvent): void {
    if (!pop.contains(e.target as Node) && e.target !== anchor) close();
  }
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

  const pick = (emoji: string): void => {
    if (!emoji) return;
    close();
    onPick(emoji);
  };
  pop.querySelectorAll<HTMLElement>('[data-e]').forEach((b) => {
    b.addEventListener('click', () => pick(b.dataset.e || ''));
  });
  const input = pop.querySelector<HTMLInputElement>('input');
  pop.querySelector<HTMLElement>('[data-ok]')?.addEventListener('click', () => pick(input?.value.trim() || ''));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pick(input.value.trim());
  });
  input?.focus();
}

/** 挂进设置面板「分类」组的 custom 行插槽 */
export function mountDiaryTypeEditor(body: HTMLElement): void {
  let types: DiaryTypeConfig[] = currentDiaryTypes();
  const usage = new Map<string, number>();
  let usageReady = false;
  let commitTimer: ReturnType<typeof setTimeout> | null = null;

  const root = document.createElement('div');
  root.className = 'bz-diary-type';
  body.appendChild(root);

  /** 落盘：先刷新运行时映射（写日记弹窗/筛选栏立即生效），再存 */
  function commit(): void {
    const s = getSettings();
    s.diaryTypes = serializedDiaryTypes(types);
    applyDiaryTypes(s.diaryTypes);
    void saveSettings().catch((e) => notifySaveError(e, '日记分类'));
  }

  /** 输入名字时防抖落盘（不重绘列表，避免丢焦点） */
  function scheduleCommit(): void {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = null;
      commit();
    }, 600);
  }

  function metaText(t: DiaryTypeConfig): string {
    if (!usageReady) return '统计中…';
    const n = usage.get(t.tag) ?? 0;
    return n > 0 ? `${n} 篇在用` : '还没有日记用';
  }

  function rowHtml(t: DiaryTypeConfig, i: number): string {
    return (
      `<div class="bz-diary-type-row" data-idx="${i}">` +
      `<span class="bz-diary-type-grip" role="button" tabindex="0" draggable="true" data-grip="${i}" aria-label="调整顺序（拖动或上/下方向键）">${iconSpan('grip-vertical')}</span>` +
      `<button type="button" class="bz-diary-type-emoji" data-act="emoji" title="换图标" aria-label="换图标">${esc(t.emoji)}</button>` +
      `<div class="bz-diary-type-main">` +
      `<input class="bz-diary-type-name" data-act="name" value="${esc(t.tag)}" spellcheck="false" aria-label="分类名">` +
      `<div class="bz-diary-type-meta" data-meta-idx="${i}">${esc(metaText(t))}</div>` +
      `</div>` +
      `<div class="bz-diary-type-actions">` +
      `<button type="button" class="bz-diary-type-ibtn" data-act="up" title="上移" aria-label="上移" ${i === 0 ? 'disabled' : ''}>${iconSpan('arrow-up')}</button>` +
      `<button type="button" class="bz-diary-type-ibtn" data-act="down" title="下移" aria-label="下移" ${i === types.length - 1 ? 'disabled' : ''}>${iconSpan('arrow-down')}</button>` +
      `<button type="button" class="bz-diary-type-ibtn is-danger" data-act="del" title="删除" aria-label="删除">${iconSpan('x')}</button>` +
      `</div>` +
      `</div>`
    );
  }

  function render(): void {
    root.innerHTML =
      `<div class="bz-diary-type-list" data-list>` +
      types.map((t, i) => rowHtml(t, i)).join('') +
      `</div>` +
      `<button type="button" class="bz-diary-type-add" data-act="add">${iconSpan('plus')}<span>添加分类</span></button>` +
      `<div class="bz-diary-type-preview"><span class="bz-diary-type-preview-label">分类</span>` +
      (types.length > 0
        ? types.map((t) => `<span class="bz-diary-type-pchip">${esc(t.emoji)} ${esc(t.tag)}</span>`).join('')
        : `<span class="bz-diary-type-empty">还没有分类</span>`) +
      `</div>`;
    mountIcons(root);
  }

  /** 只刷新行内小字与筛选栏（不重建输入框） */
  function refreshMeta(): void {
    root.querySelectorAll<HTMLElement>('[data-meta-idx]').forEach((el) => {
      const i = Number(el.getAttribute('data-meta-idx'));
      const t = types[i];
      if (t) el.textContent = metaText(t);
    });
  }

  function refreshPreview(): void {
    const preview = root.querySelector<HTMLElement>('.bz-diary-type-preview');
    if (!preview) return;
    preview.innerHTML =
      `<span class="bz-diary-type-preview-label">分类</span>` +
      (types.length > 0
        ? types.map((t) => `<span class="bz-diary-type-pchip">${esc(t.emoji)} ${esc(t.tag)}</span>`).join('')
        : `<span class="bz-diary-type-empty">还没有分类</span>`);
  }

  function reorder(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= types.length || to >= types.length || from === to) return;
    const [x] = types.splice(from, 1);
    types.splice(to, 0, x);
    commit();
    render();
  }

  function focusName(index: number): void {
    const input = root.querySelector<HTMLInputElement>(`.bz-diary-type-row[data-idx="${index}"] .bz-diary-type-name`);
    if (input) {
      input.focus();
      input.select();
    }
  }

  function addType(): void {
    const t: DiaryTypeConfig = { tag: '新分类', emoji: '📝' };
    types.push(t);
    commit();
    render();
    focusName(types.length - 1);
  }

  function askDelete(index: number): void {
    const t = types[index];
    if (!t) return;
    if (types.length <= 1) {
      notify('至少留一个分类', { type: 'warning' });
      return;
    }
    const n = usage.get(t.tag) ?? 0;
    const message =
      n > 0
        ? `还有 ${n} 篇日记在用「${t.tag}」这个分类。删除后，这些日记里的 type 不会变，但筛选栏、写日记弹窗里不再出现它。已有日记一个字都不会改。`
        : `还没有日记在用「${t.tag}」，删掉不影响任何笔记。`;
    void openFlowDialog({
      title: `删除「${t.tag}」？`,
      message,
      className: 'bz-sp-skin bz-diary-type-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '删除分类', value: 'ok', danger: true },
      ],
    }).then((value) => {
      if (value !== 'ok') return;
      types.splice(index, 1);
      commit();
      render();
      notify(`已删除「${t.tag}」`, { type: 'success' });
    });
  }

  root.addEventListener('click', (e) => {
    const actEl = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!actEl) return;
    const act = actEl.dataset.act;
    const row = actEl.closest<HTMLElement>('.bz-diary-type-row');
    const index = row ? Number(row.getAttribute('data-idx')) : -1;

    if (act === 'add') {
      addType();
      return;
    }
    if (index < 0 || !types[index]) return;
    if (act === 'up') {
      reorder(index, index - 1);
      focusName(index - 1);
      return;
    }
    if (act === 'down') {
      reorder(index, index + 1);
      focusName(index + 1);
      return;
    }
    if (act === 'del') {
      askDelete(index);
      return;
    }
    if (act === 'emoji') {
      openEmojiPicker(actEl, (emoji) => {
        types[index].emoji = emoji;
        commit();
        render();
      });
    }
  });

  root.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('bz-diary-type-name')) return;
    const row = input.closest<HTMLElement>('.bz-diary-type-row');
    const index = row ? Number(row.getAttribute('data-idx')) : -1;
    if (index < 0 || !types[index]) return;
    types[index].tag = input.value;
    scheduleCommit();
    refreshPreview();
    refreshMeta();
  });

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('bz-diary-type-name')) return;
    const row = input.closest<HTMLElement>('.bz-diary-type-row');
    const index = row ? Number(row.getAttribute('data-idx')) : -1;
    if (index < 0 || !types[index]) return;
    if (!input.value.trim()) {
      input.value = '未命名';
      types[index].tag = '未命名';
    }
    commit();
    render();
  });

  root.addEventListener('keydown', (e) => {
    const grip = (e.target as HTMLElement).closest<HTMLElement>('[data-grip]');
    if (!grip) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const from = Number(grip.getAttribute('data-grip'));
    reorder(from, from + (e.key === 'ArrowUp' ? -1 : 1));
    focusName(from + (e.key === 'ArrowUp' ? -1 : 1));
  });

  attachDrag(root, reorder);
  render();
  void scanUsage();

  /** 后台统计「每个分类有多少篇日记在用」；只更新小字，不动输入框 */
  async function scanUsage(): Promise<void> {
    let app: ReturnType<typeof getApp>;
    try {
      app = getApp();
    } catch (e) {
      return; // 设置面板在无 app 的测试/早期渲染：不统计，行内小字保持「统计中…」
    }
    const prefix = `${DIARY_DIRECTORY}/`;
    const files = (app.vault.getMarkdownFiles?.() || []).filter((f) =>
      String((f as { path?: string }).path || '').startsWith(prefix)
    );
    const counts = new Map<string, number>();
    const inc = (tag: string): void => {
      if (!tag) return;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i] as any;
      const path = String(file.path || '');
      try {
        if (diaryMetaFromEntryPath(path)) {
          // 先吃 metadataCache（快），没有就退回读文件解析
          const cache = app.metadataCache?.getFileCache?.(file);
          const raw = cache?.frontmatter?.type;
          if (Array.isArray(raw)) raw.forEach((x) => inc(String(x).trim()));
          else if (typeof raw === 'string') inc(raw.trim());
          else {
            const content = await app.vault.cachedRead(file);
            parseDiaryEntryFile(content).tags.forEach(inc);
          }
        } else {
          const dayDate = diaryDayDateOf(path);
          if (!dayDate) continue;
          const content = await app.vault.cachedRead(file);
          const day = parseLegacyDayFile(content, path, dayDate);
          for (const b of day?.blocks ?? []) b.tags.forEach(inc);
        }
      } catch (e) {
        /* 单个文件读失败不影响其余统计 */
      }
      if (i % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    counts.forEach((n, tag) => usage.set(tag, n));
    usageReady = true;
    refreshMeta();
  }
}
