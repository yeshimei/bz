/**
 * 内容首页（home 域）域清单（兼容壳）：值与类型已收编渲染纯层共享层
 * （./shared，ADR-0104 markup 单源），本文件仅 re-export 保旧引用路径不变
 * （tests/recap、tests/home、review-fix-b 等消费方零改）。
 */
export { DOMAINS, DOMAIN_MAP, DOMAIN_DOT, ALL_DOMAIN_IDS } from './shared';
export type { HomeDomain } from './shared';
