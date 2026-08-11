/**
 * 黑匣子域设置弹窗（ticket 38/45，ADR-0009 ⚙️ 就近设置）。
 * v2 共 7 项：AI 模式 / Ollama 地址 / Ollama 模型 / 复盘阈值 / 对话历史（v1 保留）
 * + 推测事件显示开关（blackboxShowSpeculativeEvents，全局优先，数据 settings 兜底同步）
 * + 情绪词表可编辑（settings.words 增删，预置 24 词；删除词不影响存量条目 emotions）。
 */
import { Setting } from 'obsidian';
import type { App } from 'obsidian';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { notice } from '../core/notice';
import { BlackBoxDataManager } from './data';
import { sanitizeWords, MAX_WORDS } from './types';
import type { BlackBoxData } from './types';

let dataManager: BlackBoxDataManager | null = null;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 打开黑匣子设置弹窗（幂等：已开先关；异步加载数据以读词表；manager 随本次 app 重建防跨实例残留） */
export async function openBlackBoxSettings(app: App): Promise<void> {
  dataManager = new BlackBoxDataManager(app);
  const data = await manager(app).load();
  openSettingsModal({
    title: '黑匣子设置',
    build: (el) => {
      const s = getSettings();
      const num = (v: string, def: number): number => {
        const n = parseInt(v ?? '', 10);
        return Number.isFinite(n) && n > 0 ? n : def;
      };

      new Setting(el)
        .setName('AI 服务')
        .setDesc('deepseek = 云端（默认，跟随 bz 既有模式）；ollama = 本地（更私密，需本地运行）。⚠️ 默认云端：内容会经 DeepSeek API 传输，最私密的内容建议切换 ollama')
        .addDropdown((dd) => {
          dd.addOption('deepseek', 'DeepSeek（云端）');
          dd.addOption('ollama', 'Ollama（本地）');
          dd.setValue(s.blackboxAIProvider || 'deepseek');
          dd.onChange(async (v) => {
            s.blackboxAIProvider = v;
            await saveSettings();
          });
        });

      new Setting(el)
        .setName('Ollama 地址')
        .setDesc('仅 ollama 模式生效')
        .addText((text) =>
          text
            .setPlaceholder('http://localhost:11434')
            .setValue(s.blackboxOllamaUrl || 'http://localhost:11434')
            .onChange(async (v) => {
              s.blackboxOllamaUrl = v.trim() || 'http://localhost:11434';
              await saveSettings();
            })
        );

      new Setting(el)
        .setName('Ollama 对话模型')
        .setDesc('仅 ollama 模式生效')
        .addText((text) =>
          text
            .setPlaceholder('qwen2.5:14b-instruct')
            .setValue(s.blackboxOllamaModel || 'qwen2.5:14b-instruct')
            .onChange(async (v) => {
              s.blackboxOllamaModel = v.trim() || 'qwen2.5:14b-instruct';
              await saveSettings();
            })
        );

      new Setting(el)
        .setName('复盘阈值')
        .setDesc(`每 N 条新内容自动静默复盘一次（当前 ${num(s.blackboxReviewThreshold, 10)} 条）`)
        .addText((text) =>
          text
            .setPlaceholder('10')
            .setValue(s.blackboxReviewThreshold || '10')
            .onChange(async (v) => {
              s.blackboxReviewThreshold = num(v, 10).toString();
              await saveSettings();
            })
        );

      new Setting(el)
        .setName('对话历史保留')
        .setDesc(`包仔的短期记忆条数（当前 ${num(s.blackboxMaxHistory, 20)} 条）`)
        .addText((text) =>
          text
            .setPlaceholder('20')
            .setValue(s.blackboxMaxHistory || '20')
            .onChange(async (v) => {
              s.blackboxMaxHistory = num(v, 20).toString();
              await saveSettings();
            })
        );

      // v2：推测事件显示开关（全局优先，数据 settings 兜底同步——时间线消费 resolveShowSpeculative）
      new Setting(el)
        .setName('推测事件显示')
        .setDesc('时间线是否显示推测事件（虚线 + ❓；关 = 只显示确认事件）。意图/计划/梦境等非事实内容由 AI 标记为推测')
        .addToggle((tg) => {
          tg.setValue(data.settings.showSpeculativeEvents !== false);
          tg.onChange(async (v) => {
            s.blackboxShowSpeculativeEvents = v;
            await saveSettings();
            // 数据内兜底同步（save 时亦自动同步，这里立即生效）
            const fresh = await manager(app).load();
            fresh.settings.showSpeculativeEvents = v;
            await manager(app).save(fresh);
          });
        });

      // v2：情绪词表可编辑（settings.words 增删；删除词不影响存量条目）
      new Setting(el)
        .setName('情绪词表')
        .setDesc(`录入弹窗的情绪胶囊词表（当前 ${data.settings.words.length} 词，最多 ${MAX_WORDS} 词；增删不影响已存条目）`);
      const wordsBox = document.createElement('div');
      wordsBox.className = 'bz-blackbox-words-setting';
      wordsBox.id = 'bz-blackbox-words-setting';
      el.appendChild(wordsBox);
      renderWords(app, data, wordsBox);
    },
  });
}

function renderWords(app: App, data: BlackBoxData, box: HTMLElement): void {
  box.innerHTML = '';
  const chips = document.createElement('div');
  chips.className = 'bz-blackbox-term-chips';
  for (const w of data.settings.words) {
    const chip = document.createElement('span');
    chip.className = 'bz-blackbox-word-chip';
    chip.textContent = w;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'bz-blackbox-people-remove';
    x.textContent = '✕';
    x.title = '删除该词（不影响已存条目）';
    x.addEventListener('click', () => void removeWord(app, data, box, w));
    chip.appendChild(x);
    chips.appendChild(chip);
  }
  box.appendChild(chips);
  // 添加行（常驻）
  const addRow = document.createElement('div');
  addRow.className = 'bz-blackbox-word-add-row';
  const input = document.createElement('input');
  input.id = 'bz-blackbox-word-input';
  input.className = 'bz-blackbox-input';
  input.placeholder = '新情绪词';
  const go = document.createElement('button');
  go.type = 'button';
  go.id = 'bz-blackbox-word-add';
  go.className = 'bz-blackbox-btn bz-blackbox-btn-primary';
  go.textContent = '添加';
  go.addEventListener('click', () => void addWord(app, data, input.value.trim()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      void addWord(app, data, input.value.trim());
    }
  });
  addRow.append(input, go);
  box.appendChild(addRow);
}

async function addWord(app: App, data: BlackBoxData, word: string): Promise<void> {
  if (!word) {
    notice('⚠️ 词不能为空');
    return;
  }
  if (data.settings.words.includes(word)) {
    notice('⚠️ 词已存在');
    return;
  }
  const fresh = await manager(app).load();
  fresh.settings.words = sanitizeWords([...fresh.settings.words, word]);
  await manager(app).save(fresh);
  data.settings.words = fresh.settings.words;
  const box = document.getElementById('bz-blackbox-words-setting');
  if (box) renderWords(app, data, box);
  notice(`✅ 已添加「${word}」`);
}

async function removeWord(app: App, data: BlackBoxData, box: HTMLElement, word: string): Promise<void> {
  const fresh = await manager(app).load();
  fresh.settings.words = sanitizeWords(fresh.settings.words.filter((w) => w !== word));
  await manager(app).save(fresh);
  data.settings.words = fresh.settings.words;
  renderWords(app, data, box);
  notice(`🗑 已删除「${word}」（存量条目不受影响）`);
}
