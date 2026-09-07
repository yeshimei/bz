/**
 * 设置面板域内原型 · 演示数据（prototype-data.js）
 * schema = 各域 xxxSettingsSchema() 的真实结构（与源码声明逐字对齐，2026-09-07 快照）；
 * 值 = 脱敏演示值（**非真实 data.json**——真实值含密钥不入 git；评审视觉足够）；
 * 目录树 = 真实 vault 结构的脱敏精选（文件夹选择器演示用）。
 * 消费端：prototype.app.js（演示渲染器）。
 */
(function () {
  'use strict';

  /* ---------- AI 提供商（源码注册表逐字） ---------- */
  const PROVIDERS = [
    { id: 'deepseek', label: 'DeepSeek', key: 'deepseekApiKey', desc: '留空则自动回退读取外部配置密钥' },
    { id: 'opencode-go', label: 'OpenCode Go', key: 'opencodeGoApiKey', desc: '在订阅官网获取后填入这里' },
    { id: 'openai', label: 'OpenAI', key: 'openaiApiKey', desc: '在 OpenAI 官网获取后填入这里' },
    { id: 'anthropic', label: 'Anthropic（Claude）', key: 'anthropicApiKey', desc: '在 Anthropic 官网获取后填入这里' },
    { id: 'google', label: 'Google Gemini', key: 'googleApiKey', desc: '在 Google AI Studio 获取后填入这里' },
    { id: 'moonshot', label: 'Moonshot（Kimi）', key: 'moonshotApiKey', desc: '在 Moonshot 开放平台获取后填入这里' },
    { id: 'zhipu', label: '智谱（GLM）', key: 'zhipuApiKey', desc: '在智谱开放平台获取后填入这里' },
    { id: 'dashscope', label: '阿里云百炼（通义）', key: 'dashscopeApiKey', desc: '在阿里云百炼获取 API Key 后填入这里' },
    { id: 'siliconflow', label: '硅基流动', key: 'siliconflowApiKey', desc: '在硅基流动官网获取后填入这里' },
    { id: 'openrouter', label: 'OpenRouter', key: 'openrouterApiKey', desc: '在 OpenRouter 官网获取后填入这里' },
    { id: 'xai', label: 'xAI（Grok）', key: 'xaiApiKey', desc: '在 xAI 控制台获取后填入这里' },
    { id: 'groq', label: 'Groq', key: 'groqApiKey', desc: '在 Groq 控制台获取后填入这里' },
    { id: 'mistral', label: 'Mistral', key: 'mistralApiKey', desc: '在 Mistral 控制台获取后填入这里' },
    { id: 'together', label: 'Together AI', key: 'togetherApiKey', desc: '在 Together AI 官网获取后填入这里' },
    { id: 'ollama', label: 'Ollama（本地）', key: 'ollamaApiKey', desc: '本地服务无需密钥，留空即可' },
  ];

  const aiRows = [
    { t: 'select', n: 'AI 服务商', d: '切换服务商后显示对应的配置项', k: 'aiProvider',
      opts: PROVIDERS.map((p) => ({ v: p.id, l: p.label })).concat([{ v: 'custom', l: '自定义（OpenAI 兼容）' }]) },
  ];
  for (const p of PROVIDERS) {
    aiRows.push({ t: 'text', n: p.label.replace(/（.*）/, '') + '密钥', d: p.desc, k: p.key, ph: 'sk-…', vis: { eq: ['aiProvider', p.id] } });
  }
  aiRows.push(
    { t: 'text', n: '自定义 API 地址', d: 'OpenAI 兼容服务的完整接口地址', k: 'aiCustomEndpoint', ph: 'https://api.example.com/v1', vis: { eq: ['aiProvider', 'custom'] } },
    { t: 'text', n: '自定义 API 密钥', d: '在服务官网获取后填入这里', k: 'aiCustomApiKey', ph: 'sk-…', vis: { eq: ['aiProvider', 'custom'] } },
    { t: 'text', n: '模型名称', d: '留空用该服务商默认模型', k: '__fn:aiModel', ph: '默认模型', btn: '获取模型名' },
    { t: 'number', n: '上下文窗口', d: '留空用该服务商默认窗口', k: '__fn:aiContext', ph: '默认窗口' },
    { t: 'number', n: '最大输出 token', d: '留空用该服务商默认上限', k: '__fn:aiMaxTokens', ph: '默认上限' }
  );

  /* ---------- 导航分组（四组） ---------- */
  const NAV = [
    { title: '基础', ids: ['global', 'appearance', 'ai'] },
    { title: '记录', ids: ['diary', 'diary-wall', 'todo', 'belongings', 'clipbook', 'favorites'] },
    { title: '媒体与知识', ids: ['cinema', 'bookshelf', 'review', 'secondbrain', 'literature'] },
    { title: '工具', ids: ['pomodoro', 'encrypt', 'smartcat'] },
  ];

  /* ---------- 16 域 schema ---------- */
  const DOMAINS = {
    global: { name: '通用', icon: 'settings', desc: '存储路径等跨域基础偏好', groups: [
      { icon: 'folder-open', name: '数据存储路径', rows: [
        { t: 'path', mode: 'single', n: '数据存储路径', d: '全部 JSON 数据文件统一存放的目录', k: 'storagePath', note: '改动仅改路径不迁移旧数据；重载插件后生效' },
        { t: 'button', n: '数据体检', d: '检查各域数据文件能否解析、字段漂移与孤儿条目（只读体检，可修复项一键清理）', btn: '打开体检', cta: true, demo: 'checkup' },
      ] },
    ] },
    appearance: { name: '设置', icon: 'palette', desc: '设置面板的布局与主题', groups: [
      { icon: 'palette', name: '外观', rows: [
        // 每个布局配套唯一主题（参考待办 todoSkin：纸感手账/编辑部各对应一个主题）——点布局即切配套主题
        { t: 'choiceCards', n: '布局', k: 'settingsPanelLayout', kind: 'layout', opts: [
          { v: 'jingwei', l: '经纬', prev: { mode: 'system' }, theme: 'chenhun' },
        ] },
        // 主题与布局一一对应：随布局自动切换（此处卡片同步高亮当前配套主题）
        { t: 'choiceCards', n: '主题', k: 'settingsPanelSkin', kind: 'skin', opts: [
          { v: 'chenhun', l: '晨昏', prev: { bg: 'transparent' } },
        ] },
      ] },
    ] },
    ai: { name: 'AI', icon: 'sparkles', desc: 'AI 服务商与模型配置', groups: [
      { icon: 'sparkles', name: 'AI', rows: aiRows },
      { icon: 'sliders-horizontal', name: '采样参数', rows: [
        { t: 'text', n: '采样温度', d: '采样温度，留空用 API 默认', k: 'aiTemperature', ph: 'API 默认', num: true },
        { t: 'text', n: '核采样上限', d: '核采样概率上限，留空用 API 默认', k: 'aiTopP', ph: 'API 默认', num: true },
        { t: 'text', n: '频率惩罚', d: '降低重复内容的倾向，留空用 API 默认', k: 'aiFrequencyPenalty', ph: 'API 默认', num: true },
        { t: 'text', n: '存在惩罚', d: '鼓励引入新内容的倾向，留空用 API 默认', k: 'aiPresencePenalty', ph: 'API 默认', num: true },
      ] },
    ] },
    diary: { name: '日记本', icon: 'notebook-pen', desc: '日记目录、显示与默认视图', groups: [
      { icon: 'folder-open', name: '目录', rows: [
        { t: 'path', mode: 'single', n: '日记目录', d: '存放日记文件的文件夹路径', k: 'diaryDirectory' },
        { t: 'path', mode: 'single', n: '影视目录', d: '日记与回忆墙归类用的影视文件夹，与影院设置的影视文件夹相互独立', k: 'movieDirectory' },
        { t: 'path', mode: 'single', n: '信件目录', d: '存放信件的文件夹路径', k: 'letterDirectory' },
        { t: 'number', n: '每批加载数量', d: '滚动加载时每批显示的条目数', k: 'diaryBatchSize', min: 1, step: 1 },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'toggle', n: '显示标签计数', d: '在标签按钮上显示该标签包含的条目数量', k: 'showTagCount' },
        { t: 'toggle', n: '默认日期取自文件', d: '添加日记时默认日期取自当前打开的日记文件，否则用当前时间', k: 'useFileDateTime' },
        { t: 'toggle', n: '标签按钮显示表情', d: '筛选栏与写日记弹窗的标签按钮显示表情，关闭则显示文字', k: 'diaryTagShowEmoji' },
        { t: 'select', n: '卡片内容渲染方式', d: '日记卡片内容按格式渲染或纯文本显示', k: 'diaryContentRenderMode', opts: [{ v: 'markdown', l: 'Markdown' }, { v: 'plain', l: '纯文本' }] },
        { t: 'select', n: '标签排序', d: '筛选栏主标签按内置配置顺序或条目数量排序', k: 'diaryTagSortMode', opts: [{ v: 'fixed', l: '按固定顺序' }, { v: 'count', l: '按条目数量' }] },
      ] },
      { icon: 'monitor', name: '默认视图', rows: [
        { t: 'select', n: '面板默认日期筛选', d: '打开日记本面板时默认的日期范围', k: 'diaryDefaultDateFilter', opts: [{ v: 'all', l: '全部' }, { v: 'this-month', l: '本月' }] },
        { t: 'select', n: '默认选中标签', d: '打开面板时默认选中的主标签', k: 'diaryDefaultSelectedTag', opts: [{ v: '', l: '全部' }, { v: '日记', l: '日记' }, { v: '信件', l: '信件' }] },
        { t: 'toggle', n: '保存后进入编辑', d: '保存日记后直接进入编辑模式', k: 'diaryJumpToEditAfterSave' },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'diaryMobileDefaultFullscreen' },
      ] },
      { icon: 'wrench', name: '维护', rows: [
        { t: 'button', n: '日记解析检测', d: '扫描所有日记文件，定位未能解析的行，可一键修复标题格式问题', btn: '检测日记解析', cta: true, demo: 'diaryRepair' },
      ] },
    ] },
    'diary-wall': { name: '回忆墙', icon: 'images', desc: '回忆墙媒体视图（只读）', desktopZero: true, groups: [
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'diaryWallMobileDefaultFullscreen' },
      ] },
    ] },
    todo: { name: '待办', icon: 'check-square', desc: '待办工作台与提醒（捕获入口落点）', groups: [
      // 外观组与「设置」域同构：上布局行下主题行，点布局自动切配套主题
      { icon: 'palette', name: '外观', rows: [
        { t: 'choiceCards', n: '布局', k: 'todoSkin', kind: 'todo', opts: [
          { v: 'paper', l: '纸感手账', prev: { bg: '#f6f1e3', ink: '#5b4a36', ac: '#c95a28', head: 'stripe' }, theme: 'warmwhite' },
          { v: 'editorial', l: '编辑部', prev: { bg: '#fdfdfb', ink: '#1d1d1f', ac: '#b3402a', head: 'plain' }, theme: 'inkwhite' },
        ] },
        // 布局各带一套主题（不通用）：主题行按当前布局过滤成单卡，主题预览自带明暗
        { t: 'choiceCards', n: '主题', k: 'todoSkinTheme', kind: 'skin', layoutKey: 'todoSkin', opts: [
          { v: 'warmwhite', l: '暖白', layout: 'paper', prev: { light: '#f6f1e3', dark: '#2a241c', ac: '#c95a28' } },
          { v: 'inkwhite', l: '墨白', layout: 'editorial', prev: { light: '#fdfdfb', dark: '#1d1d1f', ac: '#b3402a' } },
        ] },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'select', n: '默认排序方式', d: '面板条目按所选规则排序', k: 'memoSortMode', opts: [{ v: 'priority', l: '紧急优先' }, { v: 'due', l: '仅按到期时间' }, { v: 'created', l: '按创建时间' }] },
        { t: 'toggle', n: '默认显示已完成', d: '打开面板时同时展开已完成折叠区', k: 'memoShowArchivedByDefault' },
        { t: 'select', n: '到期时间格式', d: '到期时间按相对或绝对格式显示', k: 'memoDueFormat', opts: [{ v: 'relative', l: '相对' }, { v: 'absolute', l: '绝对' }] },
      ] },
      { icon: 'pencil-line', name: '新建', rows: [
        { t: 'select', n: '新条目默认优先级', d: '新建待办时默认选中的优先级', k: 'memoDefaultPriority', opts: [{ v: 'minor', l: '次要' }, { v: 'important', l: '重要' }] },
        { t: 'select', n: '新条目默认场景', d: '新建待办时默认选用的场景', k: 'memoDefaultScene', opts: [{ v: '', l: '第一个场景' }, { v: '剪藏', l: '剪藏' }, { v: '工作', l: '工作' }, { v: '代码', l: '代码' }] },
      ] },
      { icon: 'tags', name: '场景列表', rows: [
        { t: 'textarea', n: '自定义场景列表', d: '场景名用逗号分隔，留空使用默认场景（与备忘录共用）', k: 'memoScenarios', ph: '剪藏,工作,学习,生活,代码,公开课' },
      ] },
      { icon: 'bell', name: '提醒', rows: [
        { t: 'toggle', n: '启动时自动弹出', d: '启动时若有重要或到期未完成的待办，自动打开待办面板提醒', k: 'autoPopupOnStart' },
        { t: 'toggle', n: '打开笔记自动提醒', d: '打开笔记时若笔记有重要或到期的未完成待办，自动打开待办面板并定位到关联待办', k: 'openNoteReminder' },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'todoMobileDefaultFullscreen' },
      ] },
    ] },
    belongings: { name: '归物本', icon: 'package', desc: '物品登记与查找', groups: [
      // 外观组与待办同构（上布局行下主题行，点布局自动切配套主题）；占位单卡（用户拍板 C）：
      // 布局/主题各一档零新设计，扩展待将来开模
      { icon: 'palette', name: '外观', rows: [
        { t: 'choiceCards', n: '布局', k: 'belSkin', kind: 'poster', opts: [
          { v: 'poster', l: '大字报', prev: { bg: '#f5f2ec', ink: '#171512', ac: '#e8481f' }, theme: 'warmwhite' },
        ] },
        { t: 'choiceCards', n: '主题', k: 'belSkinTheme', kind: 'skin', layoutKey: 'belSkin', opts: [
          { v: 'warmwhite', l: '暖白', layout: 'poster', prev: { light: '#f5f2ec', dark: '#171512', ac: '#e8481f' } },
        ] },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'select', n: '默认状态筛选', d: '打开面板时选中的物品状态', k: 'belongingsDefaultStatus', opts: [{ v: '', l: '全部' }, { v: 'using', l: '使用中' }, { v: 'idle', l: '闲置' }, { v: 'sold', l: '已转卖' }, { v: 'discard', l: '已丢弃' }] },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'belongingsMobileDefaultFullscreen' },
      ] },
    ] },
    clipbook: { name: '剪藏本', icon: 'scissors', desc: '未读流与剪藏笔记', groups: [
      { icon: 'folder-open', name: '基础', rows: [
        { t: 'path', mode: 'single', n: '剪藏目录', d: '存放网页剪藏文章的文件夹', k: 'articleDirectory' },
        { t: 'number', n: '面板宽度记忆', d: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', k: 'clipbookPanelWidth', min: 0, step: 10 },
        { t: 'number', n: '面板高度记忆', d: '桌面拖拽面板边缘缩放后自动记忆，0 为未拖过', k: 'clipbookPanelHeight', min: 0, step: 10 },
        { t: 'number', n: '目录栏宽度记忆', d: '拖动目录与阅读分隔线后自动记忆，0 为未拖过', k: 'clipbookMidWidth', min: 0, step: 10 },
      ] },
      { icon: 'sparkles', name: '智能', rows: [
        { t: 'toggle', n: '自动摘要', d: '新剪藏的文章自动生成 AI 摘要', k: 'autoSummaryEnabled' },
        { t: 'select', n: '摘要长度', d: '控制生成的摘要详略程度', k: 'autoSummaryLength', child: true, opts: [{ v: 'simple', l: '简短（50-100 字）' }, { v: 'standard', l: '标准（150-250 字）' }, { v: 'detailed', l: '详细（300-400 字）' }] },
        { t: 'toggle', n: '生成标签', d: '为剪藏生成中文标签', k: 'autoSummaryTagsEnabled', child: true },
        { t: 'text', n: '标签数量', d: '生成的标签个数写成区间，如 3-6', k: 'autoSummaryTagCount', child: true, vis: { and: [{ eq: ['autoSummaryEnabled', true] }, { eq: ['autoSummaryTagsEnabled', true] }] } },
        { t: 'select', n: '摘要时机', d: '保存后立刻生成，或仅打开文件时才补全', k: 'autoSummaryTiming', child: true, opts: [{ v: 'immediate', l: '保存后立刻' }, { v: 'lazy', l: '懒触发（打开时）' }] },
      ] },
      { icon: 'radio', name: '数据源', rows: [
        { t: 'custom', n: '新闻数据源', custom: 'newsSources' },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'clipbookMobileDefaultFullscreen' },
      ] },
    ] },
    favorites: { name: '收藏本', icon: 'star', desc: '收藏条目', desktopZero: true, groups: [
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'favoritesMobileDefaultFullscreen' },
      ] },
    ] },
    cinema: { name: '影院', icon: 'clapperboard', desc: '影视目录与海报', groups: [
      { icon: 'folder-open', name: '目录', rows: [
        { t: 'path', mode: 'single', n: '影视文件夹', d: '影院读取的影视文件夹，日记本设置的影视目录仅用于归类', k: 'cinemaFolderPath' },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'select', n: '默认排序', d: '打开面板时列表按所选规则排序', k: 'cinemaSortMode', opts: [{ v: 'date', l: '最近观看' }, { v: 'created', l: '按创建时间' }, { v: 'rating', l: '按评分' }] },
        { t: 'select', n: '默认状态筛选', d: '打开面板时选中的状态筛选', k: 'cinemaStatusFilter', opts: [{ v: '', l: '全部' }, { v: '想看', l: '想看' }, { v: '在看', l: '在看' }, { v: '已看', l: '已看' }] },
        { t: 'number', n: '网格每行列数', d: '海报网格每一行的列数，范围 2 到 12，重开面板生效', k: 'cinemaGridColumns', min: 2, max: 12, step: 1 },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'cinemaMobileDefaultFullscreen' },
      ] },
    ] },
    bookshelf: { name: '书库', icon: 'book-open', desc: '藏书封面墙', groups: [
      { icon: 'folder-open', name: '目录', rows: [
        { t: 'path', mode: 'single', n: '书库文件夹', d: '存放书籍笔记的文件夹，留空用 vault 根下的「书库」', k: 'bookshelfFolderPath' },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'choiceCards', n: '面板皮肤', k: 'bookshelfSkin', kind: 'shelf', opts: [
          { v: 'nordic', l: '雪松白', prev: { bg: '#eef0ee', ink: '#44514a', ac: '#7da192', books: ['#8fae9f', '#c2d4c8', '#5d7268'] } },
          { v: 'dark', l: '暗木书房', prev: { bg: '#3d3126', ink: '#d8c9b4', ac: '#c99a5b', books: ['#8a6a45', '#5d452f', '#a9865d'] } },
          { v: 'noir', l: '黑金夜曲', prev: { bg: '#1d1a16', ink: '#d9c9a3', ac: '#d4af37', books: ['#8a7648', '#3a342a', '#b8a05e'] } },
          { v: 'wabi', l: '侘寂素麻', prev: { bg: '#d9d2c4', ink: '#6b6152', ac: '#a08662', books: ['#b3a68e', '#8f8471', '#c9bda6'] } },
          { v: 'bauhaus', l: '包豪斯', prev: { bg: '#f2ede4', ink: '#1d1d1f', ac: '#d94f3d', books: ['#d94f3d', '#2b4a8a', '#e8b23a'] } },
          { v: 'blueprint', l: '工程蓝图', prev: { bg: '#2c4a6e', ink: '#cfe0f0', ac: '#8ec5e8', books: ['#4a7099', '#365f8a', '#6e93b8'] } },
          { v: 'neon', l: '霓虹夜馆', prev: { bg: '#241a33', ink: '#e0ccf0', ac: '#b46ee8', books: ['#6e3a99', '#3d2b52', '#8a5ac0'] } },
          { v: 'kraft', l: '牛皮手帐', prev: { bg: '#b58a5a', ink: '#4a3420', ac: '#7a5230', books: ['#8a6a42', '#6b4e2e', '#a08050'] } },
          { v: 'velvet', l: '丝绒剧院', prev: { bg: '#4a1f2b', ink: '#e0c2cc', ac: '#c98a9e', books: ['#6e2a3d', '#8a3a52', '#5a2434'] } },
          { v: 'mono', l: '极简黑白', prev: { bg: '#f2f2f2', ink: '#1d1d1d', ac: '#1d1d1d', books: ['#3a3a3a', '#8a8a8a', '#c0c0c0'] } },
        ] },
        { t: 'select', n: '默认筛选', d: '打开面板时侧栏选中的状态', k: 'bookshelfDefaultSide', opts: [{ v: 'all', l: '全部' }, { v: 'reading', l: '在读' }, { v: 'unread', l: '未读' }, { v: 'done', l: '已读' }] },
        { t: 'select', n: '默认排序', d: '打开面板时书脊按所选规则排序', k: 'bookshelfSortMode', opts: [{ v: 'recent', l: '最近读完' }, { v: 'time', l: '时长最长' }, { v: 'title', l: '书名' }] },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'bookshelfMobileDefaultFullscreen' },
      ] },
    ] },
    review: { name: '复习计划', icon: 'repeat-2', desc: '间隔重复与做题', groups: [
      { icon: 'bell', name: '检查提醒', rows: [
        { t: 'toggle', n: '到期提醒', d: '有笔记到期待复习时自动弹出提醒', k: 'enableAutoNotify' },
        { t: 'toggle', n: '新笔记加入提醒', d: '新笔记被自动加入时弹出提示，多条合并成一条', k: 'reviewAutoAddNotice' },
      ] },
      { icon: 'graduation-cap', name: '做题家', rows: [
        { t: 'toggle', n: '用做题测难度', d: '开始复习即做题，按正确率自动定难度', k: 'forceQuizForReview' },
        { t: 'toggle', n: '允许多选题', d: '开启后 AI 可能出多选题，关闭则只出单选题', k: 'enableMultipleChoice', child: true },
        { t: 'text', n: '每篇笔记出题数量', d: '固定每篇笔记出题的数量，留空/0=自动', k: 'questionsPerNote', child: true },
        { t: 'toggle', n: '打乱出题顺序', d: '做题时随机排列题目顺序', k: 'shuffleQuestions', child: true },
        { t: 'select', n: '出题难度', d: '控制 AI 出题深浅', k: 'difficulty', child: true, opts: [{ v: 'random', l: '随机' }, { v: 'easy', l: '简单' }, { v: 'medium', l: '中等' }, { v: 'hard', l: '困难' }] },
      ] },
      { icon: 'timer', name: '复习节奏', rows: [
        { t: 'number', n: '每日复习上限', d: '一轮最多复习的篇数，不填则不限制', k: 'reviewDailyLimit', min: 0 },
        { t: 'number', n: '复习间隔缩放', d: '数值越小复习越频繁，数值越大越宽松', k: 'reviewIntervalScale' },
        { t: 'number', n: 'R 目标阈值', d: '记忆保留度低于该值视为该复习了', k: 'reviewRThreshold', min: 0.5, max: 0.99 },
      ] },
      { icon: 'brain', name: '记忆算法', rows: [
        { t: 'toggle', n: '参数自动拟合', d: '按个人复习历史拟合记忆参数，优化复习节奏', k: 'reviewEnableFit' },
        { t: 'number', n: '每 N 次复习重算', d: '累计 N 次评级后自动重拟合一次', k: 'reviewFitEveryN', min: 1, child: true },
      ] },
      { icon: 'sliders-horizontal', name: '自动化', rows: [
        { t: 'path', mode: 'multi', n: '监听文件夹', d: '文件夹里的新笔记自动加入复习计划，包括子文件夹', k: 'reviewWatchedFolders' },
        { t: 'custom', n: '排除名单', d: '不参与监听自动加入的笔记，可在此单条解除', custom: 'excludedNotes' },
      ] },
      { icon: 'eye', name: '界面', rows: [
        { t: 'toggle', n: '文件树标记', d: '在文件树中为复习笔记着色并标到期时间', k: 'reviewTreeBadge' },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'reviewMobileDefaultFullscreen' },
      ] },
    ] },
    secondbrain: { name: '第二大脑', icon: 'brain', desc: '嵌入检索与对话', groups: [
      { icon: 'folder-open', name: '基础', rows: [
        { t: 'text', n: 'Ollama 本地 URL', k: 'secondBrainOllamaUrl' },
        { t: 'text', n: '远程 Ollama URL（移动端）', k: 'secondBrainRemoteOllamaUrl' },
        { t: 'custom', n: '本机局域网 IP（电脑）', custom: 'lanIp' },
        { t: 'text', n: 'Embedding 模型', k: 'secondBrainEmbeddingModel' },
        { t: 'path', mode: 'multi', n: '白名单目录', d: '纳入第二大脑检索与候选来源的笔记目录，留空则不索引', k: 'secondBrainAllowPaths' },
        { t: 'toggle', n: '启用', d: '仅控制启动时自动加载，关闭后仍可从命令面板手动打开', k: 'secondBrainEnabled' },
      ] },
      { icon: 'link', name: '自动双链', rows: [
        { t: 'toggle', n: '自动双链', d: '关联范围内新笔记落盘时自动建双链，候选近邻经 AI 裁判筛选', k: 'linkAgentEnabled' },
        { t: 'text', n: '单篇候选数量 TopK', d: '每篇笔记的近邻候选数，来源为白名单索引库的全部笔记', k: 'linkAgentTopK', child: true },
        { t: 'text', n: '每篇关联上限', d: '0 表示不限量，由 AI 裁判自行决定，沿用复习域惯例', k: 'linkAgentMaxLinks', child: true },
        { t: 'toggle', n: '完成通知', d: '处理完成后通知提醒，关闭则全程静默', k: 'linkAgentNotify', child: true },
        { t: 'toggle', n: '失效关联自动清理', d: '笔记删除后自动移除指向它的失效 related 条目', k: 'linkAgentAutoClean', child: true },
        { t: 'toggle', n: '已有关联不再建链', d: '笔记已有关联时自动跳过处理', k: 'linkAgentRespectRelated', child: true },
        { t: 'path', mode: 'multi', n: '关联范围', d: '决定哪些笔记会被自动关联，并作为落盘监听与补链目标', k: 'linkAgentScopes', child: true },
      ] },
      { icon: 'search', name: '检索', rows: [
        { t: 'text', n: '参考结果数 TopK', k: 'secondBrainTopK' },
        { t: 'text', n: '对话参考结果数', k: 'secondBrainChatTopK' },
        { t: 'text', n: '段落最小长度', k: 'secondBrainChunkMinLength' },
        { t: 'text', n: '上下文限制', k: 'secondBrainContextLimit' },
        { t: 'text', n: '防抖延迟毫秒', k: 'secondBrainDebounceDelay' },
        { t: 'text', n: '光标轮询毫秒', k: 'secondBrainCursorPollInterval' },
      ] },
      { icon: 'message-square', name: '对话', rows: [
        { t: 'text', n: '最大历史记录', k: 'secondBrainMaxHistory' },
        { t: 'button', n: 'AI 通道', d: '对话统一走主设置页 AI 服务商，Embedding 仍走 Ollama', btn: '前往配置' },
      ] },
      { icon: 'layout-dashboard', name: '面板', rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'secondBrainMobileDefaultFullscreen', m: true },
        { t: 'button', n: '重新索引', d: '清空现有向量索引并按当前白名单重嵌入，期间检索降级为文本匹配', btn: '开始', demo: 'reindex' },
      ] },
    ] },
    literature: { name: '文献盒', icon: 'list-video', desc: '文献笔记与术语录入', groups: [
      { icon: 'folder-open', name: '目录与分类', rows: [
        { t: 'path', mode: 'single', n: '文献目录', d: '文献笔记所在文件夹，列表实时扫描该目录', k: 'literatureDirectory' },
        { t: 'textarea', n: '领域词表', d: '逗号分隔的领域词；留空 = AI 自由写领域', k: 'literatureDomainList', ph: '物理,医学,计算机,经济,文史哲…' },
      ] },
      { icon: 'settings-2', name: '视频处理', rows: [
        { t: 'toggle', n: '详细进度提示', d: '处理中显示当前步骤、耗时、百分比与步骤时间线；关闭则仅显示步骤徽章', k: 'literatureProgressDetail' },
        { t: 'toggle', n: '保留视频原件', d: '转文献完成后保留视频文件；关闭则只生成文献笔记', k: 'literatureKeepVideo' },
        { t: 'select', n: '下载清晰度', d: '以视频源可用档位为准，低档优先命中缓存', k: 'literatureQuality', opts: [{ v: 'highest', l: '最高' }, { v: '1080', l: '1080P' }, { v: '720', l: '720P' }] },
        { t: 'toggle', n: '遇错即停', d: '单条失败后停止处理剩余任务；关闭则失败后继续', k: 'literatureStopOnFailure' },
        { t: 'text', n: '输出目录', d: '视频文件落地目录；留空跟随工具配置', k: 'literatureOutputDir', ph: '如 D:/videos' },
        { t: 'toggle', n: '压缩', d: '转文字前压缩视频，默认开启', k: 'literatureCompress' },
        { t: 'number', n: '压缩质量（CRF）', d: '数值越小画质越高；范围 18-28', k: 'literatureCrf', min: 18, max: 28, step: 1 },
      ] },
      { icon: 'terminal', name: '工具', rows: [
        { t: 'text', n: 'ffmpeg 路径', d: '视频处理用；留空跟随工具配置', k: 'literatureFfmpegPath', ph: '如 ffmpeg 或 D:/tools/ffmpeg.exe' },
        { t: 'text', n: 'ffprobe 路径', d: '探测视频元数据用；留空跟随工具配置', k: 'literatureFfprobePath', ph: '如 ffprobe 或 D:/tools/ffprobe.exe' },
        { t: 'text', n: 'Python 路径', d: '装了 Python 一般填 python 即可；留空跟随工具配置', k: 'literaturePythonPath', ph: '如 python 或 D:/tools/python.exe' },
        { t: 'text', n: 'Whisper 模型', d: '转写模型档位（tiny/base/small/medium/large）', k: 'literatureWhisperModel', ph: '如 small' },
        { t: 'text', n: '缓存目录', d: '剪辑产物与转写稿缓存；留空 = 系统临时目录', k: 'literatureCacheDir', ph: '如 D:/bili-dl-cache' },
        { t: 'number', n: '缓存保留天数', d: '超过该天数的缓存自动清理', k: 'literatureCacheRetentionDays', min: 1, step: 1 },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'literatureMobileDefaultFullscreen' },
      ] },
      { icon: 'wrench', name: '维护', rows: [
        { t: 'button', n: '清空历史', d: '移除全部成功归档的转文献记录；文献笔记与视频文件保留在 vault 中', btn: '清空历史', demo: 'clearHistory' },
      ] },
    ] },
    pomodoro: { name: '番茄钟', icon: 'timer', desc: '专注计时与休息', groups: [
      { icon: 'timer', name: '时间方案', rows: [
        { t: 'select', n: '预设方案', d: '选择现成的工作与休息时长组合', k: 'pomodoroPreset', opts: [
          { v: 'classic', l: '经典标准（25/5/15）' }, { v: 'neuro', l: '神经专注（30/7/20）' }, { v: 'flow', l: '深度心流（50/10/25）' },
          { v: 'creative', l: '创意激发（40/12/20）' }, { v: 'beginner', l: '初学入门（15/5/12）' }, { v: 'study', l: '高效学习（30/5/15）' },
          { v: 'sprint', l: '敏捷冲刺（20/4/12）' }, { v: 'marathon', l: '马拉松式（45/15/30）' }, { v: 'recovery', l: '疲劳恢复（20/10/20）' },
          { v: 'intense', l: '高强度（50/5/15）' }, { v: 'balanced', l: '平衡模式（35/7/18）' }, { v: 'custom', l: '自定义' },
        ] },
        { t: 'number', n: '工作时长', d: '自定义方案的工作阶段分钟数', k: 'pomodoroWorkMin', min: 1, max: 120, step: 1, vis: { eq: ['pomodoroPreset', 'custom'] } },
        { t: 'number', n: '短休息时长', d: '自定义方案的短休息分钟数', k: 'pomodoroShortBreakMin', min: 1, max: 60, step: 1, vis: { eq: ['pomodoroPreset', 'custom'] } },
        { t: 'number', n: '长休息时长', d: '自定义方案的长休息分钟数', k: 'pomodoroLongBreakMin', min: 1, max: 60, step: 1, vis: { eq: ['pomodoroPreset', 'custom'] } },
        { t: 'number', n: '长休息间隔', d: '每隔几个专注进入一次长休息', k: 'pomodoroLongBreakInterval', min: 1, max: 20, step: 1 },
      ] },
      { icon: 'sliders-horizontal', name: '行为', rows: [
        { t: 'toggle', n: '强制专注模式', d: '专注进行中无法暂停跳过或重置', k: 'pomodoroForceFocus' },
        { t: 'toggle', n: '自动循环', d: '阶段结束后自动开始下一阶段', k: 'pomodoroAutoCycle' },
        { t: 'toggle', n: '自动跳过休息', d: '专注结束后直接进入下一个专注', k: 'pomodoroAutoSkipBreak' },
        { t: 'toggle', n: '声音提醒', d: '阶段切换时播放提示音', k: 'pomodoroSound' },
        { t: 'toggle', n: '后台自动暂停', d: '窗口隐藏时暂停，恢复可见后自动继续', k: 'pomodoroAutoPauseOnHide' },
        { t: 'slider', n: '提示音音量', d: '提示音大小，默认最大', k: 'pomodoroVolume', min: 0, max: 100, step: 5 },
        { t: 'select', n: '打开时恢复方式', d: '启动时正在倒计时，选择弹窗提醒或后台继续', k: 'pomodoroRestoreMode', opts: [{ v: 'background', l: '后台继续' }, { v: 'popup', l: '自动弹窗' }] },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'pomodoroMobileDefaultFullscreen' },
      ] },
    ] },
    encrypt: { name: '保险库', icon: 'lock', desc: '密码、加密笔记与加密日记', groups: [
      { icon: 'key-round', name: '生成', rows: [
        { t: 'text', n: '密码生成字符集', d: '随机生成密码时使用的字符集', k: 'passwordCharset' },
        { t: 'number', n: '密码生成长度', d: '随机生成密码的字符个数', k: 'passwordLength', min: 4, max: 128, step: 1 },
      ] },
      { icon: 'shield', name: '安全', rows: [
        { t: 'toggle', n: '安全模式', d: '关闭保险库窗口立即自动上锁', k: 'securityMode' },
      ] },
      { icon: 'folder-open', name: '存储', rows: [
        { t: 'path', mode: 'single', n: '保险库根目录', d: '加密文件的存放位置', k: 'encryptRoot' },
      ] },
      { icon: 'image', name: '预览', rows: [
        { t: 'toggle', n: '生成压缩预览', d: '加密时生成图片视频的压缩预览', k: 'encryptPreviewEnabled' },
        { t: 'number', n: '预览长边', d: '预览图目标长边像素', k: 'encryptPreviewSize', min: 64, max: 1024, step: 16, child: true },
        { t: 'number', n: '预览质量', d: 'JPEG 图像压缩质量', k: 'encryptPreviewQuality', min: 0.1, max: 1, step: 0.1, child: true },
        { t: 'toggle', n: '预览自动加载原图', d: '打开预览自动解密原图', k: 'encryptAutoLoadOriginal', child: true },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'encryptMobileDefaultFullscreen' },
      ] },
    ] },
    smartcat: { name: '小橘陪伴猫', icon: 'cat', desc: '桌面宠物陪伴', groups: [
      { icon: 'palette', name: '外观', rows: [
        { t: 'choiceCards', n: '皮肤', k: '__smartcat:appearance', kind: 'cat', opts: [
          { v: 'orange', l: '橘', prev: { fur: '#e8944a', inner: '#f7d9b8' } },
          { v: 'gray', l: '灰', prev: { fur: '#9a9aa2', inner: '#c8c8d0' } },
          { v: 'black', l: '黑', prev: { fur: '#33333a', inner: '#5a5a64' } },
          { v: 'white', l: '白', prev: { fur: '#f2f2ee', inner: '#dcdcd4' } },
          { v: 'calico', l: '三花', prev: { fur: '#e8b878', inner: '#f7e4c8', patch: '#4a3b2e' } },
          { v: 'neon', l: '霓虹', prev: { fur: '#39d98a', inner: '#b8f0d8' } },
          { v: 'galaxy', l: '星云', prev: { fur: '#5b4a9e', inner: '#a89ad8', patch: '#e8c05a' } },
          { v: 'liquidMetal', l: '液态金属', prev: { fur: '#b8c4cc', inner: '#e4ecf0' } },
          { v: 'fire', l: '火焰', prev: { fur: '#e05a3a', inner: '#f7c4a8' } },
          { v: 'crystal', l: '水晶', prev: { fur: '#a8d8e8', inner: '#e0f4fa' } },
          { v: 'cyberpunk', l: '赛博', prev: { fur: '#e84a8a', inner: '#f7b8d4', patch: '#39d9e8' } },
          { v: 'rainbow', l: '彩虹', prev: { fur: 'linear-gradient(135deg,#e85a5a,#e8c05a,#5ae87a,#5aa8e8)', inner: '#f7f0d8' } },
          { v: 'hologram', l: '全息', prev: { fur: '#cde8f0', inner: '#eef8fc' } },
        ] },
      ] },
      { icon: 'message-circle', name: '互动', rows: [
        { t: 'text', n: '小橘对我的称呼', d: '小橘提到你时使用的称呼，默认为包仔', k: 'smartcatUserName' },
        { t: 'number', n: '自言自语间隔', d: '小橘每隔多久主动说一句话，范围 1 到 60 分钟', k: '__smartcat:speakInterval', min: 1, max: 60, step: 1 },
        { t: 'number', n: '说话概率', d: '定时到来时小橘主动说话的概率，范围为十分之一到一', k: '__smartcat:speakProbability', min: 0.1, max: 1, step: 0.1 },
        { t: 'toggle', n: '主动关心', d: '按你的活跃时段，每周温和地主动搭话一两次', k: '__smartcat:proactiveCare' },
      ] },
      { icon: 'archive', name: '记忆', rows: [
        { t: 'number', n: '短期记忆量', d: '保留最近多少轮对话作为短期记忆，范围 50 到 200', k: '__smartcat:shortTermMemory', min: 50, max: 200, step: 10 },
        { t: 'number', n: '上下文字数限制', d: '上下文内容的最大字数，设为 0 时仅取当前行', k: '__smartcat:contextLength', min: 0, max: 1000, step: 50 },
        { t: 'number', n: '上下文分布比例', d: '光标上下的上下文分配比例，十分之一到十分之九', k: '__smartcat:contextSplitRatio', min: 0.1, max: 0.9, step: 0.01 },
        { t: 'select', n: '记忆打分范围', d: '记忆质量打分的范围，智能模式自动分配云端与本地', k: '__smartcat:cloudScoring', opts: [{ v: 'smart', l: '智能' }, { v: 'all', l: '云端' }, { v: 'diary', l: '日记' }, { v: 'local', l: '本地' }] },
        { t: 'text', n: '向量化模型', d: '留空跟随第二大脑嵌入模型，改动后需重建记忆向量索引', k: 'smartcatEmbeddingModel' },
        { t: 'number', n: '分块字符上限', d: '长笔记每块向量的最大字符数，200 到 6000，越小检索越精准', k: 'smartcatChunkLimitChars', min: 200, max: 6000, step: 100 },
      ] },
      { icon: 'folder-open', name: '记忆目录', rows: [
        { t: 'path', mode: 'multi', n: '记忆目录', d: '这些文件夹内的笔记会进入小橘的记忆库（日记按时间段拆条）；移除目录会清掉对应记忆', k: 'memoryDirectories', pickerKind: 'card' },
      ] },
      { icon: 'database', name: '存储与记忆', rows: [
        { t: 'number', n: '行为流保留天数', d: '行为流条目最多保留 1 到 365 天，超出部分自动删除', k: 'behaviorMaxDays', min: 1, max: 365, step: 1 },
        { t: 'number', n: '行为流最大条数', d: '行为流最多保留 100 到 10000 条，超出部分删除最旧条目', k: 'behaviorMaxCount', min: 100, max: 10000, step: 100 },
      ] },
      { icon: 'moon', name: '记忆巩固', rows: [
        { t: 'number', n: '反思观察阈值', d: '自上次反思记忆流新增多少条观察就归纳一次洞察，范围 1 到 50', k: 'smartcatReflectMinNew', min: 1, max: 50, step: 1 },
        { t: 'number', n: '反思洞察条数上限', d: '每次反思最多归纳几条洞察，范围 1 到 10', k: 'smartcatReflectMaxInsights', min: 1, max: 10, step: 1 },
        { t: 'number', n: '引用摘录字数', d: '反思时引用笔记原文的最大字数，设为 0 不附原文，范围 0 到 2000', k: 'smartcatRefExcerptLimit', min: 0, max: 2000, step: 50 },
      ] },
      { icon: 'link', name: '关联', rows: [
        { t: 'toggle', n: '启用关联自动发现', d: '自动为同名实体的记忆建立关联 relatedIds', k: 'enableAutoLinking' },
        { t: 'number', n: '关联发现窗口天数', d: '同一实体在 1 到 30 天内的记忆自动关联', k: 'linkWindowDays', min: 1, max: 30, step: 1 },
      ] },
      { icon: 'eye', name: '显示', rows: [
        { t: 'toggle', n: '显示行为日志', d: '在数据面板中显示行为日志页签', k: 'showBehaviorLog' },
      ] },
      { icon: 'smartphone', name: '移动端', m: true, rows: [
        { t: 'toggle', n: '移动端默认全屏', k: 'smartcatMobileDefaultFullscreen' },
      ] },
    ] },
  };

  /* ---------- 脱敏演示值（结构同真实 data.json；密钥等均为假值） ---------- */
  const VALUES = {
    aiProvider: 'deepseek', deepseekApiKey: 'sk-demo-0000-0000', opencodeGoApiKey: '', openaiApiKey: '',
    anthropicApiKey: '', googleApiKey: '', moonshotApiKey: '', zhipuApiKey: '', dashscopeApiKey: '',
    siliconflowApiKey: '', openrouterApiKey: '', xaiApiKey: '', groqApiKey: '', mistralApiKey: '',
    togetherApiKey: '', ollamaApiKey: '', aiCustomEndpoint: '', aiCustomModel: '', aiCustomApiKey: '',
    aiModelOverrides: { deepseek: 'deepseek-v4-flash' }, aiContextOverrides: { deepseek: 65536 }, aiMaxTokensOverrides: {},
    aiTemperature: '', aiTopP: '', aiFrequencyPenalty: '', aiPresencePenalty: '',
    storagePath: 'CONFIG/STORAGE',
    settingsPanelLayout: 'jingwei',
    settingsPanelSkin: 'chenhun',
    diaryDirectory: '我的/日记', movieDirectory: '我的/影视', letterDirectory: '我的/信件', diaryBatchSize: '20',
    showTagCount: true, useFileDateTime: false, diaryTagShowEmoji: true, diaryContentRenderMode: 'markdown',
    diaryTagSortMode: 'fixed', diaryDefaultDateFilter: 'all', diaryDefaultSelectedTag: '', diaryJumpToEditAfterSave: false,
    diaryMobileDefaultFullscreen: true, diaryWallMobileDefaultFullscreen: true,
    todoSkin: 'paper', todoSkinTheme: 'warmwhite', memoSortMode: 'priority', memoShowArchivedByDefault: false, memoDueFormat: 'relative',
    memoDefaultPriority: 'minor', memoDefaultScene: '', memoScenarios: '剪藏,工作,学习,生活,代码,公开课',
    autoPopupOnStart: true, openNoteReminder: true, todoMobileDefaultFullscreen: false,
    belongingsDefaultStatus: '', belongingsMobileDefaultFullscreen: false, belSkin: 'poster', belSkinTheme: 'warmwhite',
    articleDirectory: '归档/网页剪藏', clipbookPanelWidth: 1306, clipbookPanelHeight: 806, clipbookMidWidth: 272,
    autoSummaryEnabled: true, autoSummaryLength: 'standard', autoSummaryTagsEnabled: true, autoSummaryTagCount: '3-6',
    autoSummaryTiming: 'immediate', clipbookMobileDefaultFullscreen: true,
    favoritesMobileDefaultFullscreen: false,
    cinemaFolderPath: '我的/影视', cinemaSortMode: 'date', cinemaStatusFilter: '', cinemaGridColumns: '6', cinemaMobileDefaultFullscreen: false,
    bookshelfFolderPath: '', bookshelfSkin: 'nordic', bookshelfDefaultSide: 'all', bookshelfSortMode: 'recent', bookshelfMobileDefaultFullscreen: false,
    enableAutoNotify: true, reviewAutoAddNotice: true, forceQuizForReview: true, enableMultipleChoice: false,
    questionsPerNote: '', shuffleQuestions: true, difficulty: 'random', reviewDailyLimit: 0, reviewIntervalScale: 1,
    reviewRThreshold: 0.9, reviewEnableFit: false, reviewFitEveryN: 10, reviewWatchedFolders: ['我的/日记'],
    reviewExcludedNotes: ['我的/日记/2025/旧笔记'], reviewTreeBadge: true, reviewMobileDefaultFullscreen: false,
    secondBrainOllamaUrl: 'http://127.0.0.1:11434', secondBrainRemoteOllamaUrl: '', secondBrainEmbeddingModel: 'nomic-embed-text',
    secondBrainAllowPaths: '我的', secondBrainEnabled: true, linkAgentEnabled: true, linkAgentTopK: '8', linkAgentMaxLinks: '0',
    linkAgentNotify: true, linkAgentAutoClean: true, linkAgentRespectRelated: true, linkAgentScopes: '我的',
    secondBrainTopK: '8', secondBrainChatTopK: '8', secondBrainChunkMinLength: '200', secondBrainContextLimit: '2000',
    secondBrainDebounceDelay: '300', secondBrainCursorPollInterval: '1500', secondBrainMaxHistory: '10', secondBrainMobileDefaultFullscreen: false,
    literatureDirectory: '文献盒', literatureDomainList: '', literatureProgressDetail: false, literatureKeepVideo: false,
    literatureQuality: '1080', literatureStopOnFailure: false, literatureOutputDir: '', literatureCompress: true, literatureCrf: 23,
    literatureFfmpegPath: '', literatureFfprobePath: '', literaturePythonPath: '', literatureWhisperModel: 'small',
    literatureCacheDir: '', literatureCacheRetentionDays: 14, literatureMobileDefaultFullscreen: false,
    pomodoroPreset: 'classic', pomodoroWorkMin: '25', pomodoroShortBreakMin: '5', pomodoroLongBreakMin: '15',
    pomodoroLongBreakInterval: '4', pomodoroForceFocus: false, pomodoroAutoCycle: false, pomodoroAutoSkipBreak: false,
    pomodoroSound: true, pomodoroAutoPauseOnHide: true, pomodoroVolume: 100, pomodoroRestoreMode: 'background', pomodoroMobileDefaultFullscreen: false,
    passwordCharset: 'A-Za-z0-9!@#', passwordLength: '20', securityMode: true, encryptSecurityMode: true,
    encryptRoot: 'CONFIG/.ENCRYPT', encryptPreviewEnabled: true, encryptPreviewSize: '384', encryptPreviewQuality: '0.5',
    encryptAutoLoadOriginal: false, encryptMobileDefaultFullscreen: false,
    smartcatUserName: '包仔', smartcatEmbeddingModel: '', smartcatChunkLimitChars: 800, memoryDirectories: '我的/日记',
    behaviorMaxDays: 30, behaviorMaxCount: 2000, smartcatReflectMinNew: 20, smartcatReflectMaxInsights: 3,
    smartcatRefExcerptLimit: 400, enableAutoLinking: true, linkWindowDays: 7, showBehaviorLog: true, smartcatMobileDefaultFullscreen: false,
  };

  /* ---------- 小橘 config（真实版存 smartcat.json） ---------- */
  const SMARTCAT = { appearance: 'orange', speakInterval: 10, speakProbability: 0.1, proactiveCare: true, shortTermMemory: 50, contextLength: 500, contextSplitRatio: 0.5, cloudScoring: 'smart' };

  /* ---------- mock vault 目录树（真实结构脱敏精选，平铺反转序演示用） ---------- */
  const DIRS = [
    'CODE', 'CODE/obsidian 插件', 'CONFIG', 'CONFIG/APPENDIX', 'CONFIG/BOOK', 'CONFIG/BOOK/东野圭吾全集',
    'CONFIG/BOOK/卡片笔记写作法', 'CONFIG/STORAGE', 'CONFIG/SCRIPTS', '归档', '归档/网页剪藏', '书库', '我的',
    '我的/日记', '我的/日记/2024', '我的/日记/2025', '我的/现代诗', '我的/现代诗/2024', '我的/现代诗/2025',
    '我的/随笔', '我的/读书笔记', '我的/仓库', '我的/信件', '我的/影视', '文献盒', '文献盒/物理', '模板', '索引',
  ];

  window.SP_DEMO = { NAV, DOMAINS, VALUES, SMARTCAT, DIRS, PROVIDERS };
})();
