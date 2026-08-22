/**
 * 猫 UI（移植自 SmartCatUI.js createCatContainer + SmartCat.js AppearanceManager）
 * 铁律 9 收敛：13 皮肤的全部视觉（渐变/辉光/动画）静态进 styles.css
 * （.bz-sc-skin-orange 等类），本模块只切换类；猫容器 id 保留 #smart-companion-cat（外部约定）。
 * 面板（聊天/设置）走 bz 主窗口规范：createOverlay + escManager + .bz-win-head +
 * applyMobileWindowFullscreen + openSettingsModal（用户拍板：面板样式统一 bz）。
 */
import { Setting } from 'obsidian';
import { createOverlay } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { applyMobileWindowFullscreen, isMobileEnv } from '../core/mobile';
import { openSettingsModal } from '../core/settings-modal';
import type { Appearance } from './types';

export const CAT_CONTAINER_ID = 'smart-companion-cat';

/** 13 皮肤 key 全集（basic 5 + advanced 8） */
export const SKINS: Appearance[] = ['orange', 'gray', 'black', 'white', 'calico', 'neon', 'galaxy', 'liquidMetal', 'fire', 'crystal', 'cyberpunk', 'rainbow', 'hologram'];

export interface CatUIElements {
  catContainer: HTMLElement;
  panelMask: HTMLElement;
  chatPanel: HTMLElement;
}

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
 * 创建聊天面板（bz 主窗口规范：createOverlay + .bz-win-head + ⚙️设置 + ❌关闭 + ESC）
 * 设置走 openSettingsModal（⚙️）；移动端默认全屏由 index 每次打开调用 applyMobileWindowFullscreen。
 */
export function createChatPanel(opts: {
  onSend: (message: string) => void;
  onSettings: () => void;
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
      <button id="smartcat-btn-settings" title="设置" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;width:22px;height:26px;border-radius:4px;box-shadow:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;">⚙️</button>
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

  header.querySelector('#smartcat-btn-settings')!.addEventListener('click', () => opts.onSettings());
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

export interface SettingsModalBuildResult {
  /** 是否设置了移动端全屏行（仅移动端） */
  mobileSettable: boolean;
}

/**
 * 打开 smartcat 域设置弹窗（bz openSettingsModal；外观/性格/间隔/概率/记忆量/上下文长度/比例 + 移动端全屏）
 * 写回 data.config（smartcat.json）与 bz settings（移动端全屏）。
 */
export function openSmartcatSettings(opts: {
  getConfig: () => any;
  saveConfig: (config: any) => Promise<void>;
  settingsKeys: { enabled: boolean; mobileFullscreen: boolean };
  setMobileFullscreen: (v: boolean) => Promise<void>;
}): void {
  const config = opts.getConfig();
  openSettingsModal({
    title: '小橘设置',
    build: (el) => {
      new Setting(el)
        .setName('外观')
        .setDesc('猫咪皮肤')
        .addDropdown((dd: any) => {
          for (const skin of SKINS) dd.addOption(skin, skinLabel(skin));
          dd.setValue(config.appearance);
          dd.onChange(async (v: string) => {
            config.appearance = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('性格')
        .setDesc('对话语气')
        .addDropdown((dd: any) => {
          dd.addOption('lively', '活泼型');
          dd.addOption('quiet', '安静型');
          dd.addOption('wise', '智慧型');
          dd.addOption('cute', '萌系型');
          dd.addOption('mentor', '导师型');
          dd.setValue(config.personality);
          dd.onChange(async (v: string) => {
            config.personality = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('自言自语间隔（分钟）')
        .setDesc('1-60，默认 5')
        .addSlider((sl: any) => {
          sl.setLimits(1, 60, 1);
          sl.setValue(config.speakInterval);
          sl.onChange(async (v: number) => {
            config.speakInterval = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('说话概率')
        .setDesc('0.1-1，默认 0.3')
        .addSlider((sl: any) => {
          sl.setLimits(0.1, 1, 0.1);
          sl.setValue(config.speakProbability);
          sl.onChange(async (v: number) => {
            config.speakProbability = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('短期记忆量（轮数）')
        .setDesc('50-200，默认 50')
        .addSlider((sl: any) => {
          sl.setLimits(50, 200, 10);
          sl.setValue(config.shortTermMemory);
          sl.onChange(async (v: number) => {
            config.shortTermMemory = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('上下文字数限制')
        .setDesc('0-1000，0=仅当前行')
        .addSlider((sl: any) => {
          sl.setLimits(0, 1000, 50);
          sl.setValue(config.contextLength);
          sl.onChange(async (v: number) => {
            config.contextLength = v;
            await opts.saveConfig(config);
          });
        });

      new Setting(el)
        .setName('上下文分布比例')
        .setDesc('0.1-0.9（向上占比）')
        .addSlider((sl: any) => {
          sl.setLimits(0.1, 0.9, 0.1);
          sl.setValue(config.contextSplitRatio);
          sl.onChange(async (v: number) => {
            config.contextSplitRatio = v;
            await opts.saveConfig(config);
          });
        });

      if (isMobileEnv()) {
        new Setting(el)
          .setName('移动端默认全屏')
          .setDesc('移动端打开聊天面板时默认全屏显示（≤768px；关=常规卡）')
          .addToggle((toggle: any) =>
            toggle.setValue(!!opts.settingsKeys.mobileFullscreen).onChange(async (v: boolean) => {
              await opts.setMobileFullscreen(v);
            })
          );
      }
    },
  });
}

function skinLabel(skin: Appearance): string {
  const labels: Record<string, string> = {
    orange: '橘猫', gray: '灰猫', black: '黑猫', white: '白猫', calico: '三花猫',
    neon: '霓虹灯', galaxy: '银河星空', liquidMetal: '液态金属', fire: '火焰',
    crystal: '水晶透明', cyberpunk: '赛博朋克', rainbow: '彩虹渐变', hologram: '全息投影',
  };
  return labels[skin] || skin;
}