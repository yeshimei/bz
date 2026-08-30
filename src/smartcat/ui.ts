/**
 * 猫 UI（移植自 SmartCatUI.js createCatContainer + SmartCat.js AppearanceManager）
 * 铁律 9 收敛：13 皮肤的全部视觉（渐变/辉光/动画）静态进 styles.css
 * （.bz-sc-skin-orange 等类），本模块只切换类；猫容器 id 保留 #smart-companion-cat（外部约定）。
 * 面板（聊天/设置）走 bz 主窗口规范：createOverlay + escManager + .bz-win-head +
 * applyMobileWindowFullscreen + openSettingsModal（用户拍板：面板样式统一 bz；
 * 2026-08-23 二次拍板：聊天/设置/数据面板桌面与移动合并一套——同一组件、
 * 同一个「移动端默认全屏」开关（smartcatMobileDefaultFullscreen），聊天头行不放 ⚙️，
 * 设置统一由小橘本体长按打开）。
 */
import { createOverlay } from '../core/dom';
import { registerAlwaysOnTop } from '../core/z-order';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { closeSettingsModal, openSettingsModal } from '../core/settings-modal';
import { tryGetSettings, getSettings, saveSettings } from '../core/settings-provider';
import { renderPathSettingRow } from '../core/path-picker';
import { normalizeMemoryDirectories } from './config';
import type { GroupDecl, SettingsSchema } from '../core/settings-schema';
import type { Appearance } from './types';

export const CAT_CONTAINER_ID = 'smart-companion-cat';

/** 13 皮肤 key 全集（basic 5 + advanced 8） */
export const SKINS: Appearance[] = ['orange', 'gray', 'black', 'white', 'calico', 'neon', 'galaxy', 'liquidMetal', 'fire', 'crystal', 'cyberpunk', 'rainbow', 'hologram'];

/** 猫本体 HTML（原 CAT_UI 模板，结构逐字：voice 指示器/思考圆点/气泡容器/cat-body） */
const CAT_HTML = `
        <!-- 语音指示器 -->
        <div class="voice-indicator" id="voice-indicator"></div>
        <div class="voice-feedback" id="voice-feedback"></div>

        <!-- 思考指示器（绿色小圆点） -->
        <div class="thinking-indicator" id="thinking-indicator"></div>

        <!-- 小橘气泡 -->
        <div class="cat-bubbles-container" id="cat-bubbles-container"></div>

        <!-- 小橘本体 -->
        <div class="cat-body" id="cat-body">
            <div class="cat-ear cat-ear-left"></div>
            <div class="cat-ear cat-ear-right"></div>
            <div class="cat-face">
                <div class="cat-eye cat-eye-left"></div>
                <div class="cat-eye cat-eye-right"></div>
                <div class="cat-nose"></div>
            </div>
            <div class="cat-tail"></div>
        </div>
`;

/** 创建猫容器（原 createCatContainer：fixed 悬浮；移动/样式收敛——定位与基础视觉进 styles.css） */
export function createCatContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = CAT_CONTAINER_ID;
  container.className = 'bz-sc-cat';
  container.innerHTML = CAT_HTML;
  return container;
}

/** 挂载猫容器（幂等：已存在则复用）；注册恒顶层——小橘保持最高（ADR-0067，用户拍板） */
export function mountCatContainer(): HTMLElement | null {
  let container = document.getElementById(CAT_CONTAINER_ID);
  if (!container) {
    container = createCatContainer();
    document.body.appendChild(container);
  }
  registerAlwaysOnTop(container);
  return container;
}

