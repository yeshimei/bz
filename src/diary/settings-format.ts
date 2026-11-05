/**
 * 设置面板 → 日记本 → 存储：两种存储格式的卡片 + 切换确认 + 真实转换进度。
 *
 * 为什么不用 choiceCards：schema 的 choiceCards 是「点一下先写盘再翻 UI」，
 * 而这里切换格式必须先问「要不要顺带转换已有日记」，确认之后才允许落盘，
 * 所以走 custom 行自绘（设置面板插槽），交互与原型一一对应。
 *
 * 卡片只用文字 mini 预览，图标仍走 lucide（本文件不出现 emoji 图标）。
 */
import { getApp } from '../core/app';
import { getSettings, saveSettings } from '../core/settings-provider';
import { notify, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { diaryDateFromLegacyPath, diaryMetaFromEntryPath } from '../core/diary-format';
import { applyDirectories, DIARY_DIRECTORY, type DiaryEntryFormat } from './config';
import { convertDiaryFormat, type ConvertProgress } from './convert';

/** 当前设置里的格式（设置提供者未注入的测试环境回落 entry） */
function currentFormat(): DiaryEntryFormat {
  try {
    return getSettings().diaryEntryFormat === 'day' ? 'day' : 'entry';
  } catch (e) {
    return 'entry';
  }
}

/** 日记目录下当前一共多少个日记文件（两种格式都算，用于「已有的 N 个文件」） */
function countDiaryFiles(): number {
  const prefix = `${DIARY_DIRECTORY}/`;
  let n = 0;
  try {
    for (const f of getApp().vault.getMarkdownFiles?.() || []) {
      const p = String((f as { path?: string }).path || '');
      if (!p.startsWith(prefix)) continue;
      if (diaryMetaFromEntryPath(p) || diaryDateFromLegacyPath(p)) n += 1;
    }
  } catch (e) {
    return 0;
  }
  return n;
}

function cardHtml(format: DiaryEntryFormat, active: boolean, busy: boolean, lines: string[], name: string, sub: string): string {
  return (
    `<button type="button" class="bz-diary-fmt-card${active ? ' is-on' : ''}" data-fmt="${format}"` +
    `${busy ? ' disabled' : ''} role="radio" aria-checked="${active}">` +
    `<span class="bz-diary-fmt-mini">${lines.map((l) => `<span class="bz-diary-fmt-line">${l}</span>`).join('')}</span>` +
    `<span class="bz-diary-fmt-name">${name}</span>` +
    `<span class="bz-diary-fmt-sub">${sub}</span>` +
    `</button>`
  );
}

/** 挂进设置面板「存储」组的 custom 行插槽 */
export function mountDiaryFormatEditor(body: HTMLElement): void {
  let format = currentFormat();
  let busy = false;

  const root = document.createElement('div');
  root.className = 'bz-diary-fmt';
  body.appendChild(root);

  function render(): void {
    root.innerHTML =
      `<div class="bz-diary-fmt-title">日记的存法</div>` +
      `<div class="bz-diary-fmt-cards" role="radiogroup">` +
      cardHtml(
        'entry',
        format === 'entry',
        busy,
        ['2606131223.md', '2606132359.md', '<span class="seg">一条日记一个文件</span>'],
        '一篇一个文件',
        '每条独立成篇，属性里带日期与分类'
      ) +
      cardHtml(
        'day',
        format === 'day',
        busy,
        ['2026-06-13.md', '<span class="seg"># 📖 12:23</span>', '<span class="seg"># ✍️ 22:10</span>'],
        '一天一个文件',
        'Obsidian 日记原生格式，当天的日记分段'
      ) +
      `</div>` +
      `<div class="bz-diary-fmt-progress" hidden>` +
      `<div class="bz-diary-fmt-progress-meta"><span data-role="label">正在转换…</span><span data-role="pct">0%</span></div>` +
      `<div class="bz-diary-fmt-track"><div class="bz-diary-fmt-fill" data-role="fill"></div></div>` +
      `</div>`;
  }

  function progressEl(): HTMLElement | null {
    return root.querySelector<HTMLElement>('.bz-diary-fmt-progress');
  }

  function showProgress(p?: ConvertProgress): void {
    const box = progressEl();
    if (!box) return;
    box.hidden = false;
    const label = box.querySelector<HTMLElement>('[data-role="label"]');
    const pct = box.querySelector<HTMLElement>('[data-role="pct"]');
    const fill = box.querySelector<HTMLElement>('[data-role="fill"]');
    if (!p) {
      if (label) label.textContent = '正在转换…';
      if (pct) pct.textContent = '0%';
      if (fill) fill.style.width = '0%';
      return;
    }
    const percent = p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
    if (label) label.textContent = p.current ? `正在转换：${p.current.split('/').pop()}` : '正在转换…';
    if (pct) pct.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;
  }

  function hideProgress(): void {
    const box = progressEl();
    if (box) box.hidden = true;
  }

  /** 只切换格式：写设置，不动文件 */
  async function switchOnly(next: DiaryEntryFormat): Promise<void> {
    const s = getSettings();
    s.diaryEntryFormat = next;
    try {
      await saveSettings();
    } catch (e) {
      notifySaveError(e, '日记格式');
      return;
    }
    applyDirectories(s);
    format = next;
    render();
    notify('已切换；之后的日记按新格式写，已有日记没动', { type: 'info' });
  }

  /** 切换并转换：先转换，成功后写设置 */
  async function convertAndSwitch(next: DiaryEntryFormat): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    showProgress();
    try {
      const report = await convertDiaryFormat(next, (p) => showProgress(p));
      if (report.converted === 0 && report.errors.length > 0) {
        notify(`没有文件转换成功，格式没有切换：${report.errors[0]?.reason || '未知错误'}`, { type: 'error' });
        return;
      }
      const s = getSettings();
      s.diaryEntryFormat = next;
      await saveSettings();
      applyDirectories(s);
      format = next;
      const parts = [`已转换 ${report.converted} 个文件`];
      if (report.skipped.length > 0) parts.push(`跳过 ${report.skipped.length} 个`);
      if (report.errors.length > 0) parts.push(`失败 ${report.errors.length} 个`);
      notify(parts.join('，'), { type: report.errors.length > 0 ? 'warning' : 'success' });
    } catch (e) {
      notify(`转换失败：${e instanceof Error ? e.message : String(e)}`, { type: 'error' });
    } finally {
      busy = false;
      hideProgress();
      render();
    }
  }

  /** 切换确认框：取消 / 只切换 / 切换并转换 */
  async function askSwitch(next: DiaryEntryFormat): Promise<void> {
    const toDay = next === 'day';
    const count = countDiaryFiles();
    const nowName = toDay ? '一篇一个文件' : '一天一个文件';
    const nextName = toDay ? '一天一个文件' : '一篇一个文件';
    const example = toDay ? '2026-06-13.md' : '2606131223.md';
    const detail = toDay
      ? '当天写的几篇会收进同一个文件，每篇用 # 📖 12:23 这样的标题分开。'
      : '每篇日记独立成一个文件，日期时间写在文件名和属性里。';
    const message = [
      `现在按「${nowName}」存；之后新写的按 ${example} 这样存。`,
      detail,
      `只切换的话，已有的 ${count} 个文件保持原样，只有以后新写的用新格式。`,
      `也可以顺手把已有的 ${count} 个文件一起转换。转换会改写文件形态，原文件移入 Obsidian 回收站，可恢复。`,
    ].join('\n');

    const value = await openFlowDialog({
      title: `切换到「${nextName}」？`,
      message,
      className: 'bz-sp-skin bz-diary-fmt-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '只切换格式', value: 'switch' },
        { label: '切换并转换', value: 'convert', cta: true },
      ],
    });
    if (value === 'switch') await switchOnly(next);
    else if (value === 'convert') await convertAndSwitch(next);
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-fmt]');
    if (!btn || busy) return;
    const next = btn.dataset.fmt === 'day' ? 'day' : 'entry';
    if (next === format) return;
    void askSwitch(next);
  });

  render();
}
