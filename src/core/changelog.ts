/**
 * changelog 机制（Q3.js 移植）：CHANGELOGS 8 identifier + 弹窗渲染。
 * localStorage 已读版本：`changelog_<id>_shown_version`。
 */
import { escManager } from './esc-manager';

/** CHANGELOGS：8 个 identifier（memo/article/luhmann/library/movie/belongings/diary/password-manager） */
export const CHANGELOGS: Record<string, { latestVersion: string; name: string; entries: Record<string, string> }> = {
  memo: {
    latestVersion: '1.6.0',
    name: '备忘录',
    entries: {
      '1.6.0': `
- 新增：备忘录支持设置截止日期，卡片上显示到期状态
- 新增：已过期（红色）和今日到期（橙色）的备忘录自动置顶
- 改进：启动时和打开笔记时，到期/过期的备忘录也会触发提醒
`,
      '1.5.0': `
- 新增：长按 #标签 直接编辑备忘录全部信息（内容、场景、优先级等）
- 改进：公开课场景下标签显示更清爽，不再重复
- 修复：编辑备忘录时不再丢失创建时间和归档状态
`,
      '1.4.0': `
- 新增：支持公开课场景，输入课程名时自动补全影视公开课列表
- 新增：列表中的公开课条目可一键跳转至对应的影视笔记
`,
      '1.3.0': `
- 新增：长按日期安全删除条目，防止误触
- 新增：备忘录内容支持选中复制
- 新增：文件重命名或移动时，所有关联备忘录的链接自动同步更新
`,
      '1.2.1': `
- 改进：输入框智能推荐已有脚本名，使用更顺手
- 改进：切换场景时保留已输入内容，不会丢失
- 修复：更新日志和删除弹窗的文字显示更完整，不溢出
`,
      '1.2.0': `
- 新增：代码场景，支持记录脚本名，列表图标显示更直观
- 新增：脚本名输入时智能推荐已有名称
`,
      '1.1.1': `
- 改进：智能笔记关联提醒不再反复弹窗，每个会话仅提醒一次
- 优化：从列表跳转笔记时不再触发重复提醒
`,
      '1.1.0': `
- 新增：一键切换显示/隐藏已完成条目
- 新增：打开笔记时自动弹出关联的重要备忘录提醒
- 新增：首次打开时展示版本更新日记
`,
      '1.0.0': `
- 新增：创建、归档、删除备忘录
- 新增：场景分类与优先级标记
- 新增：粘贴链接时自动获取网页标题
- 新增：笔记内支持位置链接跳转
`,
    },
  },
  article: {
    latestVersion: '1.0.0',
    name: '网页剪藏',
    entries: {
      '1.0.0': `
- 新增：文章列表弹窗，支持按站点筛选和关键词搜索
- 新增：滚动到底部自动加载更多文章
- 新增：双击卡片直接跳转笔记，长按日期安全删除
- 新增：显示引用笔记名称，点击一键跳转
- 新增：自动获取并缓存网站图标，列表辨识度更高
- 新增：一键刷新列表，目录文件变更时自动更新
- 新增：支持 ESC 键和点击遮罩关闭弹窗
- 改进：站点标签按文章数量排序，移动端适配更友好
- 改进：搜索同时匹配标题、摘要、作者、标签和站点
`,
    },
  },
  luhmann: {
    latestVersion: '1.0.0',
    name: '卢曼卡片笔记',
    entries: {
      '1.0.0': `
- 新增：从文件夹加载卡片文件，自动解析层级结构
- 新增：力导向图展示卡片关系，节点大小随文字自动调整
- 新增：连线显示子节点标签，一目了然
- 新增：悬停高亮祖先（蓝色）与子孙（橙色）节点
- 新增：单击固定高亮关联节点，再次点击取消
- 新增：Ctrl+单击在右侧分屏打开对应笔记
- 新增：键盘 F 键聚焦高亮区域，H 键切换仅显示高亮
- 新增：节点支持拖拽，画布可缩放平移
- 新增：顶部下拉菜单切换不同索引文件
- 新增：窗口缩放时自动重新布局
`,
    },
  },
  library: {
    latestVersion: '1.0.0',
    name: '书库',
    entries: {
      '1.0.0': `
- 新增：读取带书籍标签的笔记，解析封面、作者、状态等元数据
- 新增：卡片列表展示书籍，包含封面、进度、评分与书评
- 新增：按分类和阅读状态筛选，支持多维度排序
- 新增：顶部工具栏支持刷新、打开阅读报告及筛选排序
- 新增：单击封面或标题打开读书笔记模态框
- 新增：笔记中双击高亮跳转原文，长按编辑批注或删除高亮
- 新增：设置面板自由切换显示文件大小、阅读时长等信息
`,
    },
  },
  movie: {
    latestVersion: '1.0.0',
    name: '影视',
    entries: {
      '1.0.0': `
- 新增：读取影视笔记，解析评分、状态、观影日期及影评
- 新增：卡片展示名称、类型标签（彩色）、星级、相对时间与影评
- 新增：按类型（电影/剧集等细分）和状态（想/在/已看）筛选
- 新增：按日期、评分、名称升降序排序
- 新增：添加影视对话框，支持类型、状态、季集、评分等录入
- 新增：点击状态标签直接编辑影视信息
- 新增：一键刷新数据，分页滚动加载更多
- 新增：自动整理海报图片至配置文件夹
- 新增：设置面板配置文件夹路径与每页加载数量
- 改进：类型标签四类颜色自适应深浅主题，观影日期显示相对时间
`,
    },
  },
  belongings: {
    latestVersion: '1.0.0',
    name: '归物本',
    entries: {
      '1.0.0': `
- 新增：个人物品管理系统，数据存储于 JSON 文件
- 新增：内置丰富默认分类，支持用户自定义追加
- 新增：卡片展示物品名称、分类图标、价格、日均成本与使用天数
- 新增：按状态（使用中/闲置等）分组展示，统计一目了然
- 新增：顶部统计总资产和日均总成本
- 新增：单击卡片编辑，长按卡片删除（防误触）
- 新增：按名称、价格、日期、状态排序
- 新增：添加物品对话框，分类支持搜索下拉
- 新增：数据自动保存，适配深浅色主题
`,
    },
  },
  diary: {
    latestVersion: '1.0.0',
    name: '日记本',
    entries: {
      '1.0.0': `
- 新增：读取日记及影视/信目录文件，按时间线展示
- 新增：卡片渲染 Markdown 内容，双击跳转原文，长按复制双链
- 新增：主标签与二级标签筛选（带 Emoji），点击聚焦并显示计数
- 新增：点击标题弹出年份/月份选择器，快速筛选特定日期
- 新增：按正文、标签、时间多字段搜索
- 新增：添加日记弹窗（自然语言日期、标签多选），自动保存刷新
- 新增：点击 Emoji 弹出标签编辑器，多选修改自动更新文件
- 新增：长按日期删除日记，分页无限滚动加载
- 新增：文件变更自动刷新列表（可配置延迟）
- 新增：写摘抄命令，选中文本快速生成带双链的日记条目
- 新增：设置面板可配置目录、加载数量、长按时长等
- 改进：多主题适配，移动端布局优化
`,
    },
  },
  'password-manager': {
    latestVersion: '1.0.0',
    name: '密码管理器',
    entries: {
      '1.0.0': `
- 新增：AES-GCM 加密存储，主密码不落盘，确保数据安全
- 新增：首次设置主密码，解锁后使用；支持安全模式自动上锁
- 新增：添加、编辑、删除密码条目（平台/链接/账号/密码/备注）
- 新增：添加时自动生成强密码，支持手动刷新
- 新增：卡片列表展示，账号密码支持一键复制
- 新增：密码旁"👁"切换明文/掩码显示
- 新增：平台名含链接时自动变为可点击跳转
- 新增：按平台、账号、备注实时搜索过滤
- 新增：输入框智能推荐已有内容（按频次排序）
- 新增：长按日期删除，长按备注或密码快速编辑
- 新增：数据自动保存至指定加密文件
- 新增：ESC 键逐层关闭弹窗，移动端适配
- 新增：命令面板集成，一键打开管理器或添加条目
- 改进：卡片式设计，完美适配深浅色主题
`,
    },
  },
};

