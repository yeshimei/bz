/**
 * clipbook 域 UI 测试辅助。
 */
import { setSettingsProvider, tryGetSettings } from '../../src/core/settings-provider';

/** 直接设剪藏目录（测试前置；默认 归档/网页剪藏）。
 *  C12 起剪藏目录以设置为唯一真理源（loader 每次扫描直读 clipDir()，M.dir 缓存已删）——
 *  本辅助改为改写设置项，其余设置键原样保留。 */
export function setClipDir(dir: string): void {
  const cur = (tryGetSettings() as any) || {};
  setSettingsProvider(() => ({ ...cur, articleDirectory: dir }) as any);
}
