/**
 * 黑匣子域设置弹窗（ticket 38，ADR-0009 ⚙️ 就近设置）：AI 模式/复盘阈值/对话历史上限 + 情绪词表只读展示。
 */
import { Setting } from 'obsidian';
import { getSettings, saveSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { EMOTION_TAGS } from './types';

/** 打开黑匣子设置弹窗（幂等：已开先关） */
export function openBlackBoxSettings(): void {
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
        .setDesc('deepseek = 云端（默认，跟随 bz 既有模式）；ollama = 本地（更私密，需本地运行）。⚠️ 默认云端：感触与对话内容会经 DeepSeek API 传输，最私密的内容建议切换 ollama')
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
        .setDesc(`每 N 条新感触自动静默复盘一次（当前 ${num(s.blackboxReviewThreshold, 10)} 条）`)
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

      new Setting(el)
        .setName('情绪词表')
        .setDesc(`${EMOTION_TAGS.length} 词固定（v1 定全，ADR-0013）：${EMOTION_TAGS.join('、')}`);
    },
  });
}
