/**
 * smartcat 域入口（小橘陪伴猫）
 * ensureSmartCat 幂等懒加载：挂载猫容器 + 装配全部子系统 + 常驻监听
 * （file-open 书评 / visibilitychange 欢迎回来 / 跟随（30 分钟空闲靠近鼠标）/ 记忆固化）。
 * unloadSmartCat 全量清理。命令回调：open（召唤显示）/ chat（聊天）/ hide（隐藏）。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { loadSmartCatData, saveSmartCatData, getSmartcatFilePath } from './data';
import { eventSystem, setSmartcatApp, setupVisibilityCheck, __resetVisibilityForTests } from './state';
import { mountCatContainer, unmountCatContainer, applyAppearance, createChatPanel, showChatPanel, hideChatPanel, openSmartcatSettings } from './ui';
import { BubbleManager, EmojiProcessor } from './bubble';
import { MoodSystem, PersonalityGrowth } from './mood';
import { MemorySystem } from './memory';
import { SmartCatAnimation } from './animation';
import { VoiceCommandSystem } from './voice';
import { InteractionManager, MobileInputAdapter } from './interaction';
import { getSmartCatMessage } from './messages';
import { generatePrompt } from './prompts';
import { callChat, isAIConfigured } from './api';
import { generateBookDescription, hasBookTag } from './content';
import type { SmartCatData, SmartCatConfig } from './types';
import type { SmartcatPanels } from './ui';

let initialized = false;
let appRef: App | null = null;
let data: SmartCatData | null = null;
let bubbleManager: BubbleManager | null = null;
let moodSystem: MoodSystem | null = null;
let personalityGrowth: PersonalityGrowth | null = null;
let memorySystem: MemorySystem | null = null;
let animation: SmartCatAnimation | null = null;
let voiceSystem: VoiceCommandSystem | null = null;
let interaction: InteractionManager | null = null;
let mobileAdapter: MobileInputAdapter | null = null;
let panels: SmartcatPanels | null = null;
let fileOpenRef: any = null;
let visibilityCleanup: (() => void) | null = null;
let followTimer: ReturnType<typeof setInterval> | null = null;
let greetTimer: ReturnType<typeof setTimeout> | null = null;
let lastPetTime = Date.now();

const dataProvider = (): SmartCatData => {
  if (!data) throw new Error('smartcat: 数据未加载');
  return data;
};
const dataSaver = async (d: SmartCatData): Promise<void> => {
  data = d;
  if (appRef) await saveSmartCatData(appRef, d);
};

/** 域配置读取（供 interaction） */
function getConfig(): SmartCatConfig {
  return dataProvider().config;
}
async function saveConfig(c: SmartCatConfig): Promise<void> {
  const d = dataProvider();
  d.config = c;
  await dataSaver(d);
}

