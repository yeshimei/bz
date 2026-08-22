/**
 * 语音系统（移植自 SmartCat.js VoiceCommandSystem + InteractionManager 语音）
 * Web Speech API（zh-CN）。触发词匹配 → 注册表指令（打开设置/聊天/复习）；未命中 → 普通聊天。
 * 桌面端刻意禁用（原版三击提示「语音识别在桌面端会闪退，暂不支持」）。
 */
export const TRIGGER_WORDS = ['小猫', '猫猫', '小橘', '猫咪', '喵喵', '猫', '橘猫', '猫猫猫', '猫猫猫猫'];

export interface VoiceCommand {
  keywords: string[];
  handler: (content: string) => Promise<void> | void;
  usage: number;
}

export class VoiceCommandSystem {
  private commandRegistry = new Map<string, VoiceCommand>();
  private speechRecognition: any = null;
  isListening = false;
  private speechTimeout: ReturnType<typeof setTimeout> | null = null;
  onShowBubble: ((msg: string) => void) | null = null;

  constructor(private handlers: {
    openSettings: () => void;
    openChat: () => void;
    closePanels: () => void;
    startReview: () => void;
    casualChat: (message: string) => Promise<void>;
  }) {
    this.setupCommandRegistry();
  }

  private registerCommand(keywords: string[], handler: (content: string) => Promise<void> | void): void {
    const command: VoiceCommand = { keywords, handler, usage: 0 };
    for (const keyword of keywords) this.commandRegistry.set(keyword.toLowerCase(), command);
  }

  private setupCommandRegistry(): void {
    this.registerCommand(['打开设置', '设置面板', '打开配置', '设置'], () => this.handlers.openSettings());
    this.registerCommand(['打开聊天', '聊天面板', '开始聊天', '聊天'], () => this.handlers.openChat());
    this.registerCommand(['关闭设置', '关闭聊天'], () => this.handlers.closePanels());
    this.registerCommand(['复习', '复习笔记', '开始复习'], () => this.handlers.startReview());
  }

  /** 是否为指令触发（原 isCommandTriggered 逐字：开头/含空格包围/逗号后） */
  isCommandTriggered(transcript: string): boolean {
    const lower = transcript.toLowerCase();
    return TRIGGER_WORDS.some((word) => {
      const w = word.toLowerCase();
      return lower.startsWith(w) || lower.includes(` ${w} `) || lower.startsWith(`${w}，`) || lower.startsWith(`${w} `);
    });
  }

  /** 提取指令内容（原 extractCommandContent 逐字） */
  extractCommandContent(transcript: string): string {
    let content = transcript;
    for (const word of TRIGGER_WORDS) {
      const lowerWord = word.toLowerCase();
      const lowerTranscript = transcript.toLowerCase();
      if (lowerTranscript.startsWith(lowerWord)) {
        content = transcript.slice(word.length).trim();
        content = content.replace(/^[，。！？\s]+/, '');
        break;
      }
      const pattern = new RegExp(`(.+?)${lowerWord}(.+)`, 'i');
      const match = transcript.match(pattern);
      if (match) {
        content = match[2].trim();
        break;
      }
    }
    return content;
  }

