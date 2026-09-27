# 492 脸谱缓存一致性三连修——自写抑制 / 导入失效重读 / 卸载统计快照

## 实案（2026-09-27 用户报）

- 徐雯静：数据源显示「已导 3,110 条」，同会话点画脸谱报「还没有可画的消息素材」，
  重启插件恢复。数据本身完好（store 3,110 条 / 头像在位，解密核实）。
- 解锁屏（482）统计卡冷启动恒「—」，用户误读为「没写入数据」。

## 根因

1. **头像重建同步广播清库**：`writeSerial` 的 removeNote→lockNote 重建会**同步**广播
   ENCRYPT_CHANGED，PeopleSafeStore 的订阅把全部明文缓存清掉——循环导入多人时，
   除第一位外每个人的记录被重新解密成**新对象**，面板 `recordCache` 攥着旧引用
   （导入前的空仓）→ 详情 / 画谱同会话读空。重启重建缓存才愈。
2. **导入后面板快照不失效**：`recordCache` 设计为面板会话级快照，写入本应经
   peopleSafe 缓存原地 mutate 同源跟新，但 1 的脱钩让它失信——置空重读兜底。
3. **卸载路径不拍锁屏统计快照**：`cleanup()` 不调 `captureLockStats`——解锁态下直接
   关 Obsidian / 重载插件，本次会话的统计从未落盘，下次解锁屏（482 people 档）恒「—」。

## 修复

- `src/people/safe-store.ts`：`suppressClear` 计数——本域写链（首建 lockNoteFresh /
  头像重建 removeNote→lockNote）期间 ENCRYPT_CHANGED 广播不清明文缓存；外部改动照清。
- `src/people/ui.ts`：`importDsSelected` 成功后 `recordCache = null` 失效重读（兜底）。
- `src/encrypt/ui.ts`：UIManager 新增公开 `captureForUnload()`（T12 同款解锁态守卫）；
  `EncryptAppController.cleanup()` 首行调用——卸载 / 重载前把锁屏统计快照落盘
  （四域都受益，482 people 档首次有冷启动数字）。

## 测试

- tests/people/safe-store.test.ts：甲头像重建广播后乙的缓存记录同对象、内容完整。
- tests/people/sync-button.test.ts：导入所选后直接点「画脸谱」，引擎拿到非空 msgs
  （492 实案回归，修复前此处读空仓）。