/** compareVersions：'1.6.0' vs '1.5.0' → 1/-1/0 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 !== num2) return num1 > num2 ? 1 : -1;
  }
  return 0;
}

/**
 * getChangelogContent(identifier, shownVersion)：完整更新日志 HTML（折叠 div 结构）。
 * shownVersion 为 null 时只展开最新版本；否则展开高于已读版本的全部版本。
 */
export function getChangelogContent(identifier: string, shownVersion: string | null): string | null {
  const data = CHANGELOGS[identifier];
  if (!data) return null;
  const entries = data.entries;
  const versions = Object.keys(entries).sort((a, b) => compareVersions(b, a)); // 降序

  // 计算需要展开的版本集合
  const expandSet = new Set<string>();
  if (shownVersion) {
    versions.forEach((v) => {
      if (compareVersions(v, shownVersion) > 0) {
        expandSet.add(v);
      }
    });
  }
  // 至少展开最新版本（即第一个）
  if (expandSet.size === 0) {
    expandSet.add(versions[0]);
  }

  let html = '';
  versions.forEach((version) => {
    const isExpanded = expandSet.has(version);
    const content = entries[version];
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    const itemsHtml = lines.map((line) => line.trim()).join('<br>');
    const displayStyle = isExpanded ? '' : 'display:none;';
    html += `
            <div class="changelog-version" style="margin-bottom:8px;border-bottom:1px solid var(--background-modifier-border);padding-bottom:6px;">
                <div class="changelog-version-title" style="cursor:pointer;font-weight:bold;font-size:16px;color:var(--text-normal);display:flex;align-items:center;gap:6px;" data-version="${version}">
                    v${version}
                </div>
                <div class="changelog-version-content" style="padding:5px 0px 10px 20px;margin-top:4px;font-size:14px;color:var(--text-muted);line-height:1.6;${displayStyle}">
                    ${itemsHtml}
                </div>
            </div>
        `;
  });
  return html;
}

