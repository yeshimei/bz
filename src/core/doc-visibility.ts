/* ============================================================
 * bz · 文档类入口的显隐开关（core/doc-visibility.ts，2026-11-02）
 *
 * 为什么有这份文件：更新日志已经**全部内置进插件**（core/changelog-data，更新提示与
 * 设置页共用那一份），在线资源里再挂一份远端 html 就是「同一件事两个源，迟早对不上」；
 * 使用手册被视频教程取代（2026-11-02 用户拍板）。用户的要求是**只隐藏、不删功能**：
 * 入口撤掉、下载停掉、自动更新不再碰它们，但整条链路（下载器 / 弹窗 / 清单条目 /
 * 单测）原样留着——以后想恢复，把下面的开关翻回 true 就行，不用去翻 git 历史。
 *
 * 生效范围（改开关前先确认这七处，别只改一半）：
 *   ① 设置页「在线资源」组        settings-panel/online-resources.ts
 *   ② 首次引导的「在线资源」段    core/setup-wizard.ts（resourceDocsOf）
 *   ③ 首次引导的补齐队列          core/setup-wizard.ts（buildSetupTasks 的文档段）
 *   ④ 启动后台自动更新            core/auto-assets.ts
 *   ⑤ 更新插件后的「同更日志」    core/self-update.ts（refreshChangelog）
 *   ⑥ 设置页左下角「文档」组      settings-panel/layouts/jingwei/render.ts
 *   ⑦ 设置页搜索命中的名目        settings-panel/ui.ts（docEntryNames，手册藏了就别再被搜出来）
 *
 * 为什么是可变对象而不是 const 常量：单测要验「开关打开时行为不变」（这是「功能没删」
 * 的凭据），得能临时翻回去。生产代码只读，不写。
 * ============================================================ */

export const DOC_VISIBILITY = {
  /** 更新日志是否还列进「在线资源」/ 引导页 / 自动更新。侧栏「文档」组那条入口不受影响
   *  ——它打开的是内置数据的弹窗，不下载任何东西。 */
  changelogInResources: false,
  /** 使用手册是否还列进「在线资源」/ 引导页 / 自动更新 */
  manualInResources: false,
  /** 使用手册是否还挂在设置页「文档」组（桌面侧栏 + 移动列表） */
  manualInDocNav: false,
};

/** 清单 docs 里的这个条目还要不要出现在下载列表里（在线资源组 / 引导页 / 自动更新） */
export function docListedInResources(id: string): boolean {
  if (id === 'changelog') return DOC_VISIBILITY.changelogInResources;
  if (id === 'manual') return DOC_VISIBILITY.manualInResources;
  // 其余条目（分类表、源库、索引、外部工具包）不受这份开关管，一律照列
  return true;
}
