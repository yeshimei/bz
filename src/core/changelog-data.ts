/* ============================================================
 * bz · 更新日志数据（core/changelog-data.ts，内置）
 *
 * 2026-11-02 用户拍板：**更新提示不再下载远端日志**，直接内置进 main.js——
 * 省掉一次网络往返、省掉「远端日志没跟上就弹上一版内容」这一整类问题，
 * 也让提示在离线时照常能弹。
 *
 * 2026-11-02 二次拍板：小窗里**把能拿到的历史版本全列出来**（保留最近 50 版），
 * 最新那版默认展开、旧版默认折叠，用户自己滚、自己点开——不再按「上次看到哪版」
 * 掐区间，也就不必猜用户的升级路径。当前 32 版约 70KB，可接受。
 *
 * 数据来源（一次性回填，见 .scratch/changelog-note/gen-releases.mjs）：
 *  - 1.35.0 → 1.39.1 取自 downloads/bz-changelog.html（按 tag 切块的新口径）
 *  - 1.0.0 → 1.25.0 取自 manual/bz-changelog.html（按部署日/自然周切块的旧口径）
 *  - 1.26.0 → 1.34.1 **缺失**：那九版从没生成过日志块（版本号是发版时手写的），
 *    这里不编造，直接跳过。要补只能从 git 提交重建，别凭印象编。
 *
 * 发版时的手工约定：每版发布前在这里**插到最前面**一条，version 必须与 manifest.json
 * 完全一致（`pickReleaseFor` 是全等匹配，不是就近匹配）。忘了加 = 这版不弹提示，
 * 不会弹错版本——这是刻意选的失败方向。条数超过 50 版时从末尾裁掉最旧的。
 * ============================================================ */
import { normalizeVersion } from './version';

/** 一条日志条目（domain 是域名小标签，sub 是弱化副行） */
export interface ChangelogEntry {
  domain: string;
  text: string;
  sub?: string;
}

/** 一个版本的日志块 */
export interface ChangelogRelease {
  version: string;
  date?: string;
  added?: ChangelogEntry[];
  improved?: ChangelogEntry[];
  fixed?: ChangelogEntry[];
}

/** 取与 version 完全相等的那个日志块；找不到 → null（调用方据此「不弹、不记账」） */
export function pickReleaseFor(releases: readonly ChangelogRelease[], version: string): ChangelogRelease | null {
  const target = normalizeVersion(version);
  if (!target) return null;
  return releases.find((r) => normalizeVersion(r?.version || '') === target) || null;
}

/** 这一版有多少条改动（三段求和） */
export function releaseEntryCount(release: ChangelogRelease): number {
  return (release.added?.length || 0) + (release.improved?.length || 0) + (release.fixed?.length || 0);
}

/**
 * 内置日志（**最新在前**，最多 50 版）。
 * 文案口径与 downloads/bz-changelog.html 一致——同名同句，不要在这里另写一版。
 */