/** displayChangelog(identifier)：直接显示更新日志弹窗（不检查版本） */
export function displayChangelog(identifier: string): void {
  const data = CHANGELOGS[identifier];
  if (!data) {
    console.warn(`未找到标识符为 "${identifier}" 的更新日志`);
    return;
  }
  const storageKey = `changelog_${identifier}_shown_version`;
  const shownVersion = localStorage.getItem(storageKey);
  const content = getChangelogContent(identifier, shownVersion);
  if (!content) {
    console.warn(`标识符 "${identifier}" 的更新日志内容为空`);
    return;
  }
  showChangelogModal(content, data.name || identifier);
}

/** checkAndShowChangelog(identifier, currentVersion?)：仅在版本更新时弹出，并记录已读版本 */
export function checkAndShowChangelog(identifier: string, currentVersion?: string): void {
  const data = CHANGELOGS[identifier];
  if (!data) return;
  const storageKey = `changelog_${identifier}_shown_version`;
  const shownVersion = localStorage.getItem(storageKey);
  const latest = currentVersion || data.latestVersion;
  if (shownVersion !== latest) {
    const content = getChangelogContent(identifier, shownVersion);
    if (content) {
      showChangelogModal(content, data.name || identifier);
    }
  }
  localStorage.setItem(storageKey, latest);
}

/** showChangelogModal(content, name)：内部弹窗渲染（折叠交互 + 右上角关闭 + 遮罩点击关闭 + ESC） */
function showChangelogModal(content: string, name: string): void {
  const mask = document.createElement('div');
  mask.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10005;display:flex;align-items:center;justify-content:center;';
  const popup = document.createElement('div');
  popup.style.cssText =
    'background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:600px;width:90%;max-height:80vh;display:flex;flex-direction:column;';

  // 标题栏（含关闭按钮）
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
  const title = document.createElement('h4');
  title.textContent = `${name}的更新日记`;
  title.style.cssText = 'margin:0;font-size:18px;font-weight:600;color:var(--text-normal);';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '❌️';
  closeBtn.style.cssText =
    'background:none;border:none;font-size:14px;line-height:1;cursor:pointer;color:var(--text-muted);padding:0 4px;box-shadow:none;';
  closeBtn.onclick = () => mask.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  // 日志内容（可滚动）
  const body = document.createElement('div');
  body.innerHTML = content;
  body.style.cssText =
    'flex:1;overflow-y:auto;text-align:left;font-size:14px;color:var(--text-muted);line-height:1.6;word-wrap:break-word;padding-right:4px;';
  popup.appendChild(body);

  mask.appendChild(popup);
  document.body.appendChild(mask);
  escManager.register('q3-changelog', {
    isVisible: function () { return mask.isConnected; },
    close: function () { mask.remove(); },
  });

  // 点击遮罩关闭
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });

  // 绑定折叠展开事件
  body.querySelectorAll('.changelog-version-title').forEach((titleEl) => {
    titleEl.addEventListener('click', function (this: HTMLElement) {
      const versionDiv = this.closest('.changelog-version')!;
      const contentDiv = versionDiv.querySelector('.changelog-version-content') as HTMLElement;
      if (contentDiv.style.display === 'none') {
        contentDiv.style.display = 'block';
      } else {
        contentDiv.style.display = 'none';
      }
    });
  });
}
