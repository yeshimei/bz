# 02 — core 工具层（Q3 21 工具移植）

**What to build:** Q3.js 挂载于 `window.__utils` 的 21 个工具完整移植为 `src/core/` 内部模块（不挂 window），行为与 Q3 逐字一致——全部后续域的共同底座。

**Blocked by:** 01（插件骨架）

**Status:** ready-for-agent

- [ ] escManager：register(id, layer{isVisible,close}) → unregister；Escape 从栈顶找可见层关闭
- [ ] confirm：{title,message,onConfirm,onCancel,confirmText,cancelText}，`__shared_confirm_mask__` id、z-index 10003、点击遮罩取消
- [ ] jsonStore：read（不存在→建目录建文件返回 []；解析失败重置 []）、write（存在 modify/不存在 create）；无锁（与 Q3 一致）
- [ ] notice/generateId（prefix-时间戳-随机6位）/longPress(el,cb,dur,filter)/injectStyles(id,css) 幂等（data-shared-style）
- [ ] createIconBtn/createSiteIcon(domain,size=16)/formatFileSize/formatRelativeTime/getPlatformName(url,customMap)/extractUrlAndDisplay/getCurrentNoteInfo/getCurrentCursorPosition/fetchPageTitle/createOverlay({maskId,popupId,zIndex,onMaskClick})
- [ ] DEFAULT_PLATFORM_MAP 常量（知乎日报/知乎专栏/知乎/果壳/小黑盒/豆瓣/微信公众号 7 项）
- [ ] 测试覆盖全部工具（纯函数 + jsdom）