  /** 相似度（原 calculateSimilarity：编辑距离归一） */
  calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  /** 编辑距离（原 editDistance 逐字） */
  editDistance(s1: string, s2: string): number {
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    const costs: number[] = [];
    for (let i = 0; i <= a.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= b.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (a.charAt(i - 1) !== b.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[b.length] = lastValue;
    }
    return costs[b.length];
  }

  /** 模糊匹配（原 fuzzyMatchCommand：注册表相似度 ≥0.7；否则包含关系 0.7 保底） */
  fuzzyMatchCommand(command: string): { command: VoiceCommand; confidence: number } | null {
    let bestMatch: { command: VoiceCommand; confidence: number } | null = null;
    let bestScore = 0;
    for (const [keyword, cmd] of this.commandRegistry) {
      const score = this.calculateSimilarity(command, keyword);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { command: cmd, confidence: score };
      }
    }
    if (bestScore < 0.7) {
      for (const [keyword, cmd] of this.commandRegistry) {
        if (command.includes(keyword) || keyword.includes(command)) {
          const score = Math.max(0.7, bestScore);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { command: cmd, confidence: score };
          }
        }
      }
    }
    return bestMatch;
  }

  /** 主处理（原 handleVoiceCommand：触发词 → 精确/模糊 → 普通聊天） */
  async handleVoiceCommand(transcript: string): Promise<void> {
    const originalCommand = transcript.trim();
    if (this.onShowBubble) this.onShowBubble(`你说: "${originalCommand}"`);

    if (this.isCommandTriggered(originalCommand)) {
      const commandContent = this.extractCommandContent(originalCommand);
      if (!commandContent) {
        if (this.onShowBubble) this.onShowBubble('我在听呢，请告诉我你要做什么～');
        return;
      }
      const exactMatch = this.commandRegistry.get(commandContent.toLowerCase());
      if (exactMatch) {
        exactMatch.usage++;
        return await exactMatch.handler(commandContent);
      }
      const fuzzyMatch = this.fuzzyMatchCommand(commandContent);
      if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
        fuzzyMatch.command.usage++;
        return await fuzzyMatch.command.handler(commandContent);
      }
      // AI 指令识别在 bz 化后不再走（语音识别本身降级为固定指令 + 普通聊天）
      if (this.onShowBubble) this.onShowBubble('我好像不太明白这个指令呢，试试其他命令吧～');
      return;
    }
    return await this.handlers.casualChat(originalCommand);
  }

  /** 初始化（原 initializeSpeechRecognition：不支持则提示） */
  initializeSpeechRecognition(): any {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      if (this.onShowBubble) this.onShowBubble('抱歉，你的浏览器不支持语音识别功能');
      return null;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.isListening = true;
      this.speechTimeout = setTimeout(() => {
        if (this.isListening) this.stopSpeechRecognition();
      }, 15000);
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const finalResult = results[results.length - 1];
      if (!finalResult.isFinal) return;
      const alternatives = Array.from(finalResult)
        .map((alt: any) => ({ transcript: alt.transcript, confidence: alt.confidence }))
        .sort((a: any, b: any) => b.confidence - a.confidence);
      if (alternatives.length > 0) {
        setTimeout(() => {
          void this.handleVoiceCommand(alternatives[0].transcript);
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      this.isListening = false;
      if (this.speechTimeout) clearTimeout(this.speechTimeout);
      const errorMessages: Record<string, string> = {
        'no-speech': '没有检测到语音',
        'audio-capture': '无法访问麦克风',
        'not-allowed': '麦克风访问被拒绝',
        network: '网络错误',
        aborted: '语音识别被中止',
      };
      if (this.onShowBubble) this.onShowBubble(errorMessages[event.error] || '语音识别出现错误');
    };

    recognition.onend = () => {
      this.isListening = false;
      if (this.speechTimeout) clearTimeout(this.speechTimeout);
    };

    this.speechRecognition = recognition;
    return recognition;
  }

  /** 切换（原 toggleSpeechRecognition） */
  toggleSpeechRecognition(): void {
    if (!this.speechRecognition) {
      this.speechRecognition = this.initializeSpeechRecognition();
      if (!this.speechRecognition) return;
    }
    if (this.isListening) {
      this.stopSpeechRecognition();
      if (this.onShowBubble) this.onShowBubble('语音识别已停止');
    } else {
      try {
        this.speechRecognition.start();
      } catch (error) {
        if (this.onShowBubble) this.onShowBubble('启动语音识别失败，请检查麦克风权限');
      }
    }
  }

  stopSpeechRecognition(): void {
    if (this.speechRecognition && this.isListening) {
      try {
        this.speechRecognition.stop();
      } catch (error) { /* 忽略 */ }
      this.isListening = false;
    }
  }

  destroy(): void {
    this.stopSpeechRecognition();
    this.speechRecognition = null;
    this.commandRegistry.clear();
  }
}