/** 卸载猫容器（含面板/遮罩） */
export function unmountCatContainer(): void {
  const ids = [CAT_CONTAINER_ID, 'settings-panel', 'chat-panel', 'panel-mask'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
}

/** 应用外观（原 AppearanceManager.applyAppearance：切类 + 事件） */
export function applyAppearance(container: HTMLElement, appearance: Appearance): void {
  if (!container) return;
  for (const skin of SKINS) container.classList.remove(`bz-sc-skin-${skin}`);
  container.classList.add(`bz-sc-skin-${appearance}`);
  // 兼容遗留：原版 .skin-<appearance> 类名（外部样式约定）
  container.classList.remove('skin-orange', 'skin-gray', 'skin-black', 'skin-white', 'skin-calico', 'skin-neon', 'skin-galaxy', 'skin-liquidMetal', 'skin-fire', 'skin-crystal', 'skin-cyberpunk', 'skin-rainbow', 'skin-hologram');
  if (appearance !== 'orange') container.classList.add(`skin-${appearance}`);
}

export interface SmartcatPanels {
  mask: HTMLElement;
  chatPopup: HTMLElement;
  chatMessages: HTMLElement;
  chatInput: HTMLTextAreaElement;
  dispose: () => void;
}

/**
 * 创建聊天面板（bz 主窗口规范：createOverlay + .bz-win-head + ❌关闭 + ESC）
 * 2026-08-23 用户拍板：头行不放 ⚙️ 设置图标——设置统一由小橘本体长按打开；
 * 移动端默认全屏由 index 每次打开调用 applyMobileWindowFullscreen。
 */
export function createChatPanel(opts: {
  onSend: (message: string) => void;
  onClose: () => void;
}): SmartcatPanels {
  const { mask, popup } = createOverlay({
    maskId: 'smartcat-chat-mask',
    popupId: 'chat-panel',
    onMaskClick: () => opts.onClose(),
    width: '92%',
    maxWidth: 350,
  });
  popup.style.maxHeight = '60vh';
  popup.style.flexDirection = 'column';

  const header = document.createElement('div');
  header.className = 'bz-win-head';
  header.innerHTML = `
    <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-normal);">小橘聊天</h3>
    <div>
      <button id="smartcat-btn-close" class="bz-win-close" title="关闭" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;width:21px;height:25px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">❌</button>
    </div>
  `;
  popup.appendChild(header);

  const chatMessages = document.createElement('div');
  chatMessages.className = 'chat-messages bz-sc-chat-messages';
  popup.appendChild(chatMessages);

  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area bz-sc-chat-input-area';
  const chatInput = document.createElement('textarea');
  chatInput.className = 'chat-input bz-sc-chat-input';
  chatInput.placeholder = '输入消息...';
  chatInput.rows = 1;
  const sendBtn = document.createElement('button');
  sendBtn.className = 'send-btn bz-sc-send-btn';
  sendBtn.textContent = '↵';
  sendBtn.addEventListener('click', () => {
    const v = chatInput.value.trim();
    if (v) opts.onSend(v);
  });
  chatInput.addEventListener('keydown', (e) => {
    // UX 30：中文输入法组合态（composition）回车是选字确认，不发送——isComposing 标准属性
    // + keyCode 229（Safari/部分浏览器组合期 keyCode 兜底）双保险；组合态直接放行交还 IME
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const v = chatInput.value.trim();
      if (v) opts.onSend(v);
    }
  });
  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);
  popup.appendChild(inputArea);

  document.body.appendChild(mask);
  document.body.appendChild(popup);
  mask.style.display = 'none';
  popup.style.display = 'none';

  header.querySelector('#smartcat-btn-close')!.addEventListener('click', () => opts.onClose());
  const handle = escManager.register('smartcat-chat', {
    isVisible: () => popup.style.display === 'flex',
    close: () => opts.onClose(),
  });

  return {
    mask,
    chatPopup: popup,
    chatMessages,
    chatInput,
    dispose: () => {
      mask.remove();
      popup.remove();
      handle.unregister();
    },
  };
}

/** 打开聊天面板（每次打开应用移动端全屏设置） */
export function showChatPanel(panels: SmartcatPanels, fullscreenEnabled: boolean): void {
  applyMobileWindowFullscreen(panels.chatPopup, fullscreenEnabled);
  panels.mask.style.display = 'block';
  panels.chatPopup.style.display = 'flex';
  panels.chatInput.focus();
}

/** 关闭聊天面板 */
export function hideChatPanel(panels: SmartcatPanels): void {
  panels.mask.style.display = 'none';
  panels.chatPopup.style.display = 'none';
}

/**
 * smartcat 设置 schema（ticket 131；ADR-0064）：外观/可视化/互动/记忆/移动端/存储与记忆/关联/显示
 * 八组。全部键为域数据（smartcat.json config 或 BzSettings 行为字段），走三函数绑定逃生口
 * （get/set/save——save 落盘顺序与落盘目标逐字保持现状）。
 * - 外观组 13 皮肤色块网格 = custom 插槽（无 Setting 行，不计徽标）；
 * - 「打开数据面板」= button 行（onOpenDashboard 缺省时不挂组）；
 * - 「移动端默认全屏」走 settingsKeys + setMobileFullscreen 外部绑定（非 BzSettings 键，手写组
 *   并带 smartcat 专属 desc）；组序 ticket 162 起移动端组位于面板末尾。
 * - ticket 100 文案修正：行为流/关联窗口数字范围去括号改写自然句（键名/行为不动）。
 * 置于模块顶层供文案 lint 直接引用；opts 仅在渲染/交互时经闭包引用，工厂构建无副作用。 */
