# 07 — 密码本

**What to build:** 密码管理器完整移植：主密码加密体系、条目管理、密码生成器、3 命令。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] 主密码机制：首次设置（含再次输入确认「请再次输入主密码确认」）、解锁流程（「请输入您设置的主密码以解锁密码本」）、主密码驱动全部数据加密
- [ ] 加密方案与 Q3 逐字一致（AES + btoa/atob）；未解锁拦截（「未解锁，无法加载数据/保存数据」）、解密失败提示（「数据解密失败，密码可能错误」）
- [ ] 条目 CRUD（7 字段：id/platform/url/account/password/note/createdAt）+ 搜索 + 👁 显示切换 + 复制
- [ ] 密码生成器：passwordCharset（🔤 输入）/passwordLength（🔢 输入）/securityMode（🔒 开关）设置；添加弹窗内生成按钮
- [ ] 命令 `pw-open-manager`/`pw-add-entry`/`pw-generate-password` 裸注册
- [ ] 移动端媒体查询适配
- [ ] 测试：主密码流程状态机、加密/解密往返、生成器
