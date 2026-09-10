/**
 * 保险库（password-vault）数据层单源收口（全域扫描 2026-09 批次 G）。
 *
 * 历史：ADR-0085 曾把数据管理迁入 encrypt（vault-data.ts），ADR-0109 拆回独立域时
 * 本文件「零改动零迁移」保留——两份平行实现自此开始漂移（encrypt 侧后来独立演进出
 * E1 写事务回滚，本文件停留在合并前版本，save 失败会残留半改态）。
 *
 * 收口：本文件降级为 encrypt/vault-data.ts（超集版）的 re-export 壳：
 *  - 数据协议（SafeNote kind=password-vault、PASSWORD_VAULT_CHANNEL/ENCRYPT_CHANGED_CHANNEL、
 *    source 跳过自重载）两侧原本逐字一致，收口后事件流与读写行为不变；
 *  - encrypt 版构造器必选注入 SafeManager（ADR-0085），pv 侧构造点 ui.ts 显式传
 *    getSafeManager()，消除原先经 encrypt barrel 的隐式默认依赖；
 *  - 双域 UI 各自实例、同库共存的拍板态（ADR-0109）不变——只收数据层代码，不并 UI。
 */
export {
  PASSWORD_VAULT_CHANNEL,
  ENCRYPT_CHANGED_CHANNEL,
  PasswordVaultDataManager,
} from '../encrypt/vault-data';
export type { PasswordVaultEntry, PlatformGroup } from '../encrypt/vault-data';