export function smartcatSettingsSchema(opts: {
  getConfig: () => any;
  saveConfig: (config: any) => Promise<void>;
  settingsKeys: { enabled: boolean; mobileFullscreen: boolean };
  setMobileFullscreen: (v: boolean) => Promise<void>;
  /** 记忆目录变更回调（ADR-0069：index 注入——增量同步目录移除清理/新增补扫） */
  onMemoryDirectoriesChanged?: (dirs: string[]) => void;
  onOpenDashboard?: () => void;
  onAppearanceChanged?: (appearance: string) => void;
}): SettingsSchema {
  /** 域 config 键绑定（save 仅写 smartcat 数据） */
  const bindConfig = (key: string) => ({
    get: () => opts.getConfig()[key],
    set: (v: unknown) => {
      opts.getConfig()[key] = v;
    },
    save: () => opts.saveConfig(opts.getConfig()),
  });
  /** 行为字段（BzSettings）键绑定：保持双落盘（smartcat 数据 + data.json 同键），顺序照抄现状 */
  const bindBehavior = (key: string) => ({
    get: () => (tryGetSettings() as any)[key] ?? DEFAULT_BEHAVIOR[key as keyof typeof DEFAULT_BEHAVIOR],
    set: (v: unknown) => {
      (getSettings() as any)[key] = v;
    },
    save: async () => {
      await opts.saveConfig(opts.getConfig());
      await saveSettings();
    },
  });
  /** 行为字段缺省开语义（键缺失视为开） */
  const bindBehaviorOn = (key: string) => ({
    get: () => (tryGetSettings() as any)[key] !== false,
    set: (v: boolean) => {
      (getSettings() as any)[key] = v;
    },
    save: async () => {
      await opts.saveConfig(opts.getConfig());
      await saveSettings();
    },
  });
  // ===== 外观组（平铺色块选择器：13 皮肤，色块取自各皮肤主渐变；点击即换+落盘）=====
  const lookGroup: GroupDecl = {
    icon: 'palette',
    name: '外观',
    rows: [
      {
        type: 'custom',
        render: (body) => {
          const config = opts.getConfig();
          const grid = document.createElement('div');
          grid.className = 'bz-sc-skin-grid';
          for (const skin of SKINS) {
            const item = document.createElement('button');
            item.className = 'bz-sc-skin-item' + (skin === config.appearance ? ' active' : '');
            item.dataset.skin = skin;
            const swatch = document.createElement('span');
            swatch.className = 'bz-sc-skin-swatch bz-sc-skin-swatch-' + skin;
            const name = document.createElement('span');
            name.className = 'bz-sc-skin-name';
            name.textContent = skinLabel(skin);
            item.appendChild(swatch);
            item.appendChild(name);
            item.addEventListener('click', async () => {
              if (opts.getConfig().appearance === skin) return;
              opts.getConfig().appearance = skin;
              for (const n of Array.from(grid.querySelectorAll('.bz-sc-skin-item'))) n.classList.toggle('active', n === item);
              await opts.saveConfig(opts.getConfig());
              opts.onAppearanceChanged?.(skin);
            });
            grid.appendChild(item);
          }
          body.appendChild(grid);
        },
      },
    ],
  };
  // ===== 可视化组（2026-08-23 合并一套：仅保留数据面板入口；入口回调缺省时不挂组）=====
  const vizGroups: GroupDecl[] = opts.onOpenDashboard
    ? [
        {
          icon: 'bar-chart-3',
          name: '可视化',
          rows: [
            {
              type: 'button',
              name: '打开数据面板',
              desc: '查看小橘的状态全貌与每周懂你报告',
              buttonText: '打开数据面板',
              onClick: () => {
                closeSettingsModal();
                opts.onOpenDashboard!();
              },
            },
          ],
        },
      ]
    : [];
  // ===== 移动端组（settingsKeys 外部绑定；desc 为 smartcat 专属文案逐字对齐现状）=====
  const mobileGroup: GroupDecl = {
    icon: 'smartphone',
    name: '移动端',
    visibleWhen: () => isMobileEnv(),
    rows: [
      {
        type: 'toggle',
        name: '移动端默认全屏',
        desc: '移动端打开小橘窗口时默认全屏，关闭则显示常规卡片',
        binding: {
          get: () => opts.settingsKeys.mobileFullscreen,
          set: (v: boolean) => {
            opts.settingsKeys.mobileFullscreen = v;
          },
          save: () => opts.setMobileFullscreen(opts.settingsKeys.mobileFullscreen),
        },
        visibleWhen: () => isMobileEnv(),
      },
    ],
  };
  return {
    groups: [
      lookGroup,
      ...vizGroups,
      {
        icon: 'message-circle',
        name: '互动',
        rows: [
          { type: 'number', name: '自言自语间隔', desc: '小橘每隔多久主动说一句话，范围 1 到 60 分钟', binding: bindConfig('speakInterval'), min: 1, max: 60, step: 1 },
          { type: 'number', name: '说话概率', desc: '定时到来时小橘主动说话的概率，范围为十分之一到一', binding: bindConfig('speakProbability'), min: 0.1, max: 1, step: 0.1 },
          { type: 'toggle', name: '主动关心', desc: '按你的活跃时段，每周温和地主动搭话一两次', binding: bindConfig('proactiveCare') },
        ],
      },
      {
        icon: 'archive',
        name: '记忆',
        rows: [
          { type: 'number', name: '短期记忆量', desc: '保留最近多少轮对话作为短期记忆，范围 50 到 200', binding: bindConfig('shortTermMemory'), min: 50, max: 200, step: 10 },
          { type: 'number', name: '上下文字数限制', desc: '上下文内容的最大字数，设为 0 时仅取当前行', binding: bindConfig('contextLength'), min: 0, max: 1000, step: 50 },
          { type: 'number', name: '上下文分布比例', desc: '光标上下的上下文分配比例，十分之一到十分之九', binding: bindConfig('contextSplitRatio'), min: 0.1, max: 0.9, step: 0.1 },
          {
            type: 'select',
            name: '记忆打分范围',
            desc: '记忆质量打分的范围，智能模式自动分配云端与本地',
            binding: bindConfig('cloudScoring'),
            options: [
              { value: 'smart', label: '智能（推荐）' },
              { value: 'all', label: '全部（云端）' },
              { value: 'diary', label: '仅日记' },
              { value: 'local', label: '本地' },
            ],
          },
          // 首载/向量化参数（用户可调；改模型需重建记忆向量索引——删除 smartcat-memory-vectors.vec 后重扫）
          { type: 'text', name: '向量化模型', desc: '留空跟随第二大脑嵌入模型，改动后需重建记忆向量索引', binding: bindBehavior('smartcatEmbeddingModel') },
          { type: 'number', name: '分块字符上限', desc: '长笔记每块向量的最大字符数，200 到 6000，越小检索越精准', binding: bindBehavior('smartcatChunkLimitChars'), min: 200, max: 6000, step: 100 },
        ],
      },
      // ADR-0069 记忆目录（记忆目录流）：多文件夹选择（core/path-picker 多选），其内笔记进入笔记记忆库
      {
        icon: 'folder-open',
        name: '记忆目录',
        rows: [
          {
            type: 'custom',
            render: (body) => {
              renderPathSettingRow({
                parent: body,
                name: '记忆目录',
                desc: '这些文件夹内的笔记会进入小橘的记忆库（日记按时间段拆条）；移除目录会清掉对应记忆',
                mode: 'multi',
                value: normalizeMemoryDirectories((tryGetSettings() as any).memoryDirectories),
                pickerTitle: '选择记忆目录',
                pickerDesc: '选择小橘读取笔记的文件夹（可多选）',
                onChange: (list) => {
                  const next = normalizeMemoryDirectories(list);
                  (getSettings() as any).memoryDirectories = next;
                  void saveSettings();
                  opts.onMemoryDirectoriesChanged?.(next);
                },
              });
            },
          },
        ],
      },
      {
        icon: 'database',
        name: '存储与记忆',
        rows: [
          { type: 'number', name: '行为流保留天数', desc: '行为流条目最多保留 1 到 365 天，超出部分自动删除', binding: bindBehavior('behaviorMaxDays'), min: 1, max: 365, step: 1 },
          { type: 'number', name: '行为流最大条数', desc: '行为流最多保留 100 到 10000 条，超出部分删除最旧条目', binding: bindBehavior('behaviorMaxCount'), min: 100, max: 10000, step: 100 },
        ],
      },
      // ticket 160 记忆巩固；ticket 162 精简——反思攒够素材即归纳（证据池全量、洞察条数 AI 定）、
      // 行为小结为反思前置步骤（上次反思以来全部行为流→1 条，首次 24h，不占素材额度）、
      // 周报窗口=上次周报以来（首次 7 天）
      {
        icon: 'moon',
        name: '记忆巩固',
        rows: [
          { type: 'number', name: '反思观察阈值', desc: '自上次反思记忆流新增多少条观察就归纳一次洞察，范围 1 到 50', binding: bindBehavior('smartcatReflectMinNew'), min: 1, max: 50, step: 1 },
          { type: 'number', name: '引用摘录字数', desc: '反思时引用笔记原文的最大字数，设为 0 不附原文，范围 0 到 2000', binding: bindBehavior('smartcatRefExcerptLimit'), min: 0, max: 2000, step: 50 },
        ],
      },
      {
        icon: 'link',
        name: '关联',
        rows: [
          { type: 'toggle', name: '启用关联自动发现', desc: '自动为同名实体的记忆建立关联 relatedIds', binding: bindBehaviorOn('enableAutoLinking') },
          { type: 'number', name: '关联发现窗口天数', desc: '同一实体在 1 到 30 天内的记忆自动关联', binding: bindBehavior('linkWindowDays'), min: 1, max: 30, step: 1 },
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          { type: 'toggle', name: '显示行为日志', desc: '在数据面板中显示行为日志页签', binding: bindBehaviorOn('showBehaviorLog') },
        ],
      },
      // ticket 162：移动端组挪到面板末尾（原位于记忆与存储之间）
      mobileGroup,
    ],
  };
}

