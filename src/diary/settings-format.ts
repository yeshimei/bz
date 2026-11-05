/**
 * 设置面板 → 日记本 → 存储：两种存储格式的卡片 + 切换确认 + 真实转换进度。
 *
 * 为什么不用 choiceCards：schema 的 choiceCards 是「点一下先写盘再翻 UI」，
 * 而这里切换格式必须先问「要不要顺带转换已有日记」，确认之后才允许落盘，
 * 所以走 custom 行自绘（设置面板插槽），交互与原型一一对应。
 *
 * 卡片只用文字 mini 预览，图标仍走 lucide（本文件不出现 emoji 图标）。
 *
 * 切换确认框穿日记本的皮：`className` 带 `bz-diary-flow-dialog`（本域既有纸面流程框皮肤）
 * + `bz-diary-fmt-dialog`（本弹窗的排版细化，见 styles.css）。正文按「目标 / 现状 / 可转换」
 * 三段排，目标文件名用等宽样例块；openFlowDialog 的 message 只能纯文本，所以先给它一份
 * 完整兜底文案，再把弹窗里的 <p> 换成三段结构（找不到弹窗时兜底文案照常可读）。
 */
import { getApp } from '../core/app';
import { getSettings, saveSettings } from '../core/settings-provider';
import { notify, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { diaryDateFromLegacyPath, diaryMetaFromEntryPath } from '../core/diary-format';
import { applyDirectories, DIARY_DIRECTORY, type DiaryEntryFormat } from './config';
import { convertDiaryFormat, type ConvertProgress } from './convert';

/** 格式名与样例文件名：与设置页两张卡片、确认框标题共用一套，避免三处叫法漂移 */
const FORMAT_LABEL: Record<DiaryEntryFormat, string> = {
  entry: '一篇一个文件',
  day: '一天一个文件',
};
const FORMAT_SAMPLE: Record<DiaryEntryFormat, string> = {
  entry: '2606131223.md',
  day: '2026-06-13.md',
};
/** 目标格式的一句话说明（拆成「样例文件名」前后两段，中间渲染等宽块） */
const FORMAT_GOAL: Record<DiaryEntryFormat, { head: string; tail: string }> = {
  entry: { head: '之后新写的会存成 ', tail: '，日期时间写在文件名和属性里。' },
  day: { head: '之后新写的会收进 ', tail: '，当天的几篇按时间排在同一个文件里。' },
};

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

/**
 * 把确认框的纯文本正文换成三段结构：
 * 目标（样例文件名等宽块）/ 现状（N 个文件保持原样）/ 可转换（小字次要色）。
 * 只在弹窗存在且带本域皮肤类时动手；找不到（测试替身 / 被替换）就保留调用方的纯文本兜底。
 */
function decorateSwitchDialog(parts: {
  sample: string;
  head: string;
  tail: string;
  existing: string;
  note: string;
}): void {
  const popup = document.getElementById('__shared_confirm_popup__');
  if (!popup || !popup.classList.contains('bz-diary-fmt-dialog')) return;
  const p = popup.querySelector('p');
  if (!p) return;

  const body = document.createElement('div');
  body.className = 'bz-diary-fmt-dialog-body';

  const goal = document.createElement('span');
  goal.className = 'bz-diary-fmt-dialog-line';
  goal.append(document.createTextNode(parts.head));
  const code = document.createElement('code');
  code.className = 'bz-diary-fmt-dialog-file';
  code.textContent = parts.sample;
  goal.append(code, document.createTextNode(parts.tail));

  const existing = document.createElement('span');
  existing.className = 'bz-diary-fmt-dialog-line';
  existing.textContent = parts.existing;

  const note = document.createElement('span');
  note.className = 'bz-diary-fmt-dialog-line bz-diary-fmt-dialog-note';
  note.textContent = parts.note;

  body.append(goal, existing, note);
  p.replaceWith(body);
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
        [FORMAT_SAMPLE.entry, '2606132359.md', '<span class="seg">一条日记一个文件</span>'],
        FORMAT_LABEL.entry,
        '每条独立成篇，属性里带日期与分类'
      ) +
      cardHtml(
        'day',
        format === 'day',
        busy,
        [FORMAT_SAMPLE.day, '<span class="seg"># 📖 12:23</span>', '<span class="seg"># ✍️ 22:10</span>'],
        FORMAT_LABEL.day,
        'Obsidian 日记原生格式，当天的日记分段'
      ) +
      `</div>`;
  }

  function progressEl(): HTMLElement | null {
    return root.querySelector<HTMLElement>('.bz-diary-fmt-progress');
  }

  /** 进度条只在转换期间存在（结束即 remove）——旧实现用 hidden，但 display:flex 会压过
   *  `[hidden]` 的 UA 规则，转换完会在页面上留下「正在转换… 0%」的残影。 */
  function ensureProgress(): HTMLElement {
    const existing = progressEl();
    if (existing) return existing;
    const box = document.createElement('div');
    box.className = 'bz-diary-fmt-progress';
    box.setAttribute('role', 'status');
    box.innerHTML =
      `<div class="bz-diary-fmt-progress-meta"><span data-role="label">正在转换…</span><span data-role="pct">0%</span></div>` +
      `<progress class="bz-diary-fmt-track" data-role="fill" max="100" value="0" aria-label="转换进度"></progress>`;
    root.appendChild(box);
    return box;
  }

  function showProgress(p?: ConvertProgress): void {
    const box = ensureProgress();
    const label = box.querySelector<HTMLElement>('[data-role="label"]');
    const pct = box.querySelector<HTMLElement>('[data-role="pct"]');
    const fill = box.querySelector<HTMLProgressElement>('[data-role="fill"]');
    const percent = p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
    if (label) label.textContent = p?.current ? `正在转换：${p.current.split('/').pop()}` : '正在转换…';
    if (pct) pct.textContent = `${percent}%`;
    if (fill) fill.value = percent;
  }

  function clearProgress(): void {
    progressEl()?.remove();
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
      clearProgress();
      render();
    }
  }

  /** 切换确认框：取消 / 只切换 / 切换并转换 */
  async function askSwitch(next: DiaryEntryFormat): Promise<void> {
    const count = countDiaryFiles();
    const sample = FORMAT_SAMPLE[next];
    const goal = FORMAT_GOAL[next];
    const existing = count > 0 ? `已有的 ${count} 个文件保持原样。` : '现在还没有已存的日记文件。';
    const note = '也可以顺手转换，原文件进 Obsidian 回收站，可恢复。';
    // 兜底文案保持可读：decorateSwitchDialog 找不到弹窗时（测试替身/被替换）仍显示三段话。
    const message = [`${goal.head}${sample}${goal.tail}`, existing, note].join('\n');

    const settled = openFlowDialog({
      title: `切换到「${FORMAT_LABEL[next]}」？`,
      message,
      // 纸面皮复用日记域既有 `.bz-diary-flow-dialog`；`.bz-diary-fmt-dialog` 只补本框的排版。
      className: 'bz-sp-skin bz-diary-flow-dialog bz-diary-fmt-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '只切换格式', value: 'switch' },
        { label: '切换并转换', value: 'convert', cta: true },
      ],
    });
    // openFlowDialog 同步建 DOM（Promise 未结算），这里立刻补结构；找不到则保留纯文本 message。
    decorateSwitchDialog({ sample, head: goal.head, tail: goal.tail, existing, note });

    const value = await settled;
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
