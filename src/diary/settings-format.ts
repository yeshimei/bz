/**
 * 设置面板 → 日记本 → 存储：两种存储格式的卡片 + 切换确认 + 真实转换进度。
 *
 * 为什么不用 choiceCards：schema 的 choiceCards 是「点一下先写盘再翻 UI」，
 * 而这里切换格式必须先问「要不要顺带转换已有日记」，确认之后才允许落盘，
 * 所以走 custom 行自绘（设置面板插槽），交互与原型一一对应。
 *
 * 卡片只用文字 mini 预览，图标仍走 lucide（本文件不出现 emoji 图标）。
 *
 * 切换确认框（2026-11-05 用户重做）：正文走 openFlowDialog 的 `body` 富内容——
 * 目标格式的样例文件名单独成块当视觉中心，下面只留「已有 N 个文件保持原样」与
 * 「转换进回收站」两句小字；不再把当前格式、分段规则、转换后果凑成四段等重长文。
 *
 * 进度条只在转换期间存在于 DOM（开始时插入、结束即移除）：旧实现渲染时先放一个
 * `hidden` 的条，但 `.bz-diary-fmt-progress{display:flex}` 会压过 `[hidden]` 的 UA 规则，
 * 转换完「正在转换… 0%」就永久留在页面上（用户 2026-11-05 报障）。
 */
import { getApp } from '../core/app';
import { getSettings, saveSettings } from '../core/settings-provider';
import { notify, notifySaveError } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { diaryMetaFromEntryPath } from '../core/diary-format';
import { applyDirectories, DIARY_DIRECTORY, diaryDayDateOf, diaryDayStampOf, type DiaryEntryFormat } from './config';
import { convertDiaryFormat, type ConvertProgress } from './convert';
import { parseDayFileForRead } from './legacy';

/** 格式名：卡片、确认框标题共用一套，避免叫法漂移 */
const FORMAT_LABEL: Record<DiaryEntryFormat, string> = {
  entry: '一篇一个文件',
  day: '一天一个文件',
};

/**
 * 示例文件名：day 格式按 **Obsidian 日记的日期格式** 生成（2026-11-05 用户要求），
 * 固定用 2026-06-13 作示例日期——用户一眼能看出自己库里将来的文件长什么样。
 * 例：`YYYY/MM/DD` → `2026/06/13.md`；`YYYY.MM.DD` → `2026.06.13.md`。
 */
function formatSample(format: DiaryEntryFormat): string {
  return format === 'day' ? `${diaryDayStampOf('2026-06-13')}.md` : '2606131223.md';
}

/** 样例块的引导语（只说「之后新写的会怎样」，不复述当前格式） */
const FORMAT_CAP: Record<DiaryEntryFormat, string> = {
  entry: '之后新写的，每条一个文件',
  day: '之后新写的，当天都收进这一份',
};

/** 当前设置里的格式（设置提供者未注入的测试环境回落 day——2026-11-05 新缺省） */
function currentFormat(): DiaryEntryFormat {
  try {
    return getSettings().diaryEntryFormat === 'entry' ? 'entry' : 'day';
  } catch (e) {
    return 'day';
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
      if (diaryMetaFromEntryPath(p) || diaryDayDateOf(p)) n += 1;
    }
  } catch (e) {
    return 0;
  }
  return n;
}

/**
 * 日记目录下有多少「整篇无头行」的 day 文件（Obsidian 原生日记，没有 `# emoji HH:mm` 分段时间）。
 * 只有转成「一篇一个文件」时才要问——切回「一天一个文件」不涉及补时间。
 * 用 cachedRead：确认框要秒开，不为一个计数把整库正文重读一遍；读不出的不计入，
 * 转换时会照旧进跳过报告。
 */