/** 幂等初始化（懒加载；命令/onLayoutReady 触发） */
export async function ensureSmartCat(app: App): Promise<void> {
  if (initialized) return;
  initialized = true;
  appRef = app;
  setSmartcatApp(app);

  data = await loadSmartCatData(app);
  // 竞态守卫：等待期间若被 unload（main 的 void ensureSmartCat 是 fire-and-forget），停止装配
  if (!initialized) {
    data = null;
    return;
  }
  // 用户拍板：所有数据单 json——首次无文件时也落盘一次（迁移或在空账本上建文件）
  if (!app.vault.getAbstractFileByPath(getSmartcatFilePath())) {
    await saveSmartCatData(app, data);
  }
  // 竞态守卫 1.5：首次落盘等待期间被 unload 则停止装配
  if (!initialized) {
    data = null;
    return;
  }

  // ---- 子系统装配（顺序与原 SmartCompanionApp 一致） ----
  bubbleManager = new BubbleManager();
  moodSystem = new MoodSystem(app, dataProvider, dataSaver);
  personalityGrowth = new PersonalityGrowth(dataProvider, dataSaver);
  memorySystem = new MemorySystem(app, dataProvider, dataSaver);
  // ADR-0021：init = 探测 Ollama + 加载向量 + 反思调度（取代原 24h 固化调度）
  await memorySystem.init();
  if (!initialized) return; // 竞态守卫 2：init 期间被 unload 则丢弃装配
  // 反思驱动人格（心情重构：洞察 → PersonalityGrowth.applyReflectionInsights）
  memorySystem.onReflect = async (insights) => {
    if (personalityGrowth && insights && insights.length) {
      await personalityGrowth.applyReflectionInsights(insights);
    }
  };

  // 猫容器 + 皮肤 + 动画 + 指示器
  const container = mountCatContainer()!;
  applyAppearance(container, data.config.appearance);
  animation = new SmartCatAnimation(container);
  animation.initialize();
  // 100ms 后问候（原 SmartCatAnimation module.exports greet；定时器挂模块级供 unload 清理）
  greetTimer = setTimeout(() => animation?.greet(), 100);

  // 气泡 emoji 抽离 → 心情指示器（原 moodIndicator.showCustomMood 语义：挂 mood-emoji 数据 + 5s 隐藏）
  bubbleManager.onEmojiDetached = (icon: string) => {
    if (container) container.dataset.moodEmoji = icon;
    setTimeout(() => {
      if (container) delete container.dataset.moodEmoji;
    }, 5000);
  };

  // 语音
  voiceSystem = new VoiceCommandSystem({
    openSettings: () => openSettings(),
    openChat: () => openChat(),
    closePanels: () => {
      closeChat();
      closeSettings();
    },
    startReview: () => {
      try {
        (app as any).commands?.executeCommandById?.('bz-review-open');
        bubbleManager!.showBubble('开始复习笔记啦！加油哦～');
      } catch (e) {
        bubbleManager!.showBubble('复习计划功能暂不可用');
      }
    },
    casualChat: async (message) => {
      try {
        const personality = getConfig().personality;
        const prompt = generatePrompt('casual_chat', message, { pad: moodSystem!.pad, personality, currentMood: moodSystem!.currentMood, currentEmotion: moodSystem!.getCurrentEmotion() });
        const response = await callChat([
          { role: 'system', content: prompt },
          { role: 'user', content: `用户说："${message}"。请用简短的一句话回复。` },
        ]);
        if (response) bubbleManager!.showBubble(response);
      } catch (error) {
        bubbleManager!.showBubble('语音回复失败，请稍后再试');
      }
    },
  });
  voiceSystem.onShowBubble = (msg) => bubbleManager!.showBubble(msg);

  // 交互
  interaction = new InteractionManager({
    config: getConfig,
    saveConfig,
    bubble: bubbleManager,
    mood: moodSystem,
    voice: voiceSystem,
    openChat: () => openChat(),
    closeChat: () => closeChat(),
    openSettings: () => openSettings(),
    closeSettings: () => closeSettings(),
    onAppearanceChanged: (appearance) => {
      applyAppearance(mountCatContainer()!, appearance as any);
    },
    // ADR-0021：记忆流检索注入聊天上下文（格式化后返回；失败返回空串）
    retrieveMemories: async (query: string) => {
      if (!memorySystem) return '';
      try {
        const memories = await memorySystem.retrieve(query);
        return memories.length ? memorySystem.formatMemoriesForPrompt(memories) : '';
      } catch (e) {
        return '';
      }
    },
  });
  interaction.setupInteractions();

  // 移动端输入法适配
  mobileAdapter = new MobileInputAdapter(container);

  // ---- 常驻监听 ----
  // file-open → 书评（原 ContentMonitor.setupNoteSwitchDetection：book 标签笔记首次打开生成一句话书评）
  fileOpenRef = (app.workspace as any).on('file-open', (file: any) => {
    if (!file) return;
    eventSystem.emit('fileOpened', { file });
    void generateBookReview();
  });

  // visibilitychange → 欢迎回来（离开超 60s 才允许）
  visibilityCleanup = setupVisibilityCheck({
    onLeaveLong: () => { /* 允许回程语 */ },
    onBack: () => {
      if (!appRef) return;
      const hour = new Date().getHours();
      let timeBasedMessages: string[] = [];
      if (hour >= 5 && hour < 12) timeBasedMessages = ['早晨好！新的一天开始啦！🌅', '早安！今天也要元气满满哦！', '清晨的阳光迎接你的归来~', '早上好！思维最清晰的时刻到了！'];
      else if (hour >= 12 && hour < 18) timeBasedMessages = ['下午好！继续上午的创作吧！', '午安~ 休息后思路更清晰！', '下午时光，正是创作好时节~', '日正当中，灵感正盛！'];
      else timeBasedMessages = ['晚上好！宁静的夜晚适合思考~', '晚安前的创作时间到了！', '星空下的灵感特别美丽~', '夜晚是思维最活跃的时候呢！'];
      if (Math.random() > 0.5) {
        bubbleManager!.showBubble(timeBasedMessages[Math.floor(Math.random() * timeBasedMessages.length)]);
      } else {
        bubbleManager!.showBubble(getSmartCatMessage('WELCOME_BACK_MESSAGES'));
      }
    },
  });

  // 跟随：30 分钟空闲 → 靠近鼠标位置（原 SmartCatPluginFollow 逻辑并入）
  (window as any).mousePosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  document.addEventListener('mousemove', windowMouseMove);
  followTimer = setInterval(() => {
    if (Date.now() - lastPetTime >= 30 * 60 * 1000 && !(interaction as any)?.isDragging) {
      triggerCatMovement();
    }
  }, 30000);

  eventSystem.emit('appInitialized');
}