/** 行为字段（BzSettings）缺省值（原 bzSettings?.key ?? N 口径，number 行初始回填用） */
const DEFAULT_BEHAVIOR = {
  behaviorMaxDays: 30,
  behaviorMaxCount: 2000,
  linkWindowDays: 7,
  smartcatEmbeddingModel: '',
  smartcatChunkLimitChars: 800,
  // ticket 160 引入；ticket 162 精简（对齐 settings.ts DEFAULT_SETTINGS；仅 data.json 缺键时回填用）
  smartcatReflectMinNew: 20,
  smartcatRefExcerptLimit: 400,
} as const;

/**
 * 打开 smartcat 域设置弹窗（bz openSettingsModal；分组卡片方案 A：外观/可视化/互动/记忆 +
 * 移动端全屏，2026-08 用户拍板）。
 * 2026-08-23 合并一套：① 弹窗与聊天面板共用同一「移动端默认全屏」开关（打开即应用）；
 * ② 「每周懂你报告」入口换成「打开数据面板」（周报全文移入数据面板「报告」页签）；
 * ③ 人格成长可视化与重置成长已移除（ticket 123 UI 拍板），数据层面保留。
 * 分组：外观 palette（13 皮肤色块平铺）、可视化 bar-chart-3（数据面板）、
 * 互动 message-circle（自言自语间隔/说话概率/主动关心）、记忆 archive（记忆量/上下文/打分）、
 * 存储与记忆 database / 关联 link / 显示 eye（P3 ticket 123）；
 * 移动端 smartphone 组仅 isMobileEnv 显示。
 */
