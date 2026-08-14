/**
 * 黑匣子域设置弹窗（ticket 64，6 项）：AI 服务商 / Ollama URL / Ollama 模型 / 对话历史条数 /
 * 推测事件显示 / 情绪词表可编辑（增删，24 词预置，落盘 blackbox.json settings.words）。
 * 走 core/settings-modal（⚙️ 面板按钮打开）。
 */
import { Setting } from 'obsidian';
import { openSettingsModal } from '../core/settings-modal';
import { getSettings, saveSettings } from '../core/settings-provider';
import { BlackBoxDataManager } from './data';
import { defaultBlackBoxData, sanitizeWords } from './types';

/** 打开黑匣子设置弹窗 */
export function openBlackBoxSettings(): void {
  openSettingsModal({
    title: '黑匣子设置',
    build: (el) => {
      // 情绪词表（blackbox.json settings.words 持久化）
      void buildWordSettings(el);
      // AI 服务商
      new Setting(el).setName('AI 服务商').setDesc('deepseek（云端）/ ollama（本地）').addDropdown((dd) => {
        dd.addOption('deepseek', 'DeepSeek');
        dd.addOption('ollama', 'Ollama');
        dd.setValue(getSettings().blackboxAIProvider || 'deepseek');
        dd.onChange(async (v) => {
          getSettings().blackboxAIProvider = v;
          await saveSettings();
        });
      });
      // Ollama URL
      new Setting(el).setName('Ollama URL').setDesc('本地 Ollama 服务地址').addText((t) => {
        t.setValue(getSettings().blackboxOllamaUrl || 'http://localhost:11434');
        t.onChange(async (v) => {
          getSettings().blackboxOllamaUrl = v;
          await saveSettings();
        });
      });
      // Ollama 模型
      new Setting(el).setName('Ollama 模型').setDesc('本地对话模型名').addText((t) => {
        t.setValue(getSettings().blackboxOllamaModel || 'qwen2.5:14b-instruct');
        t.onChange(async (v) => {
          getSettings().blackboxOllamaModel = v;
          await saveSettings();
        });
      });
      // 对话历史条数
      new Setting(el).setName('对话历史条数').setDesc('三层记忆短期层上限（默认 20）').addText((t) => {
        t.setValue(getSettings().blackboxMaxHistory || '20');
        t.onChange(async (v) => {
          getSettings().blackboxMaxHistory = v;
          await saveSettings();
        });
      });
      // 推测事件显示
      new Setting(el).setName('推测事件显示').setDesc('时间线是否显示推测事件（虚线 + ❓）').addToggle((tg) => {
        tg.setValue(getSettings().blackboxShowSpeculativeEvents !== false);
        tg.onChange(async (v) => {
          getSettings().blackboxShowSpeculativeEvents = v;
          await saveSettings();
        });
      });
    },
  });
}

/** 情绪词表设置（读 blackbox.json settings.words，增删持久化） */
async function buildWordSettings(el: HTMLElement): Promise<void> {
  const dm = new BlackBoxDataManager();
  let data = await dm.load();
  const render = () => {
    const existing = el.querySelector('.bz-words-section');
    if (existing) existing.remove();
    const section = document.createElement('div');
    section.className = 'bz-words-section';
    const label = document.createElement('div');
    label.className = 'bz-words-label';
    label.textContent = '情绪词表（AI 推断输出分类，可增删）';
    section.appendChild(label);
    const chips = document.createElement('div');
    chips.className = 'bz-words-chips';
    for (const w of data.settings.words) {
      const chip = document.createElement('span');
      chip.className = 'bz-word-chip';
      chip.textContent = w;
      const del = document.createElement('button');
      del.className = 'bz-word-del';
      del.textContent = '✕';
      del.onclick = async () => {
        data.settings.words = data.settings.words.filter((x) => x !== w);
        await dm.save(data);
        render();
      };
      chip.appendChild(del);
      chips.appendChild(chip);
    }
    section.appendChild(chips);
    const row = document.createElement('div');
    row.className = 'bz-word-add-row';
    const input = document.createElement('input');
    input.placeholder = '新增情绪词…';
    const add = document.createElement('button');
    add.textContent = '添加';
    add.onclick = async () => {
      const v = (input.value || '').trim();
      if (!v) return;
      data.settings.words = sanitizeWords([...data.settings.words, v]);
      await dm.save(data);
      input.value = '';
      render();
    };
    row.appendChild(input);
    row.appendChild(add);
    section.appendChild(row);
    el.appendChild(section);
  };
  render();
}