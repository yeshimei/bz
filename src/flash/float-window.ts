/**
 * 闪念窄窗 FloatWindow（ticket 18，源码 L1119-1315 语义移植）
 * 右侧贴边/悬停展开/双击最大化/拖拽缩放。
 */
import { Setting } from 'obsidian';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { makeDraggable, makeResizable } from './ui-tools';

export class FloatWindow {
  el: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
  isHidden = false;
  isMaximized = false;
  hoverExpandTimer: ReturnType<typeof setTimeout> | null = null;
  private detachFns: (() => void)[] = [];
  onClose: (() => void) | null = null;

  constructor(title: string, opts: { headerRight?: HTMLElement; onClose?: () => void } = {}) {
    this.onClose = opts.onClose || null;

    this.el = document.createElement('div');
    this.el.className = 'sh-window';
    this.el.style.cssText = `
      position: fixed; right: 0; top: 0; height: 100vh; min-width: 30px;
      width: 320px; background: var(--background-primary); z-index: 10020;
      display: flex; flex-direction: column; box-shadow: -4px 0 20px rgba(0,0,0,0.15);
      transition: transform .2s ease;
    `;

    this.header = document.createElement('div');
    this.header.className = 'sh-header';
    this.header.style.cssText = `
      display: flex; align-items: center; gap: 4px; padding: 6px 8px;
      border-bottom: 1px solid var(--background-modifier-border); cursor: move; flex-shrink: 0;
    `;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleSpan.style.cssText = 'flex:1; font-size:.85rem; font-weight:600;';

    // 按钮组
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⟲';
    resetBtn.title = '复位';
    resetBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;font-size:.8rem;';
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reset();
    });

    const hideBtn = document.createElement('button');
    hideBtn.textContent = '◀▶';
    hideBtn.title = '隐藏展开';
    hideBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;font-size:.8rem;';
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isHidden) this.show();
      else this.hide();
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭';
    closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;font-size:.8rem;';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙';
    settingsBtn.title = '设置';
    settingsBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;font-size:.8rem;';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 闪念设置弹窗（ADR-0009：17 项全量）
      openSettingsModal({
        title: '闪念设置',
        build: (el) => {
          const s = getSettings() as any;
          const textSetting = (name: string, desc: string, field: string) =>
            new Setting(el)
              .setName(name)
              .setDesc(desc)
              .addText((text) =>
                text.setValue(String(s[field] ?? '')).onChange(async (v) => {
                  s[field] = v;
                  await saveSettings();
                })
              );
          const toggleSetting = (name: string, desc: string, field: string) =>
            new Setting(el)
              .setName(name)
              .setDesc(desc)
              .addToggle((toggle) =>
                toggle.setValue(s[field] === 'true' || s[field] === true).onChange(async (v) => {
                  s[field] = String(v);
                  await saveSettings();
                })
              );
          toggleSetting('启用', '常驻监听光标移动与笔记变更（向量检索/AI 对话）', 'flashEnabled');
          textSetting('Ollama URL', '本地 Ollama 服务地址', 'OLLAMA_URL');
          textSetting('Embedding 模型', '向量化模型', 'EMBEDDING_MODEL');
          textSetting('元数据路径', '向量元数据 JSON 路径', 'META_PATH');
          textSetting('向量文件路径', '二进制向量文件路径', 'VEC_PATH');
          textSetting('参考结果数', '参考面板显示的匹配结果数', 'TOP_K');
          textSetting('AI 检索结果数', 'AI 对话时检索的笔记数量', 'CHAT_TOP_K');
          textSetting('段落最小长度', '短于此长度的段落将被跳过', 'CHUNK_MIN_LENGTH');
          textSetting('允许的文件夹', '只处理这些文件夹下的笔记 (逗号分隔)', 'ALLOW_PATHS');
          textSetting('并发数', 'Embedding 请求并发数', 'CONCURRENCY');
          textSetting('上下文限制', 'AI 上下文限制', 'CONTEXT_LIMIT');
          textSetting('防抖延迟', '光标变化后延迟多久触发搜索 (ms)', 'DEBOUNCE_DELAY');
          textSetting('光标轮询间隔', '移动端光标轮询间隔 (ms)', 'CURSOR_POLL_INTERVAL');
          textSetting('Ollama 对话模型', '用于 AI 对话的模型', 'OLLAMA_CHAT_MODEL');
          textSetting('DeepSeek 模型', 'DeepSeek API 模型名称', 'DEEPSEEK_MODEL');
          toggleSetting('默认使用 DeepSeek', 'AI 对话时默认勾选 DeepSeek', 'DEFAULT_USE_DEEPSEEK');
          textSetting('最大历史记录', 'AI 聊天保留的对话轮数', 'MAX_HISTORY');
          textSetting('远程 Ollama URL', '手机端使用的远程 Ollama 地址', 'OLLAMA_REMOTE_URL');
        },
      });
    });

    this.header.appendChild(titleSpan);
    this.header.appendChild(resetBtn);
    this.header.appendChild(hideBtn);
    if (opts.headerRight) this.header.appendChild(opts.headerRight);
    this.header.appendChild(settingsBtn);
    this.header.appendChild(closeBtn);

    this.body = document.createElement('div');
    this.body.className = 'sh-body';
    this.body.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden; padding: 10px;';

    this.el.appendChild(this.header);
    this.el.appendChild(this.body);
    document.body.appendChild(this.el);

    // 双击标题栏最大化
    this.header.addEventListener('dblclick', () => this.toggleMaximize());

    // 悬停展开
    this.el.addEventListener('mouseenter', () => {
      if (this.isHidden) {
        this.hoverExpandTimer = setTimeout(() => this.show(), 200);
      }
    });
    this.el.addEventListener('mouseleave', () => {
      if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
    });

    this.detachFns.push(makeDraggable(this.el, this.header));
    this.detachFns.push(makeResizable(this.el, 240, 200));

    // ESC 关闭
    this.onKeydown = this.onKeydown.bind(this);
    document.addEventListener('keydown', this.onKeydown);
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.close();
  }

  get alive(): boolean {
    return !!this.el.isConnected;
  }

  reset(): void {
    this.el.style.cssText += `right:0;top:0;width:320px;height:100vh;left:auto;bottom:auto;transform:translateX(0);`;
  }

  toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
    if (this.isMaximized) {
      this.el.style.width = '100vw';
      this.el.style.height = '100vh';
      this.el.style.left = '0';
      this.el.style.top = '0';
    } else {
      this.reset();
    }
  }

  toggleHide(): void {
    if (this.isHidden) this.show();
    else this.hide();
  }

  hide(): void {
    this.isHidden = true;
    const rect = this.el.getBoundingClientRect();
    const offset = window.innerWidth - rect.left - 30;
    this.el.style.transform = `translateX(${offset}px)`;
  }

  show(): void {
    this.isHidden = false;
    this.el.style.transform = 'translateX(0)';
  }

  setHiddenUI(hidden: boolean): void {
    this.isHidden = hidden;
  }

  close(): void {
    this.el.style.opacity = '0';
    this.el.style.transform = 'scale(0.97)';
    setTimeout(() => {
      this.detachFns.forEach((fn) => fn());
      this.detachFns = [];
      document.removeEventListener('keydown', this.onKeydown);
      if (this.el.isConnected) this.el.remove();
      this.onClose?.();
    }, 150);
  }
}