function windowMouseMove(e: MouseEvent): void {
  (window as any).mousePosition = { x: e.clientX, y: e.clientY };
}

/** 跟随移动（原 PluginFollow.moveCatTo：百分比定位 + 跑步/走路动画 + 3s 后回原位） */
function triggerCatMovement(): void {
  const container = document.getElementById('smart-companion-cat');
  if (!container) return;
  if ((container as any).isMoving) return;
  (container as any).isMoving = true;
  const original = { x: 50, y: 100 };
  const mouse = (window as any).mousePosition || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const mouseX = (mouse.x / window.innerWidth) * 100;
  const mouseY = (mouse.y / window.innerHeight) * 100;
  const offset = 5 + Math.random() * 10;
  const randomAngle = Math.random() * Math.PI * 2;
  const targetX = Math.max(5, Math.min(95, mouseX + Math.cos(randomAngle) * offset));
  const targetY = Math.max(5, Math.min(95, mouseY + Math.sin(randomAngle) * offset));
  const currentX = parseFloat(container.style.left) || 50;
  const currentY = parseFloat(container.style.top) || 100;
  const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
  const duration = Math.max(2000, Math.min(5000, distance * 50));
  container.classList.add(distance > 10 ? 'cat-running' : 'cat-walking');
  container.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
  container.style.left = targetX + '%';
  container.style.top = targetY + '%';
  setTimeout(() => {
    container.classList.remove('cat-running', 'cat-walking');
    bubbleManager!.showBubble(getSmartCatMessage('LITTLE_ORANGE_COMPLAINTS'));
    lastPetTime = Date.now();
    (container as any).isMoving = false;
    setTimeout(() => {
      if ((container as any).isMoving) return;
      (container as any).isMoving = true;
      container.classList.add('cat-walking');
      const returnDuration = 4000;
      container.style.transition = `left ${returnDuration}ms ease-in-out, top ${returnDuration}ms ease-in-out`;
      container.style.left = original.x + '%';
      container.style.top = original.y + '%';
      setTimeout(() => {
        container.classList.remove('cat-walking');
        (container as any).isMoving = false;
        setTimeout(() => {
          container.style.left = original.x + '%';
          container.style.top = original.y + '%';
        }, 100);
      }, returnDuration);
    }, 3000);
  }, duration);
}

