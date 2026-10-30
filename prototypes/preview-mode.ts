/**
 * 评审壳「文件夹」开关 → 假设置的唯一口子（prototypes/preview-mode.ts）
 *
 * 外景壳的「文件夹：未配置 / 空册 / 有内容」把状态写在视图 URL 上，各域假层用这里的
 * 函数把它翻译成设置：`dirs=0` → 该域目录键留空（看未配置的引导态）；不带或 `dirs=1`
 * → 保持壳自己的缺省（看正常界面）。
 *
 * 为什么不放在 core：这是假层的东西，真插件里没有「URL 开关」这回事。
 */

/** 当前壳要求的目录态：'' 未指定 / '0' 未配置 / '1' 已配置 */
export function pvDirsMode(): '' | '0' | '1' {
  try {
    const v = new URLSearchParams(location.search).get('dirs');
    return v === '0' ? '0' : v === '1' ? '1' : '';
  } catch (e) {
    return '';
  }
}

/** 壳要求「未配置」（引导态） */
export function pvUnset(): boolean {
  return pvDirsMode() === '0';
}

/** 按开关把一组目录键清空（就地改壳里的 settingsStore） */
export function pvBlankDirs(store: Record<string, unknown>, keys: string[]): void {
  if (!pvUnset()) return;
  for (const k of keys) store[k] = '';
}

/** 壳要求「配好了但没内容」（第三档）：目录照常生效，只把演示数据清掉 */
export function pvEmptyData(): boolean {
  try {
    return new URLSearchParams(location.search).get('state') === 'empty';
  } catch (e) {
    return false;
  }
}

/**
 * 把假库里这些路径抹掉（命中规则：完全同名，或路径以「该路径 + /」开头 = 目录整清）。
 * 键形制 = 'bz-sim:' + vault 相对路径（与各域 fake-obsidian 的 LS_PREFIX 同值）。
 *
 * 用途：壳的「空册」档要求域自己的空态露出来——先照常种子，再用它收口，
 * 这样切回「有内容」时把标记删掉就能重新种（不必让用户手点重置）。
 */
export function pvWipeVault(paths: string[]): void {
  const LS = 'bz-sim:';
  const STAT = 'bz-sim:__stat__';
  const hit = (p: string): boolean => paths.some((raw) => {
    const pre = raw.replace(/\/+$/, '');
    return p === pre || p.startsWith(`${pre}/`);
  });
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (!k || k === STAT || !k.startsWith(LS)) continue;
    if (hit(k.slice(LS.length))) doomed.push(k);
  }
  for (const k of doomed) localStorage.removeItem(k);
  try {
    const stats = JSON.parse(localStorage.getItem(STAT) || '{}') as Record<string, unknown>;
    for (const k of Object.keys(stats)) if (hit(k)) delete stats[k];
    localStorage.setItem(STAT, JSON.stringify(stats));
  } catch (e) {
    localStorage.setItem(STAT, '{}');
  }
}
