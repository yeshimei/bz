/**
 * clipbook 域 UI 测试辅助。
 */
import { M } from '../../src/clipbook/state';

/** 直接设剪藏目录（测试前置；默认 归档/网页剪藏） */
export function setClipDir(dir: string): void {
  M.dir = dir;
}