/** 书评（原 ContentMonitor.generateBookReview：book 标签笔记首次打开一句话评价） */
async function generateBookReview(): Promise<void> {
  if (!appRef || !data || !bubbleManager || !moodSystem) return;
  try {
    const app = appRef;
    // 仅当当前笔记带 book 标签才生成；每文件一次（dom 内 Set 记忆）
    if (!hasBookTag()) return;
    const bookDescription = generateBookDescription();
    if (!bookDescription) return;
    const cfg = getConfig();
    const prompt = generatePrompt('book_review', `请基于以下书籍数据给出简短评价：${bookDescription}`, {
      pad: moodSystem.pad,
      personality: cfg.personality,
      currentMood: moodSystem.currentMood,
      currentEmotion: moodSystem.getCurrentEmotion(),
    });
    const response = await callChat([
      { role: 'system', content: prompt },
      { role: 'user', content: '请用简短的一句话给出评价或建议。' },
    ]);
    if (response) {
      // 原版 showBubble(message, '🎓') 第二参当 duration（铁律 4 保留）
      (bubbleManager as any).showBubble(response, '🎓');
    }
  } catch (error) {
    console.error('[smartcat] 书评失败:', error);
  }
}

// ---------------- 命令回调 ----------------

/** 打开（召唤/显示小橘） */
export async function openSmartCat(app: App): Promise<void> {
  await ensureSmartCat(app);
}

/** 打开聊天面板 */
export async function openSmartCatChat(app: App): Promise<void> {
  await ensureSmartCat(app);
  openChat();
}