export const CHANGELOG_RELEASES: readonly ChangelogRelease[] = [
  {
    version: '1.40.0',
    date: '2026-11-02',
    added: [
      { domain: '更新提示', text: '升级后第一次打开 bz 界面时弹出，只讲这一版改了什么' },
      { domain: 'QQ 交流群', text: '关于页和更新提示里都有入口，群号点一下就复制，手机端还能直接唤起加群' },
    ]
  },
  {
    version: '1.39.1',
    date: '2026-11-02',
    improved: [
      { domain: '游戏库', text: '打开 Obsidian 就静默同步一次，首页时间线的「玩了 X」不必先开游戏库' },
      { domain: '游戏库', text: 'Steam 上没封面的游戏，改用同款封面图、商店截图或库内主视觉补上' },
      { domain: '游戏库', text: '排序默认改成「最近玩」，并排在最前' },
      { domain: '插件更新', text: '每次启动都查一遍新版本，不再被节流跳过' },
      { domain: '在线资源', text: '手册、更新日志、皮肤、工具包跟着版本一起自动补齐' },
    ],
    fixed: [
      { domain: '游戏库', text: '后台拉封面、中文名、成就时主界面不再一遍遍闪，只改变化的那几处' },
    ]
  },
  {
    version: '1.39.0',
    date: '2026-11-01',
    added: [
      { domain: '外部工具', text: '新增「bz 依赖什么」清单——勾选要装的东西（Node、Python、Ollama、向量模型、ffmpeg、转写引擎、脸谱的 Python 包），当场生成一段安装提示词，复制给任意 AI 就能从头装到尾，连 bz 里的设置一起回填' },
    ]
  },
  {
    version: '1.38.0',
    date: '2026-11-01',
    added: [
      { domain: '影院', text: '可以从豆瓣导入影片至影院中' },
      { domain: '影院', text: '片单可以整单收录进影院' },
    ],
    improved: [
      { domain: '影院', text: '评分、导演、主演、海报都改从豆瓣详情接口取' },
    ],
    fixed: [
      { domain: '影院', text: '中文输入法在搜索框打字不再被打断' },
    ]
  },
  {
    version: '1.37.0',
    date: '2026-10-31',
    improved: [
      { domain: '下载通道', text: '插件更新与在线资源全面改走 GitHub 主通道、jsDelivr 备用，国内直连下载更快更稳' },
      { domain: '更新日志', text: '插件更新重启后会自动弹出本次的更新说明' },
    ]
  },
  {
    version: '1.36.0',
    date: '2026-10-31',
    added: [
      { domain: '域目录', text: '日记、剪藏、影视等六个板块的存放位置默认不再替您猜，第一次用时会有引导卡带您指一次就好' },
      { domain: '保险库', text: '四个板块第一次设置主密码时，共用同一块设置面板' },
    ],
    improved: [
      { domain: '界面', text: '在弹窗里选字、滑动时不会再误点外面把弹窗关掉' },
      { domain: '自动更新', text: '默认打开' },
      { domain: '自动更新', text: '更新时只下载插件本身和外部工具包，皮肤等在线资源不再跟着动' },
      { domain: '保险库', text: '第一次设密码时输入框改为明文显示，两个输入框上下排列' },
      { domain: '域目录', text: '图片附件统一存进对应目录下的 assets 子文件夹' },
      { domain: '域目录', text: '图片没单独配目录时，界面直接显示图片实际存到了哪，并跟着 Obsidian 的附件设置走' },
      { domain: '自检', text: '手机上断网页面的三个按钮放不下会自动换行，并加了「连不上？看视频」教程入口' },
      { domain: '其他', text: '断网时打开插件不再重复请求更新，启动更快' },
    ],
    fixed: [
      { domain: '保险库', text: '全新的库第一次设置主密码不再失败' },
      { domain: '番茄钟', text: '重新打开番茄钟不再丢失正在进行的倒计时' },
    ]
  },
  {
    version: '1.35.0',
    date: '2026-10-30',
    added: [
      { domain: '首页', text: '时间线改为直接汇总各板块的数据来展示，内容筛选也整个重做，更快更准' },
      { domain: '剪藏本', text: '知乎日报与果壳科学人两个订阅源默认关闭，想看再打开' },
      { domain: '关于组', text: '加了 GitHub 主页与使用教程两个入口' },
      { domain: '关于组', text: '反馈、GitHub、教程、赞赏四行加了彩色图标' },
      { domain: '更新日志', text: '改为按版本划分展示' },
      { domain: '其他', text: '状态日期、书影游进度与物品流转的时间精确显示到秒' },
    ],
    fixed: [
      { domain: '其他', text: '修复两处只在自动化测试环境出现的误报，不影响日常使用' },
    ]
  },
  {
    version: '1.25.0',
    date: '2026-09-27',
    added: [
      { domain: '设置面板', text: '通用页加「归物分类表」下载行', sub: '自行下载，状态展示，防重入' },
      { domain: '归物本', text: '表单加分类选择器', sub: '按组浏览，可搜，带图标，复用同一张分类表' },
      { domain: '设置面板', text: '通知页并回「通用」页', sub: '基础组收敛为通用与首页，通知四项偏好原键原行为' },
      { domain: '归物本', text: 'AI 归类改走两次 Jev', sub: '别名直配，选组，选类，哨兵回落 LLM' },
      { domain: '脸谱', text: '画像生成接整链', sub: '第二次确认门（取消=移除任务不烧AI），确认记账免重弹，跳过描述独立弹窗，零媒体直通' },
      { domain: '归物本', text: '分类表资产层', sub: '表源，图标池，出版脚本，运行时下载查询模块' },
      { domain: '脸谱', text: '图片描述 AI 段', sub: '确认门，跳过语义，批级断点，上下文窗，合并进聊天仓，每批张数设置；合并 master 重出原型' },
    ],
    fixed: [
      { domain: '归物本', text: '分类选择器非搜索态不再截断', sub: '26 组 515 条全量渲染，阈值提到 1200 防呆' },
    ]
  },
  {
    version: '1.24.0',
    date: '2026-09-26',
    added: [
      { domain: '设置面板', text: '手册与更新日志会在后台自动核对远端，新推的版本打开即生效', sub: '本地秒开，不等待网络' },
      { domain: '设置面板', text: '皮肤支持云端下载', sub: '内置首套兜底，其余 26 套按需拉起' },
      { domain: '脸谱', text: '画脸谱阶段机', sub: 'prep 工具段接进任务引擎' },
      { domain: '设置面板', text: '手册，日志入导航末尾「文档」组，移动端文档布局' },
      { domain: '设置面板', text: '更新日志弹窗取消外壳头行', sub: '与使用手册弹窗同形态（用户拍板对齐）' },
      { domain: '设置面板', text: '更新日志改为在线下载', sub: '与使用手册同口径的自包含 HTML，srcdoc 弹窗' },
      { domain: '脸谱', text: '数据源弹窗「重扫」升级「同步」', sub: '一键驱动 bz-face sync 从微信取数' },
      { domain: '设置面板', text: '二次拍板', sub: '手册改 OB 内独立弹窗内嵌打开' },
      { domain: '设置面板', text: 'v2 更新日志用户化', sub: '自动版本号，主次分层，内容改写' },
      { domain: '设置面板', text: '使用手册按钮下载，新版本自更新，域设置深化' },
      { domain: '脸谱', text: 'bz-face prep 子命令', sub: '单联系人媒体导出，派生图片档，关联表，语音转写' },
      { domain: '脸谱', text: '保库记录', sub: '脸谱数据整体入保险库，每联系人一条加密记录' },
      { domain: '脸谱', text: 'bz-face sync 子命令', sub: '取密钥，解密，逐联系人 chat.json 与头像源' },
      { domain: '设置面板', text: '更新日志弹窗', sub: '侧栏底部入口，按域分类（git 历史生成）' },
    ],
    fixed: [
      { domain: '设置面板', text: '更新日志，使用手册与域项左对齐', sub: '宿主 button 默认居中，文档项没有徽标兜底' },
      { domain: '设置面板', text: '远端皮肤首次安装能落盘，重启后不再短暂回落首套' },
      { domain: '脸谱', text: 'prep 会话 settled 标志私有化' },
      { domain: '脸谱', text: '同步参数路径带引号' },
      { domain: '设置面板', text: '使用手册入口搬侧栏 footer，下载，打开链路重做' },
      { domain: '核心', text: 'AI 输出上限护栏', sub: '面板上界按 provider×模型动态取，解析出口封顶' },
      { domain: '脸谱', text: '头像入库', sub: '库外 avatar 复制进库内媒体文件夹（CONFIG，FACES），渲染走 vault getResourcePath' },
    ]
  },
  {
    version: '1.23.0',
    date: '2026-09-25',
    added: [
      { domain: '脸谱', text: '封面墙成员补上预览桶', sub: '导入过预览但没画过的人也能上墙' },
      { domain: '脸谱', text: '折子印章四态', sub: '未画谱，画谱中，画谱中断，已画谱均可从卡上继续' },
      { domain: '脸谱', text: '画脸谱进度续跑', sub: '生成引擎后台化，批级落盘与进度块' },
      { domain: '脸谱', text: '脸谱语义深化与首页入口' },
      { domain: '脸谱', text: '脸谱折子改版' },
      { domain: '脸谱', text: '脸谱数据源设置面板', sub: '预处理导出目录直连，两段增量进画像' },
      { domain: '脸谱', text: '全模态媒体素材进画像管线', sub: '语音转写，图片描述解析，统计与媒体徽章' },
      { domain: '知识盒', text: '语音转写引擎二选一', sub: 'SenseVoice-Small 主力，faster-whisper 备选' },
      { domain: '脸谱', text: '互动统计', sub: '客观数据侧纯本地计算与详情页展示' },
      { domain: '脸谱', text: '增量提炼，导入前成本预告' },
      { domain: '脸谱', text: '详情页人物档案与随手记手动输入路径' },
      { domain: '脸谱', text: '卡墙排序筛选搜索，导出笔记，合并重复人物' },
      { domain: '脸谱', text: '画像深度移植（distilly 分层），关系时间线' },
      { domain: '脸谱', text: '多联系人勾选导入，主页面视觉重做' },
    ],
    fixed: [
      { domain: '脸谱', text: '收起折整片可点修折页切换死区', sub: '切换钩子挪到 leaf 元素' },
      { domain: '通用', text: '面板体系令牌重定向', sub: '子弹窗与组件库件回面板皮，删日记维护组与格式体检弹窗' },
      { domain: '密码本', text: 'review 后续' },
    ]
  },
  {
    version: '1.22.0',
    date: '2026-09-24',
    added: [
      { domain: '密码本', text: '快速生成密码，添加弹窗关闭二次确认' },
      { domain: '核心', text: 'Jev 服务商新增博查', sub: 'SystemOne 同构直连，模型缺省按服务商各配' },
      { domain: '第二大脑', text: '检索只查最新，空行不查询，重排模型可选' },
      { domain: '第二大脑', text: '接入 Qwen3-Reranker-4B 交叉编码重排' },
      { domain: '第二大脑', text: '设置项瘦身与 JEV 常开自动配置' },
      { domain: '第二大脑', text: 'Ollama 地址两行迁 AI 面板，桌面端远程地址自动补全，模型选择器回填时机修复' },
      { domain: '第二大脑', text: '向量化模型配置迁入 AI 面板', sub: 'LLM，Embedding，JEV 三组化，Qwen3-Embedding 支持与换模型维度守卫' },
      { domain: '影院', text: '观影分析收尾批', sub: '开卷流场萤火 v4 上岸，移动竖屏软横屏，滚轮一滚一幕' },
      { domain: '番茄钟', text: '重置，跳过改按钮内二次确认（替代确认弹窗），hover 一律不换底色' },
    ],
    fixed: [
      { domain: '影院', text: '观影分析桌面端开卷聚合错位', sub: '层框换算非旋转态减原点' },
      { domain: '第二大脑', text: 'review 后续', sub: '移动端去掉死初始化，超长列表用例真区分早退与回退' },
      { domain: '第二大脑', text: '重排打分不做 0，1 降级', sub: '缺 top_logprobs 判失败，非有限 logprob 跳过' },
      { domain: '通用', text: '换算标记随 DEFAULT_SETTINGS 落盘', sub: '默认值不再被当旧尺二次换算' },
      { domain: '核心', text: '模型选择器行长说明把模型名挤成逐字竖排' },
      { domain: '第二大脑', text: '检索层改精确全扫余弦，坏向量双重防线，分数去锐化' },
      { domain: '核心', text: 'JEV 模型选择器服务商名取注册表，清理陈旧注释' },
      { domain: '知识盒', text: '零秒截段误判，原型评审 UI 迭代', sub: '居中直弹，处理面板垫底，预览去头行，图版蓝签' },
      { domain: '番茄钟', text: '两个计时重叠', sub: '动效打在隐藏层上顶掉了 opacity:0；翻牌层转为唯一可见层并放大字号' },
      { domain: '番茄钟', text: 'review 三改' },
    ]
  },
  {
    version: '1.21.0',
    date: '2026-09-23',
    added: [
      { domain: '影院', text: '不可用一律回落 LLM，判定编排抽 core，jev-fallback（影院补回落）' },
      { domain: '番茄钟', text: '特效批九味', sub: '进度四味，世界退后，收工钟，倒数滴答，过渡音' },
      { domain: '通用', text: '数据源凭据三行统一单行掩码，行序调整（Key 在前）' },
      { domain: '番茄钟', text: '退役「后台自动暂停」', sub: '窗口 hidden 不再暂停计时' },
      { domain: '复习计划', text: '记忆分析特刊', sub: '全屏逐幕分析层（16 幕）' },
      { domain: '剪藏本', text: '「我读了什么」全屏读报特刊层，头行电传纸带，期号戳章重做' },
      { domain: '收藏本', text: 'el clic en tarjeta ya no navega — fuera i…' },
      { domain: '首页', text: '周历头改台历卡样式', sub: '色带，星期，大数字，波浪入场' },
      { domain: '首页', text: '首页动效层', sub: '开场编排，河道描线常流，事件揭出迸光，切天接力' },
    ],
    fixed: [
      { domain: '其他', text: 'review-414 四改', sub: '越界算畸形走回落，闭集按自有键判，回落接 signal，AbortError 归一' },
      { domain: '番茄钟', text: '环光被 SVG 元素框硬切', sub: '显式 overflow:visible' },
      { domain: '收藏本', text: '设置面板评审壳三处裸奔', sub: '样式链缺收藏本，图标表缺 11 键，自检卡在已退役的 appearance 域' },
      { domain: '设置面板', text: '萤标坐标帧差一个 scrollTop', sub: '滚动后点靠下的侧栏项，光晕留在上面几行' },
      { domain: '首页', text: '预览壳补游戏库图标 gamepad-2', sub: '「全部域」里该行此前渲染成空白' },
      { domain: '首页', text: '预告卡倾斜绑定随静默刷新丢失', sub: '绑定件从 boot 档提到 boot 判据外' },
      { domain: '其他', text: '全域搜索框清除钮对齐效率#12 口径', sub: '有词才现，清空即隐' },
      { domain: '首页', text: '关后再开整屏不可见但可点' },
      { domain: '影院', text: '检索改三路兜底链', sub: 'suggest 软拒绝不再误报没找到' },
      { domain: '影院', text: '豆瓣检索弃搜索页改 subject_suggest', sub: '治解析风控误报' },
    ]
  },
  {
    version: '1.20.0',
    date: '2026-09-22',
    added: [
      { domain: '游戏库', text: '成就图标改远端直取，不再本地化' },
      { domain: '剪藏本', text: '添加 UP 主即直查资料（名字，头像），开弹窗补缺资料' },
      { domain: '设置面板', text: '复合行窄屏两行排版，UP 名单去头像' },
      { domain: '影院', text: '观影分析镶进影院面板（覆盖层，点遮罩关），影院交互四修' },
      { domain: '影院', text: '观影分析整篇重写为《观影志》26 幕（issues 406-408）' },
      { domain: '影院', text: '观影分析整页重做为滚动放映室', sub: '四本 22 幕，幕单元放映' },
    ],
    fixed: [
      { domain: '核心', text: '列表头像取图去 Referer', sub: '修移动端 UP 名单不显示头像' },
      { domain: '剪藏本', text: '添加 UP 主支持长 uid（纯数字位数不设上限）' },
      { domain: '影院', text: '新增背面加回「我的记录」段（评分，影评已看显示），观影分析引擎根解析修复', sub: '面板根 closest 落空致整页静止' },
      { domain: '影院', text: '季圆点悬浮正脸那一季', sub: '只换文案不建层，滑回正脸一次落回静息态' },
    ]
  },
  {
    version: '1.19.0',
    date: '2026-09-21',
    added: [
      { domain: '影院', text: '动效整合批' },
      { domain: '影院', text: '季圆点悬浮换季改「涟漪揭示」', sub: '来片层从被悬浮的圆点圆形扩散' },
      { domain: '影院', text: '保存即齐（海报落库，不再后台抓取），侧栏，排序钮滑动高亮' },
      { domain: '影院', text: '合集共享元素', sub: '合集卡同款过渡，合集行钻入' },
      { domain: '影院', text: '抽离升级为整卡离场，列表 FLIP 补位，让位' },
      { domain: '影院', text: '详情弹窗共享元素过渡', sub: '海报抽出飞入，面板从海报生长，关闭返程' },
      { domain: '影院', text: '添加影视改「解析，豆瓣预取，双面翻转卡片」' },
      { domain: '影院', text: '关联判定与影院类型判定接入 Jev 决策通道（issues 391，392，393）' },
      { domain: '核心', text: 'Jev 决策通道封装' },
      { domain: '备忘录', text: '移动端编辑弹窗键盘适配', sub: 'vvh 收缩，顶对齐，保存钮钉底' },
      { domain: '备忘录', text: '「今日」「重要」伪场景空态专属文案' },
      { domain: '备忘录', text: '完成动作反馈', sub: '勾选圈待定态与折叠条去向轻反馈' },
      { domain: '首页', text: '入口菜单末尾统一「设置」直达该域设置页（issues 388）' },
      { domain: '游戏库', text: '设置面板「密钥型」输入档位，Steam API 密钥接入（呈报#48 GS3）' },
    ],
    fixed: [
      { domain: '影院', text: '返程落点被源卡纠正动画污染', sub: 'FLIP 集合排除源卡本体' },
      { domain: '影院', text: '表单重名反馈（红边框，锁保存），撤销影院 Jev 接入，移除 TED 分类' },
      { domain: '备忘录', text: '搜索体验四连', sub: 'ESC 先清词，一键清词，命中高亮，网址可搜' },
      { domain: '备忘录', text: '样式清理与触控热区对齐' },
      { domain: '备忘录', text: '编辑器表单与交互杂项八件' },
      { domain: '备忘录', text: '删除，完成，场景收尾链对齐全域口径' },
      { domain: '备忘录', text: '读路径错误面，渲染省算与滚位保持' },
      { domain: '影院', text: '右键菜单桌面分流改悬浮能力判定，与季圆点悬浮统一 hoverCapable 单出口' },
      { domain: '备忘录', text: '数据层读入守卫，公开课检索边界与会话缓存' },
      { domain: '书库', text: '报告视图宿主搜索行为收窄，消灭「只刷隐藏墙」假动作（RR-U13）' },
      { domain: '归物本', text: '自绘下拉键盘导航，ESC 二段语义（呈报#12 B5）' },
      { domain: '核心', text: 'uiChip 切换型缺省挂 aria-pressed（深审 gameshelf 段…' },
    ]
  },
  {
    version: '1.18.0',
    date: '2026-09-20',
    added: [
      { domain: '核心', text: '大面板打开即入焦，Tab 圈闭范式 trapPanelFocus 全域接线' },
      { domain: '核心', text: '触屏悬浮隔离范式', sub: '全量 :hover 规则包进 @media (hover: hover)' },
      { domain: '复习计划', text: '悬浮评级条键盘化', sub: '数字键 1-4 评级，ESC 归还焦点（呈报#12-R8）' },
      { domain: '影院', text: '详情弹窗补齐笔记已有字段（片长，季集，完整上映日期，热门短评）' },
      { domain: '小橘陪伴猫', text: '小橘「更智能」批', sub: '关系阶段，她自己的事，情绪惯性，记忆自动纠错，追问线' },
    ],
    fixed: [
      { domain: '首页', text: '番茄钟菜单 focusing 文案对齐「暂停专注」（PM2 残款，呈报#63 半边）' },
      { domain: '复习计划', text: '六条复习命令 name 括号式改动宾式（呈报#56，R12）' },
      { domain: '设置面板', text: '搜索键盘闭环，命中词高亮，会话滚位记忆（呈报#17，#26，#49）' },
      { domain: '首页', text: '骨架期标题不再闪现，裁「R1 生活周报」死代码（呈报#31，#53）' },
      { domain: '收藏本', text: '卡墙点按反馈与外链标识，磁贴行限高（呈报#24，#25，#61）' },
      { domain: '复习计划', text: '统计弹窗按影院现行形制重刷，排名行键盘可达（呈报#55，#12-R7）' },
      { domain: '附件搬移', text: '拍板修复批', sub: '动词统一「搬移」，跳过预览快捷出口，上次目标前置预告' },
      { domain: '复习计划', text: '题面 emoji 换 lucide，冲刺头行模式副标题，假可达与空态口径（呈报#5…' },
      { domain: '复习计划', text: '轮次互斥提示，翻篇轮询降频命中才读盘（呈报#4，#38）' },
      { domain: '阅读报告', text: '恒可见返回钮显式规则，旧走查守卫随 RR-U1 新拍板翻转' },
      { domain: '设置面板', text: '面板重开放重挂 ESC 层，栈序随 z 序同步（checkup 深审 ui P2-…' },
      { domain: '数据体检', text: '数据体检深审修复批' },
    ]
  },
  {
    version: '1.17.0',
    date: '2026-09-19',
    added: [
      { domain: '日记本', text: '打开先面板后内容', sub: '首帧让位读盘与整墙渲染' },
      { domain: '日记本', text: '墙数据启动后台预热，四目录并行加载' },
      { domain: '知识盒', text: '术语文献退役 term 冗余键' },
      { domain: '备忘录', text: '退役清单型子任务 UI' },
      { domain: '核心', text: 'uiModal 补 dialog 读屏语义并新增 bindFormSubmit 回…' },
      { domain: '核心', text: 'uiModal 内置焦点管理，trapFocus 三壳圈闭；stat，sugges…' },
      { domain: '核心', text: '触控热区修饰类自带热区；.bz-field 补定位锚定；通知常驻帧关闭钮样式' },
      { domain: '核心', text: '路径选择器新建文件夹与键盘闭环，回调容错回滚（效率#10，#11，R7，N6）' },
    ],
    improved: [
      { domain: '核心', text: 'file-sync rename 引用判定挪进去抖批次按路径去重' },
    ],
    fixed: [
      { domain: '剪藏本', text: '保存图片后自动复制嵌入 wikilink 到剪贴板（memo item-17897…' },
      { domain: '复习计划', text: '批 B 命令与监听链修复' },
      { domain: '复习计划', text: '批 B 出题链与编排修复' },
      { domain: '复习计划', text: '批 E 深审修复', sub: '统计 UI 与设置与样式与文档' },
      { domain: '复习计划', text: '冲刺会话与渲染层深审批 D 九项修复' },
      { domain: '复习计划', text: '非法日期容错，数据层 bulk API，注释如实（F7，A11，A13-E4）' },
      { domain: '剪藏本', text: '修复既存红×2' },
      { domain: '日记本', text: 'review 修正' },
      { domain: '剪藏本', text: 'rail 行内 钮退役，报告层，划选浮框补 topifyZ 发号，搜索框 hove…' },
      { domain: '游戏库', text: '工具行单行化收紧，卡片去悬浮 title，全成就角标换 字符（2026-09-19…' },
      { domain: '剪藏本', text: '批 D 视图层修复（列表，检索，移动端，报告，样式）' },
      { domain: '剪藏本', text: '批B数据写链，抓取，扫描，锚定九项修复' },
    ]
  },
  {
    version: '1.16.0',
    date: '2026-09-18',
    added: [
      { domain: '日记本', text: '创建日记成功后打开新笔记并收起主窗口 (item-1789672493967-y1…' },
      { domain: '游戏库', text: '头行退役海报头顶格，卡片悬浮截图轮播，成就进度条，奖杯' },
      { domain: '影院', text: '季圆点悬浮预览', sub: '正脸换成该季海报与信息' },
      { domain: '影院', text: '季进度改「海报右下角一排圆点」，去掉注释文字' },
      { domain: '影院', text: '剧集按季合并', sub: '季进度条卡片，设置开关' },
      { domain: '游戏库', text: '全量落盘，媒体全本地化（用户拍板：所有数据，全量，完整，都在本地）' },
      { domain: '首页', text: '时间线新到旧，退役生成今日总结，入口行灰字补四域统计' },
      { domain: '影院', text: '豆瓣抓取海报目录设置，抓取队列调整（并行会话 WIP）' },
    ],
    fixed: [
      { domain: '影院', text: '想看落盘编码 -1，编辑不再弹回在看 (item-1789722741019-t8…' },
      { domain: '影院', text: '季圆点改到海报左下角（用户订正方位）' },
      { domain: '游戏库', text: '截图本地化真因修复，成就图标路径进属性' },
    ]
  },
  {
    version: '1.15.0',
    date: '2026-09-17',
    added: [
      { domain: '游戏库', text: '移动端去掉海报头，搜索行改「固定」（用户两条）' },
      { domain: '游戏库', text: '域落位，外观组，首页快捷命令（用户三条）' },
      { domain: '游戏库', text: '移动端按钮序，吸顶留白，媒体全部本地化（用户四条）' },
      { domain: '游戏库', text: '展示中文名，头行收敛，遮罩毛玻璃（用户评审四条）' },
      { domain: '游戏库', text: '游戏架 UI v3', sub: 'V1 海报墙落域，数据统计面板，详情全量数据' },
      { domain: '游戏库', text: '属性中文化，海报本地缓存，成就详情弹窗' },
      { domain: '游戏库', text: '游戏架域' },
      { domain: '第二大脑', text: '周报主面板入口，弹层移动规范' },
      { domain: '备忘录', text: '月历视图' },
      { domain: '备忘录', text: '周期性重复备忘' },
      { domain: '第二大脑', text: '本周知识动态' },
      { domain: '复习计划', text: '做题家独立面板' },
      { domain: '复习计划', text: 'FSRS 拟合放开全 19 参数' },
      { domain: '剪藏本', text: '剪藏阅读报告页' },
    ],
    fixed: [
      { domain: '游戏库', text: 'appdetails 解析按 appid 外层键取', sub: '修真机「商店数据解析不出，没有中文名」' },
      { domain: '游戏库', text: '面板挂回遮罩内', sub: '修真机「只有遮罩层，没有主窗口」' },
      { domain: '番茄钟', text: '审查修复批（归档固化先落盘，统计呈现）' },
      { domain: '日记本', text: '审查修复批（码点截断，文字卡角标与行长，加密直测）' },
      { domain: '归物本', text: '审查修复批（纯离场年空态，千分位，截至今日，重入刷新，days0）' },
      { domain: '复习计划', text: '审查修复批（w[4] 既有缺陷，拟合分片让出，做题面板取消，批量）' },
      { domain: '剪藏本', text: '审查修复批（打开即已读时长 P1，移动计时，弹层健壮性，空态两态）' },
      { domain: '备忘录', text: '审查修复批（周期锚点漂移 P1，restore 撤链，排期入口，月历语义与热区）' },
      { domain: '第二大脑', text: '审查修复批（周报弹层遮罩，z 序 P1，数据口径）' },
      { domain: '剪藏本', text: '报告空态图标，统计与移动端规范' },
      { domain: '备忘录', text: '月历数据链与空月统计提示' },
      { domain: '归物本', text: '年度资产报告暗色 token 全覆盖，移动端面板规范' },
    ]
  },
  {
    version: '1.14.0',
    date: '2026-09-16',
    added: [
      { domain: '复习计划', text: '裁剪复习评级四命令' },
      { domain: '通用', text: '原生设置页退役平铺，只留「打开设置面板」按钮' },
      { domain: '知识盒', text: '知识盒清理批', sub: '删提炼成卡，来源与领域统一，反链走缓存，属性行可编辑' },
      { domain: '知识盒', text: '录入面板界面修订', sub: '日期沉底，生成入口移交底部，属性区 loading 统一，总结退役' },
      { domain: '知识盒', text: '录入草稿流式成形', sub: '点下即开界面，正文逐字长出' },
      { domain: '人工智能', text: '模型档位表', sub: '默认值按当前模型取官方最大档，删除上下文窗口设置行' },
      { domain: '核心', text: 'AI 输出上限面板独裁', sub: '调用点私有 max_tokens 全拆除' },
      { domain: '通用', text: '设置 AI 页拆三组（服务商，模型配置，数据源凭据），Cookie 行换多行文本框' },
      { domain: '人工智能', text: '思考档位设置与自动关联候选相似度下限' },
      { domain: '剪藏本', text: '保存剪藏全量图片本地化，图片命名去标题，条目菜单补复制链接' },
    ],
    fixed: [
      { domain: '知识盒', text: '录入面板关联预演检索不可达如实报 queued（此前死分支冒充「暂无关联」）' },
      { domain: '剪藏本', text: '撤销移动端划选工具框的 48px 系统菜单让位' },
      { domain: '剪藏本', text: '正文屏蔽移动端原生长按选择菜单' },
      { domain: '知识盒', text: '知识盒×剪藏引用同步', sub: '删除降级回外链，断链摘除，knowledge，clipbook.json 路径 file-sync' },
      { domain: '核心', text: '引用同步补漏', sub: 'secondbrain rename rekey，diary 内存同步，checkup 孤儿扩展' },
      { domain: '保险库', text: '加密附件他引保护', sub: '共享原件保留，还原跳过' },
      { domain: '影院', text: '海报路径 rename 联动，抓取队列存在性守卫' },
      { domain: '剪藏本', text: '锚定双链裸 basename 解析换正牌 API', sub: 'getFirstLinkfileDest 在 Obsidian 1.12，1.13 不存在致拦截恒失效' },
      { domain: '自动摘要', text: 'AI 起标题改名改走 fileManager.renameFile，联动更新全库双链' },
      { domain: '剪藏本', text: 'B站条目去除保存入口（ADR-0147），已存按钮置灰，保留策略清侧写，锚定链接捕…' },
      { domain: '剪藏本', text: '保存，标读后自动前进的下一篇补换篇语义', sub: '打开即已读，滚动归零（memo zrurtk）' },
      { domain: '剪藏本', text: '移动详情已收剪藏正文可读，正文长词防撑破' },
    ]
  },
  {
    version: '1.13.0',
    date: '2026-09-15',
    added: [
      { domain: '知识盒', text: '图版逐图描述与录入预填，预览直达，来源升级 API' },
      { domain: '剪藏本', text: '划选工具框与知识盒划词锚定，保存图片本地化' },
      { domain: '知识盒', text: '名词录入防重名', sub: '输入实时提醒，确认硬拦截' },
      { domain: '知识盒', text: '关联行三改', sub: '确认写入不回退，分析不锁按钮，真中断与后台分支' },
      { domain: '知识盒', text: '段落，图版快捷命令，四入口关闭二次确认，生成后开笔记' },
      { domain: '核心', text: '新增智谱 Plan 服务商', sub: 'Coding 套餐专用端点（glm-5.3-flash）' },
      { domain: '知识盒', text: '自动关联迁入知识盒，范围恒为三个盒子' },
      { domain: '知识盒', text: '挂载白板空板，重跑口径，建议锚点句高亮，固定改套整句' },
      { domain: '知识盒', text: '挂载建议三段式，白板渐进渲染与进度，卡片列表性能' },
    ],
    fixed: [
      { domain: '第二大脑', text: 'review 修正' },
    ]
  },
  {
    version: '1.12.0',
    date: '2026-09-14',
    added: [
      { domain: '知识盒', text: '卡列表引用计数徽标与孤儿筛选（320）' },
      { domain: '知识盒', text: '挂载树入口与命令（319）' },
      { domain: '知识盒', text: '挂载树白板（317）' },
      { domain: '知识盒', text: 'MountNode 补 parent 字段：同名文献挂所属卡片，可沿链回到主卡' },
      { domain: '知识盒', text: '挂载树 AI 语义建议链路' },
      { domain: '知识盒', text: '挂载树数据层：双链解析，三源汇总与树构建（issues 314，315）' },
      { domain: '知识盒', text: '挂载树连线路由与几何原语（issues 316 连线侧）' },
      { domain: '知识盒', text: '挂载树力导向布局（issues，316 前半）' },
      { domain: '知识盒', text: '挂载树共享契约 mount-types（模块间唯一接口，只放类型）' },
      { domain: '知识盒', text: '录入四名词，关联行显式双链，影像两界面，AI 多模态，图版（issues 309-…' },
      { domain: '知识盒', text: '视频录入改链接解析式（解析按钮，分P，时长，档位，双把手进度条）' },
    ],
    fixed: [
      { domain: '知识盒', text: '裁判改走 prompt 纯文本通道（json_object 会吐空壳），思考回默认…' },
      { domain: '知识盒', text: '挂载建议认得出模型的真实回答（标签编号，包壳），思考拉满 128K' },
      { domain: '知识盒', text: '整库扫描每轮只走一遍，自链不计被引（320 审查）' },
      { domain: '知识盒', text: '挂载树白板审查修复（317，319 改后合并）' },
      { domain: '知识盒', text: '建议幽灵节点补 parent（MountNode.parent 落地后的集成点）' },
      { domain: '知识盒', text: '端点桩不再插进邻卡（审查阻断项，issues 316 连线侧）' },
      { domain: '知识盒', text: 'b23.tv 短链解析补全元信息并写回规范链接' },
    ]
  },
  {
    version: '1.11.0',
    date: '2026-09-13',
    added: [
      { domain: '首页', text: '时间线痕迹源整体替换为小橘行为流' },
      { domain: '日记本', text: 'diary-split.mjs 迁移脚本', sub: 'dry-run 默认，同刻让位，memory 引用重写，归档，Obsidian 运行拦截' },
      { domain: '日记本', text: 'encrypt mergeDiaryBlock v2，smartcat 四面，re…' },
      { domain: '日记本', text: '条目文件格式落地', sub: 'store 重写条目粒度，parser，encrypt v2，体检只读化' },
      { domain: '影院', text: 'ApiZero 字段扩展', sub: '上映日期，year，季集，episodes，热门短评' },
      { domain: '影院', text: '影院豆瓣抓取迁入插件，字段走 ApiZero' },
      { domain: '剪藏本', text: '聚合讯抓取迁入插件内' },
    ],
    fixed: [
      { domain: '剪藏本', text: 'UI 收尾 10 条评审修复（C11，C16，C17，C18，C19，C20，C2…' },
      { domain: '剪藏本', text: '设置，弹窗侧 2 条评审修复（C4，C25）' },
      { domain: '剪藏本', text: '存储，数据侧 7 条评审修复（C9，C10，C12，C27，C28，C30，C31）' },
      { domain: '剪藏本', text: 'UI 核心 8 条评审修复（C1，C5，C6，C7，C8，C13，C14，C15）' },
      { domain: '日记本', text: 'diary-split 重跑幂等', sub: '盘上同内容条目视为已迁移，不再让位产重复' },
      { domain: '复习计划', text: '日记迁移 review 修复' },
      { domain: '剪藏本', text: '抓取侧修复五项（review C2，C3，C23，C24，C26）' },
      { domain: '其他', text: '空日期文件改判直接归档（无内容可拆零丢失），与未解析行人工清单分离' },
      { domain: '影院', text: '豆瓣抓取写回链路修复十项（review C1-C10）' },
      { domain: '剪藏本', text: 'review 修复批', sub: '窗口裁剪落盘，lastFetchAt 语义，通知收窄' },
    ]
  },
  {
    version: '1.10.0',
    date: '2026-09-12',
    added: [
      { domain: '设置面板', text: '通知入基础组，设置页并入通用，搜索即过滤与重置本域，全域分组文案统一' },
      { domain: '保险库', text: '锁屏统计明文落盘', sub: '冷启动回落上次快照而非「—」' },
      { domain: '第二大脑', text: '文献笔记生成即跑', sub: '知识盒生成落盘后立即建链' },
      { domain: '知识盒', text: '领域词表与 AI 领域提示去示例枚举' },
      { domain: '通知', text: '通知设置四项', sub: '级别，停留档位，弹出位置，同屏上限' },
      { domain: '收藏本', text: '设置补两项', sub: '打开默认筛选，默认排序' },
      { domain: '归物本', text: '设置补三项', sub: '默认排序，新记默认状态，金额单位' },
      { domain: '设置面板', text: '剪藏本设置精简，管理弹窗通用组件化，uiSetlist 组件入库' },
      { domain: '备忘录', text: '退役「到期时间格式」设置', sub: '到期文案口径固定相对' },
      { domain: '界面', text: '全域子弹窗统一', sub: '一套浮层壳，域皮贯通' },
      { domain: '首页', text: '秒开三件套', sub: '首次骨架秒开，关闭保留 DOM，重开复用动态刷新' },
      { domain: '复习计划', text: '移动端字号体系', sub: '按视觉层级放大（队列，冲刺，结算，评级条，统计历史）' },
      { domain: '保险库', text: '保险库面板收敛为只管加密笔记，销毁二次确认（vault-pwstyle 落域第二片）' },
      { domain: '知识盒', text: '视频录入 URL 净化与标题，UP主 自动回填' },
    ],
    fixed: [
      { domain: '剪藏本', text: '文章标题字号降档', sub: '桌面 24px，display 档，移动 33px，27px' },
      { domain: '界面', text: '危险中性语义补全（第二轮评审）', sub: '17 处破坏性确认，域皮不变量守门' },
      { domain: '界面', text: '危险中性补全', sub: '8 处破坏性确认补 danger，core 整套中性形制复位' },
      { domain: '剪藏本', text: 'F3 守卫收窄', sub: '已读未收补收可升级 saved 且不重复计已读（review 收编）' },
      { domain: '首页', text: '入口编辑器 blur 监听挂 AbortController，触屏滚动仲裁重写' },
      { domain: '影院', text: '补问期间保持运行态，随机抽一部先整刷已开面板' },
      { domain: '日记本', text: '修复写盘 runFix 包进同路径队列（D4 diary 半边）' },
      { domain: '备忘录', text: '提醒监听自持 app 真正卸载（E7）；搜索残留，composer 防双提交保草稿…' },
      { domain: '密码本', text: '确认框监听器单绑定防删错条目（E1）；共锁感知，E6 移动页重建，E5 密码掩码，…' },
      { domain: '保险库', text: '锁家族修复批', sub: 'E3 资产校验，E4 回发解锁态，E9 孤儿容器，E10 单例复位，E11 通知收敛，E12 损坏分支，E13 opQueue 串行，E14 删前重读，E…' },
      { domain: '日记本', text: '日记家族审查修复批 D1–D15，R1（15 项，附回归 21 例）' },
      { domain: '核心', text: '共享基座修复批 C1-C12' },
    ]
  },
  {
    version: '1.9.0',
    date: '2026-09-11',
    added: [
      { domain: '保险库', text: '三域共用解锁屏（保险库，密码本，加密日记）' },
      { domain: '番茄钟', text: '番茄钟接入预览管线，弹窗降噪，10 套皮肤（亮，暗）' },
      { domain: '书库', text: '借书卡固定高，在读「继续」不折行' },
      { domain: '书库', text: '借书卡详情改版', sub: '去钮，卡内分区滚动，印章随内容，在读可继续' },
      { domain: '首页', text: '时间线六项设置，修入口拖拽两个 bug' },
      { domain: '日记本', text: '移动端主界面关闭钮「复位优先」', sub: '先收列表再关面板' },
      { domain: '首页', text: '入口彩点五条件点亮（剪藏未读，专注中，复习逾期，影院在看，重要备忘）' },
      { domain: '影院', text: '标记已看改走编辑窗（评分影评用户输入）' },
      { domain: '日记本', text: '抽屉收编 core，item-actions，setIcon 缺键真因修复' },
      { domain: '剪藏本', text: '已读，已收正文保留不清空' },
      { domain: '剪藏本', text: 'v1.3.0 RSS 订阅源抓取（rss-parser，turndown），每日简…' },
      { domain: '日记本', text: '移动端六档字号体系，抽屉长按唯一入口，头行关闭钮，视频首帧海报' },
      { domain: '第二大脑', text: '主面板移动端全屏化，头行关闭钮' },
      { domain: '通用', text: '移动端全屏页顶部 44px 统一，弹窗关闭钮全域退役' },
    ],
    fixed: [
      { domain: '知识盒', text: '文献，剪藏标题生成收敛为完整陈述句' },
      { domain: '书库', text: '借书卡固定高降档 82vh，700，72vh，600' },
      { domain: '影院', text: '海报 loading 完成信号双通道，AI 荐片方案 A，视图切换高亮口径' },
      { domain: '首页', text: '首页域自检改用面板自绘组件选择器（.bz-select，.bz-sw，data-k…' },
      { domain: '备忘录', text: '抽屉头勾选圈补 44px 触控热区并对齐列表尺寸' },
      { domain: '其他', text: 'writeNewsData 剥离 missing 读兜底标记（八段契约约定外段）' },
      { domain: '复习计划', text: 'quiz-core 会话弹窗样式恢复' },
      { domain: '阅读报告', text: '报告去内联样式收编域 CSS，暗色指标色提亮' },
      { domain: '第二大脑', text: '补暗色模式，37 处硬编码色收编 token' },
      { domain: '知识盒', text: '补齐品牌区，批量处理钮，取消钮三处无样式 UI' },
      { domain: '归物本', text: 'poster 皮肤补暗色模式（夜版海报 token 组，推翻双主题恒定旧口径）' },
    ]
  },
  {
    version: '1.8.0',
    date: '2026-09-10',
    added: [
      { domain: '备忘录', text: '移动端评审两轮六改，切换链路三修' },
      { domain: '首页', text: '入口顺序，显隐按端独立，域快捷菜单，首页外观组；设置面板侧栏七组' },
      { domain: '首页', text: '原型外景尺寸全固定，撤掉高度调节条' },
      { domain: '首页', text: '原型 1:1 宽度固化为实测基准 118mm，撤掉测量 UI' },
      { domain: '首页', text: '原型移动外景高度改自由可调（滑块 650~1000 CSS px）' },
      { domain: '首页', text: '原型移动外景高度加满屏，内容区两档，修 1:1 长度对不上' },
      { domain: '首页', text: '原型移动外景支持 1:1 真机物理尺寸（小米13U 屏宽 70.15mm，可尺量校…' },
      { domain: '剪藏本', text: '剪藏本 UI 五改，刊物刊名呼吸光标，暗色皮' },
      { domain: '剪藏本', text: '每日简报产出定为「要点列表，每条要点一句话」' },
      { domain: '剪藏本', text: '每日简报产出改为一句话总结' },
      { domain: '剪藏本', text: '每日简报', sub: 'B站 UP 视频字幕，转写，AI 要点' },
      { domain: '日记本', text: '日记本方向探索', sub: '五版概念稿，三版皮肤，原型主页（本轮未采纳）' },
      { domain: '小橘陪伴猫', text: '小橘行为流接线补齐，文案人性化' },
      { domain: '知识盒', text: '移动端头部章回式重排，三部统一预览弹层' },
    ],
    fixed: [
      { domain: '影院', text: '移动端抽屉统一到 core 手势，浮层，并修 core 合成 mousedown …' },
      { domain: '影院', text: '移动端三修', sub: '面板真全屏，长按只出抽屉，方形钮钉死宿主 padding' },
      { domain: '影院', text: '通栏按钮左对齐并修 chips 不回落列表' },
      { domain: '备忘录', text: '修复 styles.css 被，* 全局替换损毁（布局全乱）' },
      { domain: '首页', text: '重出滞后的原型行为产物', sub: '首页退役「回忆墙」独立入口' },
      { domain: '首页', text: '原型 1:1 校准改为基准线绝对公式，修掉连点累乘' },
      { domain: '首页', text: '移动原型外景改用小米13U 真机视口 412×827' },
      { domain: '备忘录', text: '移动端真全屏补关闭，新建入口并修键盘遮挡输入条' },
      { domain: '设置面板', text: '模型选择器弹窗暗色皮断链，移动端 44px 错位' },
      { domain: '剪藏本', text: '简报条目归一丢 transcriptPath', sub: '转录稿链接被插件回写抹掉' },
      { domain: '日记本', text: '章节栏取帧根治，弹窗，粘顶，头行等 9 项精修' },
      { domain: '知识盒', text: '术语来源链接与标题净化', sub: '剥追踪参数，站点尾巴' },
    ]
  },
  {
    version: '1.7.0',
    date: '2026-09-09',
    added: [
      { domain: '知识盒', text: '术语录入可选「来源」source，sourceTitle 键，单框智能分流' },
      { domain: '第二大脑', text: '移动端整体滚动模型，抽屉重排到新设计语言' },
      { domain: '影院', text: '豆瓣抓取插件直调', sub: '内存队列 spawn CLI，卡片 loading，守护退役' },
      { domain: '首页', text: '首页域入口加第二大脑磁贴' },
      { domain: '首页', text: '导航首页卡片中文名，一句话说明（新域自动纳入，未知 id 回退）' },
      { domain: '影院', text: '豆瓣盲区补全', sub: '打开触碰协议，工具补全分支' },
      { domain: '第二大脑', text: '定稿原型三界面落域' },
      { domain: '密码本', text: '密码本自统一保险库拆回独立域' },
    ],
    fixed: [
      { domain: '影院', text: '直调队列三连败修复' },
      { domain: '影院', text: '直调架构合并前审查修复批' },
      { domain: '第二大脑', text: '对话弹窗摘模型徽标，输入行防溢出；移动抽屉同皮米白红棕' },
      { domain: '影院', text: '审查修复批' },
      { domain: '复习计划', text: '移动端三区队列自然展开不内滚，区列头吸顶' },
      { domain: '第二大脑', text: '对话弹窗尺寸锁定 760×600，灵感参考窗口几何找回' },
    ]
  },
  {
    version: '1.6.0',
    date: '2026-09-08',
    added: [
      { domain: '剪藏本', text: '会话冻结序', sub: '桌面打开即读，原位不重排，两端已读，已收双折叠' },
      { domain: '剪藏本', text: '视频正文链接可跳转，标题下状态章退役，阅读字号改设置面板项' },
      { domain: '剪藏本', text: '全局去在读，打开即已读即时让位，已读进折叠段，删除，确认弹窗纸墨化，去查看原文' },
      { domain: '剪藏本', text: '移动端 m3 原型逐字覆盖' },
      { domain: '剪藏本', text: '移动端目录化', sub: 'site 章，已收折叠' },
      { domain: '通用', text: '待办，书架墙外观组标准化', sub: '置顶双行（布局占位卡，主题 layoutKey 联动）' },
      { domain: '设置面板', text: '移动端重写全屏推入式两页，移动端默认全屏特性全链退役' },
      { domain: '设置面板', text: '设置面板UI修复批（采样参数组全链退役，路径行拍板，移动端搜索，custom行范式）' },
      { domain: '设置面板', text: '演示种子补全各域外观键默认值（并行会话批；外观组键须与 src，settings.…' },
      { domain: '设置面板', text: '移动端域设置弹窗改底部抽屉（原型与 ui.ts 同步，拍板样式落地）' },
      { domain: '剪藏本', text: '原型落域' },
      { domain: '其他', text: '原型热重载服务导航主页（仓库根 index.html）' },
      { domain: '设置面板', text: '外观组范式铺开全面板域' },
      { domain: '设置面板', text: '外观组范式落归物本', sub: '占位单卡（布局，大字报，主题，暖白）' },
    ],
    fixed: [
      { domain: '剪藏本', text: '移动搜索，关闭，读下一则失灵，字号分段编辑部皮恢复' },
      { domain: '剪藏本', text: '头行检索 flex:0 0 250px 定宽落地' },
      { domain: '其他', text: 'uiSelect 菜单贴视口右缘溢出兜底（实测右缘左移收进，极窄视口交由 elli…' },
      { domain: '收藏本', text: 'prototype-view CSS 链路径修正（..，core，一级，同 bel…' },
      { domain: '归物本', text: 'prototype-view CSS 链路径修正（..，core，一级；selft…' },
    ]
  },
  {
    version: '1.5.0',
    date: '2026-09-07',
    added: [
      { domain: '归物本', text: '年份，移动排序原生 select 退役换自绘海报菜单（并行会话批次收尾入库）' },
      { domain: '归物本', text: '年份，排序下拉换自绘海报菜单', sub: '原生 select 弹层退役（纸面墨框方角，赤橙当前项）' },
      { domain: '设置面板', text: '设置行 note 补充提示，体检按钮 cta 强调' },
      { domain: '影院', text: '影院风格化落域', sub: '午夜场完整版进插件' },
      { domain: '设置面板', text: '设置面板重设计落域', sub: 'P1 系统面板，S1，S3 双皮，外观独立「设置」域' },
      { domain: '影院', text: '三风格原型壳1:1回灌，午夜场完整功能版（原型批）' },
      { domain: '书库', text: '五肤×亮暗双模式，移动端头行，借书卡迭代' },
      { domain: '首页', text: '周历倒排，今天显「今」，移动端关闭钮修复' },
      { domain: '首页', text: '周历头，按日时间线同步落域' },
      { domain: '书库', text: '移动端头行一行横滑，原型迭代流程落规' },
      { domain: '书库', text: '原型落域', sub: '域内评审壳补齐' },
      { domain: '首页', text: '首页活动河全域入口版落域' },
      { domain: '归物本', text: '分类图标化，预设退役' },
    ],
    fixed: [
      { domain: '备忘录', text: '四域 review P2 收尾', sub: '影院壳长按，状态兼容，首页 memoIdOf 归一，设置面板演示壳 api 引用与回归锚点' },
      { domain: '影院', text: 'review 修复', sub: 'status 串，数兼容回退，壳长按随渲染重挂，selftest 回归锚点补强' },
      { domain: '归物本', text: '头行副题去同义重复，补品牌 token 覆盖；scripts 增原型热更新服务器' },
      { domain: '首页', text: '周历倒排最新在前，今日标「今」，关闭钮选择器加面板前缀' },
      { domain: '设置面板', text: '空面板热修', sub: '.bz-sp-desk 撤 position:relative 复原 core 居中链' },
      { domain: '首页', text: '头行关闭钮图标空白' },
      { domain: '首页', text: '活动河四项调优' },
      { domain: '归物本', text: '归物本审查 B1，B3-B8 七修', sub: '关面板清陈旧库，搜索词，出离内流转保留封口，写盘失败回滚提示，ESC 层序，命令路径加载失败提示，表单防叠开' },
      { domain: '收藏本', text: '命令直开表单注册 ESC 层，ESC 关抽屉改 closeSheet 整体移除', sub: 'openForm 抽 ensureFavoritesEsc（openPanel 原位与 openForm 开头各调一次，对照 belongings 同款）…' },
    ]
  },
  {
    version: '1.4.0',
    date: '2026-08-31',
    added: [
      { domain: '归物本', text: '移动端整页迭代', sub: '印章头，等宽状态条，输入聚焦去环——移动 hero 顶行三轮收敛至 H8 印章头：墨章「64 在库」赤橙标签，「归物本」，投入，日均小字，右对齐（rend…' },
      { domain: '归物本', text: 'P20 原型落域方向纠正', sub: 'p20-full 定稿评审壳，域向原型对齐——用户点名『把原型写进 bz』返工：prototype.html 重建为拍板原型定稿（共用 styles.cs…' },
      { domain: '收藏本', text: '原型评审壳共用 styles.css，全域 emoji 换 lucide 图标，布…' },
      { domain: '归物本', text: 'P20 瑞士大字报完全原型化', sub: '海报 hero，筛选 chips，大字网格，详情弹窗' },
      { domain: '书库', text: '头行行内标题「书库」，十肤全量补全，设置预览重画', sub: '木匾退场标题与标签同行居左，分类卡轻缩一档保纸标造型，九肤结构层自原型移植，dark 补墙映射，--bsw-title，.bz-skinprev-bs-*…' },
      { domain: '收藏本', text: '头区 1:1 原型', sub: '标题粗黑款删副题，磁贴全白底，右键菜单，表单亚麻皮肤' },
      { domain: '收藏本', text: '头部彻底原型化' },
      { domain: '书库', text: '分类细拆 20 类单一概念定稿，EPUB 分类接 subjects 通道' },
      { domain: '书库', text: '借书卡只读化', sub: '详情卡纯展示：移除状态，进度，日期，书评编辑与删除，保存，进度改静态条纹条，状态圆点，字数行；persistBook，rollbackBook，openB…' },
      { domain: '收藏本', text: '完全原型化', sub: '删 rail，主头行，工具行，头区，磁贴行，卡墙' },
      { domain: '剪藏本', text: 'rail 按 site 分类，中右栏分割线拖宽，拖拽误关闭 core 修复' },
      { domain: '收藏本', text: '亚麻记事板换血', sub: 'C5 白卡墙，胶带磁点，置顶金圈，归档褪色' },
      { domain: '日记本', text: '长文跨栏卡', sub: '≥800字整卡跨全宽，卡内分栏，媒体横排网格' },
      { domain: '书库', text: '书脊墙 1:1 复刻换血，旧网格布局全退役' },
    ],
    improved: [
      { domain: '日记本', text: '章节栏小图缓存根治开墙原图解码冻结' },
    ],
    fixed: [
      { domain: '归物本', text: '宿主样式两边差异三修' },
      { domain: '收藏本', text: '头行固定仅卡墙滚动，关闭钮压回 reset', sub: '面板改 flex 列 overflow:hidden，head，tags flex:none，board flex:1 min-height:0 over…' },
      { domain: '收藏本', text: '移动端面板显式 100vw，100vh，卡墙防撑爆', sub: 'overlay 弹性子项不定宽被 line-clamp 卡片 max-content 撑到两倍屏宽（右列出屏），mob 面板补视口宽高；grid 轨道 m…' },
      { domain: '收藏本', text: '图标挂载补全，窄屏适配', sub: 'renderTags，头行关闭钮 mountIcons 补挂（新收藏，移动此前永不渲染），表单 min(430px,100vw-32px) 留边，面板 c…' },
      { domain: '收藏本', text: '右键菜单，移动抽屉图标缺失修复', sub: 'mountIcons 未调用致 <i data-lucide> 占位残留，菜单与抽屉渲染后补挂；ctx，sheet 按钮补 justify-content…' },
      { domain: '收藏本', text: '桌面固定 900×620 面板，移动关闭钮进 head 行', sub: '面板补边框，圆角，投影对齐原型 .frame，.bz-fav-mob-close 改 head 行内静态位，移动头行两端对齐 padding-top 4px' },
      { domain: '收藏本', text: 'C5 原型后轮改动回灌', sub: '主背景 #fffcf6，面板去底部内边距，头行 20px，标题 14px，磁贴行 20px，卡墙顶垫 6px，移动磁贴单行横滑新收藏置首，关闭钮 24×24' },
      { domain: '书库', text: '木匾复位逐肤换脸，筛选弱化对齐原型，工具行逐行对齐，报告残留，书脊起伏修复', sub: '小号匾额「书库，LIBRARY」九肤换脸；全馆点击清状态，分类；.off 弱化口径（无筛选全亮，激活弱化，全馆恒亮）；.bz-bs-view displa…' },
      { domain: '收藏本', text: '标题字号 21px，14px' },
      { domain: '收藏本', text: '头行样式用户直供版照抄，副题只留白卡计数，磁贴 0,2,0 抗 reset，底色 …' },
      { domain: '收藏本', text: 'CSS 逐值 1:1 抄原型', sub: '底色去黄，标题 21px，副题灰字加回，磁贴胶囊白底，磁点浅白' },
      { domain: '剪藏本', text: '在读让位移动端同序，保留天数两键合一' },
    ]
  },
  {
    version: '1.3.0',
    date: '2026-08-24',
    added: [
      { domain: '小橘陪伴猫', text: '洞察条数上限，来源分布按追查目录，小橘对我的称呼', sub: '新增 smartcatReflectMaxInsights（默认 3，记忆巩固组可调，反思 prompt 声明最多 N 条，LLM 返回按序截断兜底）与 …' },
      { domain: '小橘陪伴猫', text: '巩固语义重定义' },
      { domain: '小橘陪伴猫', text: '三层记忆流水线，巩固参数设置面板' },
      { domain: '复习计划', text: '答对 0.8s 亮绿自动跳题，去头部对错统计，逾期复习出新题' },
      { domain: '知识盒', text: '术语窗口自动生成，输入行重跑，底部总结按钮' },
      { domain: '第二大脑', text: 'Syncthing 冲突文件自动自愈' },
      { domain: '设置面板', text: 'Python 路径填 python 即可' },
      { domain: '知识盒', text: '视频录入批量按钮纯 emoji' },
      { domain: '知识盒', text: '主面板列表间距，相对日期，视频录入批量按钮单钮态机' },
      { domain: '其他', text: '压缩回退' },
      { domain: '收藏本', text: '收藏本 UX 批次', sub: '分页，排序，搜索空态区分，删除可撤销，保存防假死，脏表单拦截，样式收敛' },
      { domain: '知识盒', text: '文献盒桌面窗口简洁布局', sub: '主面板，视频录入保留标题，历史去标题（ 计数，）且组头去 UP主前缀与条数，笔记行去目录去 .md，时间 formatRelativeTime 相对显示；…' },
      { domain: '知识盒', text: '术语生成面板简洁版', sub: '删弹窗标题，术语 label，placeholder，状态行（加载并入按钮），预览只读：上属性卡（术语，领域，日期）下内容卡，无输入框不可编辑；「重新生成…' },
      { domain: '复习计划', text: 'UX 批次第一波', sub: 'core 撤销，写盘失败 helper，toast action 减重，复习域规范收敛，做题家纯复习会话语义' },
    ],
    fixed: [
      { domain: '复习计划', text: '开始复习双 progress 通知合并为一条', sub: 'review，app.ts 外层框 dedupeKey \'review-generate\' 统一为 \'quiz-generate\'，与 quiz，ui.t…' },
      { domain: '通知', text: '桌面端 toast 位置下移', sub: '#bz-notice-container top 16px，56px，避开 Obsidian 顶部栏与标题区；移动端断点 34px 不动；ADR-0067…' },
      { domain: '通知', text: '通知操作按钮改 span 消除高度撑高', sub: 'Obsidian 核心 button 默认 height 32px 硬撑，.bz-notice-action 只覆盖 padding；改 span，rol…' },
      { domain: '小橘陪伴猫', text: '设置面板数字滑杆改输入框', sub: '17 处 slider 行改 number 行（schema 既有行类型，min，max 钳制，防抖落盘语义不变），消除下滑误触滑杆；issues，161…' },
      { domain: '小橘陪伴猫', text: '备忘录删除行为流落盘时序加固', sub: '实证事件链路完整（emit，notifyMemoAction，memo:deleted 路由，三套注册表齐）而真实数据 deleted 恒 0 ⇒ 30s…' },
      { domain: '小橘陪伴猫', text: '反思，日小结，周报记忆流断粮饿死修复' },
      { domain: '其他', text: '移动端长按不松手直接拖拽图标' },
      { domain: '复习计划', text: '通知「去复习」走做题流程分流，答题答对自动跳下一题' },
      { domain: '知识盒', text: '生成的文献笔记补回视频双链' },
      { domain: '知识盒', text: '文献盒「留空跟随工具配置」键留空时不下发，修复转写环节 rc 兜底被空串覆盖' },
      { domain: '其他', text: '--batch 经 shell 启动改 base64 传输，修复批量处理整批 JS…' },
      { domain: '小橘陪伴猫', text: '归档行为流措辞补全与来源标签统一', sub: '补 archived 行为文案与徽标词（此前缺失注册），归档观察文案去「收藏」前缀与前者统一，行为来源标签齐名「收藏本，归物本」' },
    ]
  },
  {
    version: '1.2.0',
    date: '2026-08-17',
    added: [
      { domain: '影院', text: '修订2 smartcat 影视观察改走方法监听', sub: 'UI 确认回调 notify 一次动作一条根治打字刷屏，ADR-0027，全量' },
      { domain: '影院', text: 'smartcat 影视动作感知观察完成', sub: '快照 diff 动作文案，UI 影评与正文剥海报双链，delete 监听与去弹跳豁免' },
      { domain: '影院', text: '影视抽屉想看态新增「标记已看」（在看动作下方，直跳已看），标记在看，标记已看均把观…' },
      { domain: '日记本', text: 'smartcat 云端打分范围', sub: '智能默认（日记，反省，闪念恒 LLM，长内容按 30 字，聊天，域事件本地）' },
      { domain: '小橘陪伴猫', text: 'smartcat 数据面板 完成', sub: 'bz-smartcat-dashboard 四页签只读可视化（总览，情绪，人格，记忆），作息直方图与成长轨迹，moodLevelFromPad 纯函数抽取' },
      { domain: '小橘陪伴猫', text: 'smartcat 懂你闭环', sub: '情绪温和共振，全通道上下文，数据诚实化' },
      { domain: '小橘陪伴猫', text: 'smartcat 认知接入', sub: 'Bandit 选臂优化主动关心话术，聊天 reward 回填，元认知矛盾检测提示，情绪趋势注入聊天，周报上下文' },
      { domain: '小橘陪伴猫', text: 'smartcat 认知基础模块', sub: '参考 cognitive-engine 自研：情绪趋势，波动度(VAD，EMA)，Thompson Bandit 自适应，元认知矛盾检测，零依赖纯函数' },
      { domain: '小橘陪伴猫', text: 'smartcat 每周懂你报告', sub: '周统计，LLM 个性化总结写回流，设置弹窗查看入口' },
      { domain: '小橘陪伴猫', text: 'smartcat 作息模型，主动关心', sub: '24h 活跃画像判定搭话时机，每周 1-2 次温和关心，设置开关' },
      { domain: '小橘陪伴猫', text: 'smartcat 睡前巩固', sub: '每日 digest 当日观察 LLM 归纳日小结写回流，驱动人格微漂移' },
      { domain: '小橘陪伴猫', text: 'smartcat RAG 增强', sub: '检索 query 结合情绪及时段，记忆注入带来源，相对时间' },
      { domain: '日记本', text: 'smartcat 完成', sub: '数据接入面扩展（用户拍板：日记读正文，关键词，闪念全文，影视全影评，书库划线想法书评，现代诗，信，反省新源，全内容 LLM 云端打分，词法情绪；CONFI…' },
      { domain: '第二大脑', text: 'smartcat 人格对齐 MATE（ADR-0023）', sub: '删预设 5 选 1，OCEAN 随机种子，30 特质 9 群组成长（seed，transition，周更新，反思），trust，attachment 关系…' },
    ],
    fixed: [
      { domain: '剪藏本', text: '聚合讯，阅读报告移动端默认全屏跟随剪藏本，书库，移除两窗口 设置入口' },
      { domain: '小橘陪伴猫', text: 'smartcat 设置，聊天面板开着时不再锁死拖拽', sub: '面板仅抑制点触与长按手势，移动照常（鼠标，触屏）' },
      { domain: '小橘陪伴猫', text: 'smartcat 移动端长按开设置关闭后无法拖拽', sub: 'core 设置弹窗补 onClose 复位交互锁；外观改平铺色块选择器即时换肤；移动端删人格数据列表' },
      { domain: '小橘陪伴猫', text: 'smartcat 桌面拖拽松开后仍跟随鼠标', sub: 'document 监听改一次性 bind 稳定引用，isMousePressed 守卫，dispose 补摘监听' },
      { domain: '小橘陪伴猫', text: 'smartcat 去掉气泡 emoji 抽离到独立指示器（用户要求）' },
      { domain: '小橘陪伴猫', text: 'smartcat 删 30 分钟空闲跟随（用户要求），修气泡堆叠', sub: '去 transform 手动推挤改纯 flex 自然堆叠（原双重位移错位）' },
      { domain: '小橘陪伴猫', text: 'smartcat 小橘样式修复', sub: '脸宽高致双眼重叠正中（删 cat-face 宽高还原原版 shrink-to-fit），耳朵 10px，气泡上移 95px 补细节与暗色适配，happy，…' },
      { domain: '其他', text: '解密还原后主动重读日期文件并并回列表（refreshFile 导出复用，不再依赖文…' },
      { domain: '日记本', text: '加密入口收敛到抽屉' },
      { domain: '设置面板', text: '修复抽屉遮罩 z-index 缺失被主面板压盖', sub: '遮罩完整覆盖全屏（10999），点遮罩只关抽屉不连带主面板；按钮高特异性抗 Obsidian 默认样式，顶部间距放宽' },
      { domain: '其他', text: '修复触屏列表滚动被长按禁掉，菜单紧凑化', sub: 'core longPress 改被动监听（滚动恢复，长按吞合成 click 防穿透），跟手菜单小尺寸无底色简洁风' },
      { domain: '日记本', text: '手势统一试点（memo），移动端样式修复（diary，favorites）', sub: 'core，item-actions 统一操作条与长按跟手菜单，memo 收敛标签长按暗语；移动端类型栏多行平铺与滚动条收敛' },
    ]
  },
  {
    version: '1.1.0',
    date: '2026-08-10',
    added: [
      { domain: '收藏本', text: '收藏本 GitHub 增强', sub: '真实 GitHub API 拉取仓库名，简介(fetched 标志，8s超时，重试1次)，AI 整理联动(GitHub 链接标题预填，简介忠实翻译，标签兜…' },
      { domain: '人工智能', text: '黑匣子全量提炼幂等与并发收敛（实测 opencode.ai 并发不稳）' },
      { domain: '人工智能', text: '黑匣子全量提炼提速（用户反馈「50，1413 后无数据」）', sub: '批次 50，10，并发 4，ai-fail 重试 1 次，每轮保存（数据可见，中断不丢）' },
      { domain: '通知', text: '黑匣子提炼进度通知（用户反馈）', sub: '完成汇总通知（新增人物，事件），全失败 warning 且不推进 cursor（下次重试），AI 失败 console 可见，provider 精确检查' },
      { domain: '收藏本', text: '黑匣子设置，样式，装配完成', sub: '设置弹窗 6 项（含词表增删），Ollama 接入，styles.css v4 收敛（删 v3 1300 行），构建直出 vault' },
      { domain: '日记本', text: '黑匣子对话完成', sub: '三层记忆（日记 TF-IDF，画像概要，历史 maxHistory），包仔人设常量，AI 降级' },
      { domain: '其他', text: '黑匣子复盘完成', sub: '手动四段报告（事实锚定）JSON 落盘，对话流可见，新人物提示，画像观察聚合 ≤5 裁旧' },
      { domain: '其他', text: '黑匣子人物画像完成', sub: '画像卡（印象，观察，情绪，事件数），详情采纳移除，mentions 候选，humanEdited 锁' },
      { domain: '设置面板', text: '黑匣子提炼链路完成', sub: 'vault 监听 30 分钟防抖，一次 AI 调用批量提炼，首次全量分批 50，三标签面板骨架' },
      { domain: '日记本', text: '黑匣子 v4 设计落盘', sub: '容器改日记分析层' },
      { domain: '备忘录', text: 'memo 样式提取完成' },
      { domain: '备忘录', text: 'memo 代码精简完成', sub: '按钮工厂，标签常量，建议列表泛型化，设置项辅助，1936，1739 行，全量' },
      { domain: '通知', text: '黑匣子完成', sub: '打开秒开（立即渲染，扫描提示条，水合缓存只扫一次，vault 事件失效），录入确认即关（AI 标题后台生成，重命名，注入，关联后台补全，成功通知）' },
      { domain: '其他', text: '黑匣子 目录迁移' },
    ],
    fixed: [
      { domain: '复习计划', text: '做题进度题号不递增修复（用户反馈）' },
      { domain: '复习计划', text: '做题选项长文本两头截断修复（用户反馈）' },
      { domain: '复习计划', text: '复习批量出题秒失败修复（用户反馈）' },
      { domain: '复习计划', text: '复习「做题家未初始化」误报修复' },
      { domain: '复习计划', text: '复习计划「做题决定难度」生效修复（用户反馈）' },
      { domain: '备忘录', text: '备忘录长文本换行修复（用户反馈）', sub: '.todo-content-span 加 min-width:0 允许 flex 收缩，移动端去掉 flex-basis:auto 覆盖（flex-wra…' },
      { domain: '其他', text: '删除黑匣子域（用户决策：功能失败，不留痕迹）', sub: '删 src，blackbox 13 文件，tests，blackbox 9 文件，ADR 0013-0017，CONTEXT，AGENTS 术语，styl…' },
      { domain: '通知', text: '黑匣子诊断日志（用户反馈排查）', sub: 'blackbox-debug.log 落盘自动提炼每一步与异常，启动异常不再静默（warning 通知）' },
      { domain: '日记本', text: '黑匣子情绪落盘（用户反馈修复）', sub: '日记条目情绪推断 entryEmotions 落盘，情绪分布条合并日记情绪，完成通知含情绪统计' },
      { domain: '人工智能', text: '黑匣子启动自动提炼（用户反馈修复）', sub: '重启后 cursor 空自动全量，待处理自动增量，AI 未配置 warning 提示' },
      { domain: '番茄钟', text: '番茄钟开始，暂停提醒与声音' },
      { domain: '其他', text: 'blackbox.json 移除 index 字段（2026-08-12 用户决策）', sub: 'index 改为运行时内存映射，load 全量扫描黑匣子，笔记构建（id，路径），不再持久化；save 只写派生层（entries 已不写，index 也…' },
    ]
  },
  {
    version: '1.0.0',
    date: '2026-08-03',
    added: [
      { domain: '影院', text: '影视 海报抓取监听', sub: '创建影视笔记后轮询「海报」字段，非空即原地更新常驻 progress 通知为完成（不弹第二条通知）' },
      { domain: '设置面板', text: '设置归属模型完成', sub: 'ADR-0009 全局设置页单页化（AI，共享 storagePath），10 域 设置弹窗，筛选，排序统一，storagePath 迁移（旧 7 字段兼…' },
      { domain: '其他', text: '入口页完成', sub: '全局唯一命令入口弹窗（单例，长按编辑模式，推挤拖拽，档位手柄，幽灵磁贴，自定义图标，命令选择器）' },
      { domain: '自动摘要', text: '自动摘要 补充', sub: '调用 AI 时通知「正在为《xx》生成摘要…」' },
      { domain: '自动摘要', text: '自动摘要 完成', sub: 'create，open 双触发，缺字段 AI 补全（缺 title 重命名笔记），通知《title》，summary，#tags' },
      { domain: '影院', text: '影视 方案反转' },
      { domain: '影院', text: '影视 工具 README 重写', sub: '去掉 pm2 内容，补充绝对路径坑，风控重试，跳过逻辑，插件集成说明' },
      { domain: '影院', text: '影视 完成', sub: '海报抓取集成全局 npm 包' },
      { domain: '备忘录', text: '收藏本数据路径固定文件名（设置只允许改目录，兼容旧完整路径值），复习，做题家联动契…' },
      { domain: '备忘录', text: '主页改造，全量改名', sub: '主页.js 点击换 bz 命令，去 QuickAdd 降级链，插件目录 memo-suite，bz，30 命令统一 bz- 前缀（ADR-0004 修订）…' },
      { domain: '日记本', text: '日记本合并', sub: '插件更名「包仔」（日记本，备忘录同插件）——从历史恢复 diary-notebook 官方源码，open-panel 裸注册，ribbon，styles.…' },
      { domain: '界面', text: '主面板，条目列表，弹窗族，滚轮选择器，写摘抄，设置页装配' },
      { domain: '其他', text: '数据层（加载，写回，增删，刷新监听）' },
      { domain: '其他', text: '工程骨架，core 共享层，标签配置，解析层' },
    ],
    fixed: [
      { domain: '复习计划', text: '通知系统修订', sub: '显式指定类型（删 emoji 自动归类），类型图标 emoji（ℹ，），桌面右侧弹出，移动端顶部居中，dedupe 同键存活期单框合并（可切类型，重置计时…' },
      { domain: '其他', text: 'B站下载 裁切后可返回原视频重裁，压缩无收益保留原件', sub: 'download 记录 originalPath，新增，api，revert 恢复下载原件（重置 trimmed，compressed，start，end…' },
      { domain: '日记本', text: '通知覆盖补全', sub: '日记条目删除，影视添加成功，收藏删除三处操作反馈（全仓操作点扫描确认其余均已有通知或 UI 即时反馈）' },
      { domain: '保险库', text: '通知补白', sub: 'dedupeKey 30s 去重节流，z-index 100000 最顶，移动端适配（safe-area，34px 顶距，宽度 clamp 视口）；P0 …' },
      { domain: '设置面板', text: '入口页设置平台双套：文字显隐与手势拆分为桌面（launcherShowText，l…' },
      { domain: '设置面板', text: '设置弹窗 z-index 10030（盖过主面板 9999，面板内弹窗 10005…' },
      { domain: '影院', text: '迁移 QuickAdd《影视数据分析.js》，src，movie，analysis…' },
      { domain: '影院', text: '新增命令 bz-movie-report 影视分析报告（AI 品味分析推荐入口，原…' },
      { domain: '其他', text: '移动端判定改用 Obsidian 官方 Platform.isMobile（win…' },
      { domain: '其他', text: '图标渲染改 getIcon 判定（命令图标不在本地清单但 Obsidian 有效，…' },
      { domain: '其他', text: '添加命令默认固化命令自带图标（tile.icon 缺省填命令 icon；无图标命令…' },
      { domain: '复习计划', text: '新增命令 bz-review-start 开始复习（进入复习流程，包装 autoJ…' },
    ]
  },
];