async function countNativeDayFiles(): Promise<number> {
  const prefix = `${DIARY_DIRECTORY}/`;
  let n = 0;
  try {
    const app = getApp();
    for (const f of app.vault.getMarkdownFiles?.() || []) {
      const p = String((f as { path?: string }).path || '');
      if (!p.startsWith(prefix)) continue;
      if (diaryMetaFromEntryPath(p)) continue;
      const date = diaryDayDateOf(p);
      if (!date) continue;
      try {
        const content = await app.vault.cachedRead(f as never);
        const day = parseDayFileForRead(content, p, date, (f as { stat?: { ctime?: number } }).stat?.ctime);
        if (day?.whole) n += 1;
      } catch (e) {
        /* 单篇读失败：不计入 */
      }
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
 * 切换确认框的富正文：
 * - 上半 = 样例块（视觉中心）：引导语 + 目标文件名等宽大字；
 * - 下半 = 两句事实：已有文件保持原样 / 转换进回收站；
 * - 原生日记（整篇无头行）存在时，再补一句它们会怎么转。
 * 只描述「之后会怎样」与「已有会怎样」，不复述当前格式与分段规则——那两件事
 * 两张格式卡片的 mini 预览已经说完了，确认框再抄一遍就是噪音。
 */
function buildSwitchBody(next: DiaryEntryFormat, count: number, native = 0): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'bz-diary-fmt-dialog-body';

  const sample = document.createElement('div');
  sample.className = 'bz-diary-fmt-dialog-sample';
  const cap = document.createElement('span');
  cap.className = 'bz-diary-fmt-dialog-cap';
  cap.textContent = FORMAT_CAP[next];
  const file = document.createElement('span');
  file.className = 'bz-diary-fmt-dialog-file';
  file.textContent = formatSample(next);
  sample.append(cap, file);

  const facts = document.createElement('div');
  facts.className = 'bz-diary-fmt-dialog-facts';
  const existing = document.createElement('span');
  existing.textContent = count > 0 ? `已有 ${count} 个文件保持原样` : '还没有已存的日记文件';
  const note = document.createElement('span');
  note.className = 'bz-diary-fmt-dialog-note';
  note.textContent = '转换的话，原文件进回收站，可恢复';
  // 加密日记不在 md 里（在保险库），切换格式不会碰它们——用户容易以为「整本一起转」
  const enc = document.createElement('span');
  enc.className = 'bz-diary-fmt-dialog-note';
  enc.textContent = '保险库里的加密日记不受影响';
  facts.append(existing, note, enc);

  /*
   * 整篇无头行的原生日记：转换会把整篇算一条、时间靠文件创建时间补。
   * 这是「用户看不见的推断」，必须在点转换之前说清楚——转完再解释就晚了。
   */
  if (next === 'entry' && native > 0) {
    const nativeNote = document.createElement('span');
    nativeNote.className = 'bz-diary-fmt-dialog-note bz-diary-fmt-dialog-native';
    nativeNote.textContent =
      `其中 ${native} 篇是 Obsidian 原生日记（一整篇，没有分段时间）：转换后每篇算一条，` +
      '时间按文件创建时间补；文件创建时间不在这天的，记 00:00';
    facts.append(nativeNote);
  }

  wrap.append(sample, facts);
  return wrap;
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
        [formatSample('day'), '<span class="seg"># 📖 12:23</span>', '<span class="seg"># ✍️ 22:10</span>'],
        '一天一个文件',
        'Obsidian 日记原生格式，当天的日记分段'
      ) +
      `</div>`;
  }

  function progressEl(): HTMLElement | null {
    return root.querySelector<HTMLElement>('.bz-diary-fmt-progress');
  }

  /** 进度条只在转换期间存在：第一次上报时建，之后原地更新 */
  function ensureProgress(): HTMLElement {
    const existing = progressEl();
    if (existing) return existing;
    const box = document.createElement('div');
    box.className = 'bz-diary-fmt-progress';
    box.setAttribute('role', 'status');
    box.innerHTML =
      `<div class="bz-diary-fmt-progress-meta"><span data-role="label">正在转换…</span><span data-role="pct">0%</span></div>` +
      `<div class="bz-diary-fmt-track"><div class="bz-diary-fmt-fill" data-role="fill"></div></div>`;
    root.appendChild(box);
    return box;
  }

  function showProgress(p?: ConvertProgress): void {
    const box = ensureProgress();
    const label = box.querySelector<HTMLElement>('[data-role="label"]');
    const pct = box.querySelector<HTMLElement>('[data-role="pct"]');
    const fill = box.querySelector<HTMLElement>('[data-role="fill"]');
    const percent = p && p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
    if (label) label.textContent = p?.current ? `正在转换：${p.current.split('/').pop()}` : '正在转换…';
    if (pct) pct.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;
  }

  /** 结束即从 DOM 摘掉——不留「正在转换…」的残影（见文件头 2026-11-05 报障） */
  function hideProgress(): void {
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
      if (report.inferred.length > 0) parts.push(`其中 ${report.inferred.length} 篇按文件创建时间补了时分`);
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
    const count = countDiaryFiles();
    // 只有转成「一篇一个文件」才要补时间；切回一天一个文件不涉及
    const native = next === 'entry' ? await countNativeDayFiles() : 0;
    const sample = formatSample(next);
    const existing = count > 0 ? `已有 ${count} 个文件保持原样` : '还没有已存的日记文件';
    const note = '转换的话，原文件进回收站，可恢复';
    // 纯文本兜底（读屏 / 弹窗没建成时仍可读）：与富正文同句，不重复当前格式与分段规则
    const message = [
      `${FORMAT_CAP[next]}：${sample}`,
      existing,
      note,
      ...(native > 0
        ? [`其中 ${native} 篇是 Obsidian 原生日记，转换后每篇算一条，时间按文件创建时间补`]
        : []),
    ].join('\n');

    const value = await openFlowDialog({
      title: `切换到「${FORMAT_LABEL[next]}」？`,
      message,
      body: buildSwitchBody(next, count, native),
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
