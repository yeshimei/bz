/**
 * 共享测试工厂（全域扫描 2026-09 批次 E）：
 * 各测试文件的 makeApp 薄包装（= mockAppWithVault 直通）统一走这里。
 * 带域特定接线的复杂 app 工厂（diary 链接解析、encrypt setApp、smartcat workspace 接线等）
 * 保留域内本地实现——强行统一会造成参数爆炸（AGENTS 禁止过度抽象）。
 */
import { mockAppWithVault } from '../mock-vault';
import type { MockVault } from '../mock-vault';

export function makeApp(vault: MockVault) {
  return mockAppWithVault(vault);
}
