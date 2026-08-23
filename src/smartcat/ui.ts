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
import { closeSettingsModal, openSettingsModal } from '../core/settings-modal';
import { notice } from '../core/notice';
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

export interface SettingsModalBuildResult {
  /** 是否设置了移动端全屏行（仅移动端） */
  mobileSettable: boolean;
}

/**
 * 打开 smartcat 域设置弹窗（bz openSettingsModal；外观/人格成长可视化/间隔/概率/记忆量/
 * 上下文长度/比例 + 移动端全屏）。ADR-0023：预设「性格」下拉删除 → OCEAN+traits 可视化。
 * 2026-08-23 合并一套：① 弹窗与聊天面板共用同一「移动端默认全屏」开关（打开即应用）；
 * ② 人格成长可视化不再分端（桌面/移动同内容）；③ 「每周懂你报告」入口换成
 * 「打开数据面板」（周报全文移入数据面板「报告」页签）。
 */
export function openSmartcatSettings(opts: {
  getConfig: () => any;
  saveConfig: (config: any) => Promise<void>;
  settingsKeys: { enabled: boolean; mobileFullscreen: boolean };
  setMobileFullscreen: (v: boolean) => Promise<void>;
  /** 弹窗关闭回调（遮罩/✕/ESC）：index 用它复位 interaction.isSettingsOpen 交互锁 */
  onClose?: () => void;
  getPersonalityGrowth?: () => any;
  resetPersonalityGrowth?: () => Promise<void>;
  /** 「打开数据面板」按钮回调（index 注入：关设置弹窗 → openSmartcatDashboard） */
  onOpenDashboard?: () => void;
  /** 选皮肤即时生效（换色块后立刻切猫容器皮肤类，不必重载插件） */
  onAppearanceChanged?: (appearance: Appearance) => void;
}): void {
  const config = opts.getConfig();
  openSettingsModal({
    title: '小橘设置',
    onClose: opts.onClose,
    build: (el) => {
      // 外观：平铺色块选择器（13 皮肤，色块取自各皮肤主渐变；点击即换+落盘）
      new Setting(el)
        .setName('外观')
        .setDesc('点击色块切换猫咪皮肤');
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
      el.appendChild(grid);

      // ADR-0023：人格成长可视化（OCEAN 5 轴 + 关键特质条形）
      // 2026-08-23 合并一套：桌面/移动同内容（原「移动端不显示」分端差异删除）
      const g = opts.getPersonalityGrowth?.();
      if (g) {
        const panelEl = el.createDiv({ cls: 'bz-sc-personality-panel' });
        const bar = (label: string, v: number) =>
          `<div class="bz-sc-trait-row"><span class="bz-sc-trait-name">${label}</span>` +
          `<div class="bz-sc-trait-bar"><div class="bz-sc-trait-fill" style="width:${Math.round(Math.min(1, Math.max(0, v)) * 100)}%"></div></div>` +
          `<span class="bz-sc-trait-val">${(v * 100).toFixed(0)}</span></div>`;
        const oceanNames: Record<string, string> = {
          openness: '开放', conscientiousness: '尽责', extraversion: '外向', agreeableness: '宜人', neuroticism: '敏感',
        };
        const keyTraits: Record<string, string> = {
          warmth: '温暖', self_worth: '自我价值', others_trust: '信任他人',
          anxiety: '焦虑', humor: '幽默', beh_depth: '深度', optimism: '乐观',
        };
        let html = '<div class="bz-sc-personality-title">人格成长（随相处自动演化）</div>';
        html += '<div class="bz-sc-personality-section">OCEAN</div>';
        for (const [k, name] of Object.entries(oceanNames)) html += bar(name, g.ocean?.[k] ?? 0.5);
        html += '<div class="bz-sc-personality-section">关键特质</div>';
        for (const [k, name] of Object.entries(keyTraits)) html += bar(name, g.traits?.[k] ?? 0.5);
        panelEl.innerHTML = html;
        if (opts.resetPersonalityGrowth) {
          new Setting(el)
            .setName('重置成长')
            .setDesc('清空已演化的人格，回到新的 OCEAN 种子')
            .addButton((btn: any) => {
              btn.setButtonText('重置').onClick(async () => {
                await opts.resetPersonalityGrowth!();
                notice('人格已重置，请重新打开设置查看新种子', 'info');
              });
            });
        }
      }

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

      // 主动关心（2026-08-23 用户拍板：每周温和主动搭话；默认开）
      new Setting(el)
        .setName('主动关心')
        .setDesc('按你的活跃时段，每周温和主动搭话 1-2 次（可关）')
        .addToggle((toggle: any) =>
          toggle.setValue(!!config.proactiveCare).onChange((v: boolean) => {
            config.proactiveCare = v;
            void opts.saveConfig(config);
          })
        );

      // 云端打分范围（ADR-0025 追加决策：智能默认——省在线调用、保日记/反省/闪念质量）
      new Setting(el)
        .setName('记忆打分范围')
        .setDesc('云端 LLM 打分范围：智能=日记/反省/闪念恒 LLM、剪藏等长内容按 30 字、聊天/域事件本地；可切全部/仅日记/纯本地')
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

      // 数据面板入口（2026-08-23 用户拍板：原「每周懂你报告」行替换——周报全文移入数据面板「报告」页签）
      if (opts.onOpenDashboard) {
        new Setting(el)
          .setName('打开数据面板')
          .setDesc('查看小橘的全量状态与每周懂你报告（心情/情绪/人格/记忆/报告）')
          .addButton((btn: any) => {
            btn.setButtonText('打开数据面板').onClick(() => {
              closeSettingsModal();
              opts.onOpenDashboard!();
            });
          });
      }

      if (isMobileEnv()) {
        // 移动端默认全屏（聊天/设置/数据面板共用同一开关，2026-08-23 合并一套）
        new Setting(el)
          .setName('移动端默认全屏')
          .setDesc('移动端打开小橘聊天/设置/数据面板时默认全屏显示（≤768px；关=常规卡）')
          .addToggle((toggle: any) =>
            toggle.setValue(!!opts.settingsKeys.mobileFullscreen).onChange(async (v: boolean) => {
              await opts.setMobileFullscreen(v);
            })
          );
      }
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