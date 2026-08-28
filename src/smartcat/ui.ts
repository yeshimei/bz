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
import { Setting } from 'obsidian';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { closeSettingsModal, createSettingsGroup, openSettingsModal } from '../core/settings-modal';
import { tryGetSettings, saveSettings } from '../core/settings-provider';
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

/** 挂载猫容器（幂等：已存在则复用） */
export function mountCatContainer(): HTMLElement | null {
  let container = document.getElementById(CAT_CONTAINER_ID);
  if (!container) {
    container = createCatContainer();
    document.body.appendChild(container);
  }
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
    zIndex: 9998,
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
 * 打开 smartcat 域设置弹窗（bz openSettingsModal；分组卡片方案 A：外观/可视化/互动/记忆 +
 * 移动端全屏，2026-08 用户拍板）。
 * 2026-08-23 合并一套：① 弹窗与聊天面板共用同一「移动端默认全屏」开关（打开即应用）；
 * ② 「每周懂你报告」入口换成「打开数据面板」（周报全文移入数据面板「报告」页签）；
 * ③ 人格成长可视化与重置成长已移除（ticket 123 UI 拍板），数据层面保留。
 * 分组：外观 palette（13 皮肤色块平铺）、可视化 bar-chart-3（数据面板）、
 * 互动 message-circle（自言自语间隔/说话概率/主动关心）、记忆 archive（记忆量/上下文/打分）；
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
  /** 选皮肤即时生效（换色块后立刻切猫容器皮肤类，不必重载插件） */
  onAppearanceChanged?: (appearance: Appearance) => void;
}): void {
  const config = opts.getConfig();
  openSettingsModal({
    title: '小橘设置',
    maxWidth: 560,
    onClose: opts.onClose,
    build: (el) => {
      // ===== 外观组（平铺色块选择器：13 皮肤，色块取自各皮肤主渐变；点击即换+落盘） =====
      const lookGroup = createSettingsGroup(el, { icon: 'palette', name: '外观' });
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
          if (config.appearance === skin) return;
          config.appearance = skin;
          for (const n of Array.from(grid.querySelectorAll('.bz-sc-skin-item'))) n.classList.toggle('active', n === item);
          await opts.saveConfig(config);
          opts.onAppearanceChanged?.(skin);
        });
        grid.appendChild(item);
      }
      lookGroup.appendChild(grid);

      // ===== 可视化组（2026-08-23 合并一套：人格成长可视化与重置已移除，仅保留数据面板入口） =====
      if (opts.onOpenDashboard) {
        const vizGroup = createSettingsGroup(el, { icon: 'bar-chart-3', name: '可视化' });
        // 数据面板入口（归可视化组；周报全文在面板「报告」页签）
        new Setting(vizGroup)
          .setName('打开数据面板')
          .setDesc('查看小橘的状态全貌与每周懂你报告')
          .addButton((btn: any) => {
            btn.setButtonText('打开数据面板').onClick(() => {
              closeSettingsModal();
              opts.onOpenDashboard!();
            });
          });
      }

      // ===== 互动组（陪伴说话节奏 + 主动关心） =====
      const chatGroup = createSettingsGroup(el, { icon: 'message-circle', name: '互动' });
      new Setting(chatGroup)
        .setName('自言自语间隔')
        .setDesc('小橘每隔多久主动说一句话，范围 1 到 60 分钟')
        .addSlider((sl: any) => {
          sl.setLimits(1, 60, 1);
          sl.setValue(config.speakInterval);
          sl.onChange(async (v: number) => {
            config.speakInterval = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(chatGroup)
        .setName('说话概率')
        .setDesc('定时到来时小橘主动说话的概率，范围 0.1 到 1')
        .addSlider((sl: any) => {
          sl.setLimits(0.1, 1, 0.1);
          sl.setValue(config.speakProbability);
          sl.onChange(async (v: number) => {
            config.speakProbability = v;
            await opts.saveConfig(config);
          });
        });

      // ===== 记忆组（记忆量、上下文预算与打分范围） =====
      const memGroup = createSettingsGroup(el, { icon: 'archive', name: '记忆' });
      new Setting(memGroup)
        .setName('短期记忆量')
        .setDesc('保留最近多少轮对话作为短期记忆，范围 50 到 200')
        .addSlider((sl: any) => {
          sl.setLimits(50, 200, 10);
          sl.setValue(config.shortTermMemory);
          sl.onChange(async (v: number) => {
            config.shortTermMemory = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(memGroup)
        .setName('上下文字数限制')
        .setDesc('上下文内容的最大字数，设为 0 时仅取当前行')
        .addSlider((sl: any) => {
          sl.setLimits(0, 1000, 50);
          sl.setValue(config.contextLength);
          sl.onChange(async (v: number) => {
            config.contextLength = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(memGroup)
        .setName('上下文分布比例')
        .setDesc('光标上下的上下文分配比例，范围 0.1 到 0.9')
        .addSlider((sl: any) => {
          sl.setLimits(0.1, 0.9, 0.1);
          sl.setValue(config.contextSplitRatio);
          sl.onChange(async (v: number) => {
            config.contextSplitRatio = v;
            await opts.saveConfig(config);
          });
        });

      // 主动关心（2026-08-23 用户拍板：每周温和主动搭话；默认开；归互动组）
      new Setting(chatGroup)
        .setName('主动关心')
        .setDesc('按你的活跃时段，每周温和地主动搭话一两次')
        .addToggle((toggle: any) =>
          toggle.setValue(!!config.proactiveCare).onChange((v: boolean) => {
            config.proactiveCare = v;
            void opts.saveConfig(config);
          })
        );

      // 云端打分范围（ADR-0025 追加决策：智能默认——省在线调用、保日记/反省/闪念质量；归记忆组）
      new Setting(memGroup)
        .setName('记忆打分范围')
        .setDesc('记忆质量打分的范围，智能模式自动分配云端与本地')
        .addDropdown((dd: any) => {
          dd.addOption('smart', '智能（推荐）');
          dd.addOption('all', '全部（云端）');
          dd.addOption('diary', '仅日记');
          dd.addOption('local', '本地');
          dd.setValue(config.cloudScoring || 'smart');
          dd.onChange(async (v: string) => {
            config.cloudScoring = v;
            await opts.saveConfig(config);
          });
        });

      if (isMobileEnv()) {
        // 移动端默认全屏（聊天/设置/数据面板共用同一开关，2026-08-23 合并一套）
        const mobileGroup = createSettingsGroup(el, { icon: 'smartphone', name: '移动端' });
        new Setting(mobileGroup)
          .setName('移动端默认全屏')
          .setDesc('移动端打开小橘窗口时默认全屏，关闭则显示常规卡片')
          .addToggle((toggle: any) =>
            toggle.setValue(!!opts.settingsKeys.mobileFullscreen).onChange(async (v: boolean) => {
              await opts.setMobileFullscreen(v);
            })
          );
      }

      // ===== 存储与记忆组（P3 ticket 123：行为流保留策略） =====
      const storageGroup = createSettingsGroup(el, { icon: 'database', name: '存储与记忆' });
      const bzSettings = tryGetSettings() as any;
      new Setting(storageGroup)
        .setName('行为流保留天数')
        .setDesc('行为流条目最多保留多少天（1-365），超出部分自动删除')
        .addSlider((sl: any) => {
          sl.setLimits(1, 365, 1);
          sl.setValue(bzSettings?.behaviorMaxDays ?? 30);
          sl.onChange(async (v: number) => {
            bzSettings.behaviorMaxDays = v;
            await opts.saveConfig(config);
            await saveSettings();
          });
        });

      new Setting(storageGroup)
        .setName('行为流最大条数')
        .setDesc('行为流最多保留多少条（100-10000），超出部分删除最旧条目')
        .addSlider((sl: any) => {
          sl.setLimits(100, 10000, 100);
          sl.setValue(bzSettings?.behaviorMaxCount ?? 2000);
          sl.onChange(async (v: number) => {
            bzSettings.behaviorMaxCount = v;
            await opts.saveConfig(config);
            await saveSettings();
          });
        });

      // ===== 关联组（P3 ticket 123：自动关联发现） =====
      const linkGroup = createSettingsGroup(el, { icon: 'link', name: '关联' });
      new Setting(linkGroup)
        .setName('启用关联自动发现')
        .setDesc('自动为同名实体的记忆建立关联（relatedIds）')
        .addToggle((toggle: any) =>
          toggle.setValue(bzSettings?.enableAutoLinking !== false).onChange(async (v: boolean) => {
            bzSettings.enableAutoLinking = v;
            await opts.saveConfig(config);
            await saveSettings();
          })
        );

      new Setting(linkGroup)
        .setName('关联发现窗口天数')
        .setDesc('同一实体在多少天内的记忆自动关联（1-30）')
        .addSlider((sl: any) => {
          sl.setLimits(1, 30, 1);
          sl.setValue(bzSettings?.linkWindowDays ?? 7);
          sl.onChange(async (v: number) => {
            bzSettings.linkWindowDays = v;
            await opts.saveConfig(config);
            await saveSettings();
          });
        });

      // ===== 显示组（P3 ticket 123：行为日志开关） =====
      const displayGroup = createSettingsGroup(el, { icon: 'eye', name: '显示' });
      new Setting(displayGroup)
        .setName('显示行为日志')
        .setDesc('在数据面板中显示行为日志页签')
        .addToggle((toggle: any) =>
          toggle.setValue(bzSettings?.showBehaviorLog !== false).onChange(async (v: boolean) => {
            bzSettings.showBehaviorLog = v;
            await opts.saveConfig(config);
            await saveSettings();
          })
        );
    },
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