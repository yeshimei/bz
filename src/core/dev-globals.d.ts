/**
 * 编译期开发旗标（ADR-0276 配套，esbuild define 注入）：
 * 仅当 `BZ_VAULT_DIR` 指向测试库（once / 开发 watch）时为 true；production 构建恒为 false。
 * false 时 esbuild 把所有 `if (__BZ_DEV__)` 分支整体 dead-code elimination——发布版零残留。
 */
declare const __BZ_DEV__: boolean;