export function openSmartcatSettings(opts: {
  getConfig: () => any;
  saveConfig: (config: any) => Promise<void>;
  settingsKeys: { enabled: boolean; mobileFullscreen: boolean };
  setMobileFullscreen: (v: boolean) => Promise<void>;
  /** 弹窗关闭回调（遮罩/✕/ESC）：index 用它复位 interaction.isSettingsOpen 交互锁 */
  onClose?: () => void;
  /** 「打开数据面板」按钮回调（index 注入：关设置弹窗 → openSmartcatDashboard） */
  onOpenDashboard?: () => void;
  /** 记忆目录变更回调（ADR-0069：index 注入，同步增量同步器目录集合） */
  onMemoryDirectoriesChanged?: (dirs: string[]) => void;
  /** 选皮肤即时生效（换色块后立刻切猫容器皮肤类，不必重载插件） */
  onAppearanceChanged?: (appearance: Appearance) => void;
}): void {
  openSettingsModal({
    title: '小橘设置',
    maxWidth: 560,
    onClose: opts.onClose,
    schema: smartcatSettingsSchema(opts),
  });
  // 设置弹窗跟随同一「移动端默认全屏」开关（与聊天面板一套；桌面端 applyMobileWindowFullscreen 内部直接摘类）
  applyMobileWindowFullscreen(document.getElementById('bz-settings-modal-popup'), !!opts.settingsKeys.mobileFullscreen);
}

function skinLabel(skin: Appearance): string {
  const labels: Record<string, string> = {
    orange: '橘猫', gray: '灰猫', black: '黑猫', white: '白猫', calico: '三花猫',
    neon: '霓虹灯', galaxy: '银河星空', liquidMetal: '液态金属', fire: '火焰',
    crystal: '水晶透明', cyberpunk: '赛博朋克', rainbow: '彩虹渐变', hologram: '全息投影',
  };
  return labels[skin] || skin;
}