/** 隐藏小橘（卸载 DOM 与常驻，数据保留） */
export function hideSmartCat(): void {
  if (!initialized) return;
  closeChat();
  closeSettings();
  unmountCatContainer();
  const c = document.getElementById('smart-companion-cat');
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

/** 打开聊天面板（挂猫容器 + 建面板 + 显示） */
function openChat(): void {
  if (!initialized || !appRef) return;
  if (!document.getElementById('chat-panel')) {
    panels = createChatPanel({
      onSend: (message) => void sendChatMessage(message),
      onSettings: () => openSettings(),
      onClose: () => closeChat(),
    });
  }
  if (!panels) return;
  const s = getSettings() as any;
  showChatPanel(panels, s.smartcatMobileDefaultFullscreen === true);
  renderChatHistory();
  if (interaction) {
    interaction.isChatOpen = true;
    interaction.isSettingsOpen = false;
  }
}

function closeChat(): void {
  if (panels) hideChatPanel(panels);
  if (interaction) {
    interaction.isChatOpen = false;
    interaction.isSettingsOpen = false;
  }
}

/** 打开设置弹窗（⚙️ / 长按 / 五击） */
function openSettings(): void {
  if (!initialized) return;
  openSmartcatSettings({
    getConfig,
    saveConfig,
    settingsKeys: {
      enabled: true,
      mobileFullscreen: (getSettings() as any).smartcatMobileDefaultFullscreen === true,
    },
    setMobileFullscreen: async (v) => {
      (getSettings() as any).smartcatMobileDefaultFullscreen = v;
      await saveSettings();
    },
  });
  if (interaction) {
    interaction.isSettingsOpen = true;
    interaction.isChatOpen = false;
  }
}

function closeSettings(): void {
  // 设置弹窗由 openSettingsModal 管理（mask/ESC 关闭）；此处只清状态
  if (interaction) {
    interaction.isSettingsOpen = false;
    interaction.isChatOpen = false;
  }
}

/** 渲染历史消息 */
function renderChatHistory(): void {
  if (!panels || !data) return;
  panels.chatMessages.innerHTML = '<div class="message cat-message">你好！我是你的笔记陪伴小橘，可以基于你的笔记内容和你聊天~</div>';
  const history = data.config.conversationHistory || [];
  history.forEach((chat) => {
    const div = document.createElement('div');
    div.className = chat.role === 'user' ? 'message user-message' : 'message cat-message';
    div.textContent = chat.content;
    panels!.chatMessages.appendChild(div);
  });
  panels.chatMessages.scrollTop = panels.chatMessages.scrollHeight;
}

/** 发聊天消息（原 InteractionManager.sendMessage：历史 + AI 回复打字机） */
async function sendChatMessage(message: string): Promise<void> {
  if (!panels || !data || !interaction || !bubbleManager) return;
  const chatMessages = panels.chatMessages;
  const chatInput = panels.chatInput;

  const userMessageEl = document.createElement('div');
  userMessageEl.className = 'message user-message';
  userMessageEl.textContent = message;
  chatMessages.appendChild(userMessageEl);
  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'message cat-message';
  typingIndicator.textContent = '小橘正在思考...';
  typingIndicator.id = 'typing-indicator';
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const messages = await interaction.prepareChatMessages(message);
    const response = await callChat(messages);
    const indicator = chatMessages.querySelector('#typing-indicator');
    if (indicator) indicator.remove();

    const catMessageEl = document.createElement('div');
    catMessageEl.className = 'message cat-message';
    chatMessages.appendChild(catMessageEl);
    await typewriterEffect(catMessageEl, response, 30);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    data.config.conversationHistory = data.config.conversationHistory || [];
    data.config.conversationHistory.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    data.config.conversationHistory.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    await dataSaver(data);
    // 记忆流（ADR-0021）：对话写入 observation（写入面最小化——仅聊天接入；importance LLM 打分，
    // AI 未配置降级规则分；Ollama 可用时同期写向量）
    await memorySystem!.addObservation(`用户说：${message}`, { source: 'chat' });
  } catch (error) {
    const indicator = chatMessages.querySelector('#typing-indicator');
    if (indicator) indicator.remove();
    const errorMessageEl = document.createElement('div');
    errorMessageEl.className = 'message cat-message';
    chatMessages.appendChild(errorMessageEl);
    const errorText = '抱歉，我现在无法回复。请检查API密钥设置或网络连接。';
    await typewriterEffect(errorMessageEl, errorText, 30);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

/** 打字机效果（原 typewriterEffect 逐字） */
function typewriterEffect(element: HTMLElement, text: string, speed = 30): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    element.textContent = '';
    const timer = setInterval(() => {
      if (index < text.length) {
        element.textContent += text[index];
        index++;
        if (panels) panels.chatMessages.scrollTop = panels.chatMessages.scrollHeight;
      } else {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

/** 卸载清理 */
export function unloadSmartCat(): void {
  if (!initialized) return;
  initialized = false;
  if (fileOpenRef && appRef) {
    try {
      (appRef.workspace as any).offref(fileOpenRef);
    } catch (e) { /* 忽略 */ }
    fileOpenRef = null;
  }
  if (visibilityCleanup) {
    visibilityCleanup();
    visibilityCleanup = null;
  }
  if (followTimer) {
    clearInterval(followTimer);
    followTimer = null;
  }
  if (greetTimer) {
    clearTimeout(greetTimer);
    greetTimer = null;
  }
  document.removeEventListener('mousemove', windowMouseMove);
  animation?.dispose();
  memorySystem?.stopScheduler();
  moodSystem?.dispose();
  interaction?.dispose();
  voiceSystem?.destroy();
  mobileAdapter?.destroy();
  if (panels) {
    panels.dispose();
    panels = null;
  }
  unmountCatContainer();
  __resetVisibilityForTests();
  bubbleManager = null;
  moodSystem = null;
  personalityGrowth = null;
  memorySystem = null;
  animation = null;
  voiceSystem = null;
  interaction = null;
  mobileAdapter = null;
  appRef = null;
  data = null;
}

/** 测试辅助：获取内部实例引用 */
export function __getSmartcatInternals(): any {
  return { data, bubbleManager, moodSystem, memorySystem, animation, interaction, panels, voiceSystem, initialized };
}