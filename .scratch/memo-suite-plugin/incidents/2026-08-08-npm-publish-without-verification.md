# 事故记录：脚本未运行验证即发布 npm 版本（2.1.0/2.1.1）

日期：2026-08-08
关联：ticket 21 海报抓取方案反转（ADR-0007）

## 时间线

1. **编辑失误**：重写 `cli.js` watch 分支时，替换范围起始行取错（从 `switch (command) {` 行开始），导致该行被覆盖删除，文件变成非法语法。
2. **测试漏网**：`npm test`（28 个测试）全绿——测试文件只 import `watcher.js`/`note-processor.js`/`douban-client.js`，**从未加载 cli.js**，语法错误未被发现。
3. **零运行验证发布**：未执行 `node --check cli.js`、未运行 `node cli.js` 冒烟，直接 `npm publish` 发出 **2.1.0**（语法损坏）。
4. **首次暴露**：用户机器 `douban-poster start` → `SyntaxError: Unexpected token 'case'`。
5. **修复不全**：补回 switch 行发 **2.1.1**——但 `watcher.js` 不在 `package.json` 的 `files` 白名单（files 只列了 5 个旧文件），打包时被排除；装上后 `ERR_MODULE_NOT_FOUND`。
6. **最终修复**：files 白名单补 `watcher.js` 发 **2.1.2**，全局安装 + `pm2 restart` 实测通过（队列抓取《是，大臣 第一季》成功）。

## 根因

- 发布流程缺少「先运行、后发布」的门禁：语法/打包问题全部要等到用户环境运行时才暴露
- `files` 白名单新增文件时未同步更新，且发布前未做 `npm pack --dry-run` 核对清单
- 测试覆盖面与 CLI 入口脱节（cli.js 是纯入口，无任何测试引用）

## 影响

- npm 上留下两个损坏版本（2.1.0 语法错误、2.1.1 缺文件），用户安装即报错
- 排查耗时两轮发布迭代

## 预防措施（已落实）

1. `npm test` 脚本加入语法门禁：`node --check cli.js && node --test test/*.test.js`
2. 发布 checklist（后续每次发版必须按序执行）：
   - [ ] `npm test`（含 cli.js 语法检查）
   - [ ] `node cli.js` 冒烟（至少输出帮助文本不报错）
   - [ ] `npm pack --dry-run` 核对打包清单（新增文件是否在 `files` 白名单）
   - [ ] 发布后 `npm install -g` + 实际运行一次（pm2 restart 或前台 watch）
