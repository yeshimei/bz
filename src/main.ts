/**
 * 日记本插件入口：装配、设置、生命周期。
 */
import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { escManager } from './core/esc-manager';
import { setApp } from './diary/app';
import { applyDirectories, applyTagsConfig } from './diary/config';
import { loadAll, setFileChangeDelay } from './diary/store';
import { state } from './diary/state';
import { applyUiSettings, init, showDiaryPanel, unregisterEscLayer } from './diary/ui/panel';

import DiarySettings, { DEFAULT_SETTINGS } from './settings';

/** 应用全部设置到运行时常量/配置（设置变更与启动时调用） */
export function applySettingsToRuntime(settings: DiarySettings) {
  applyDirectories(settings);
  applyTagsConfig(settings.primaryTagsConfig);
  applyUiSettings(settings);
}

export default class DiaryNotebookPlugin extends Plugin {
  settings: DiarySettings = { ...DEFAULT_SETTINGS };

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setApp(this.app);
    applySettingsToRuntime(this.settings);
    console.log('[日记本] onload: 目录 =', this.settings.diaryDirectory, '| 标签配置长度 =', this.settings.primaryTagsConfig.length);

    // 命令说明：
    // - diary-open-add-dialog / diary-create-quote 由 init() 内经 registerOpenDialogCommand/
    //   registerQuoteCommand 注册（原脚本同款，id 不带前缀以保留 Alt+A 热键绑定，见 ADR-0001）
    // - 下方 ribbon 图标 + 面板命令（插件级，id 自动带前缀 diary-notebook:）
    this.addRibbonIcon('notebook-pen', '日记本', () => {
      showDiaryPanel(this);
    });
    this.addCommand({
      id: 'open-panel',
      name: '打开日记本面板',
      callback: () => {
        showDiaryPanel(this);
      },
    });

    // 设置页
    this.addSettingTab(new DiaryNotebookSettingTab(this.app, this));

    // 初始化面板（与原宏行为一致：加载即打开）
    await init(this);
  }

  async onunload() {
    // 移除全部注入 DOM
    const ids = [
      'diary-tag-filter',
      'diary-filter-mask',
      'diary-search-container',
      'diary-subtags-container',
      'add-diary-mask',
      'add-diary-popup',
      'diary-tag-selector-mask',
      'diary-tag-selector-popup',
      'unified-datetime-picker-mask',
      'diary-date-filter-mask',
      'diary-date-filter-popup',
      '__shared_confirm_mask__',
      'diary-styles',
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    // ESC 层级与全局监听
    unregisterEscLayer();
    escManager.destroy();

    // 移除全局命令（id 不带前缀）
    try {
      (this.app as any).commands.removeCommand('diary-open-add-dialog');
      (this.app as any).commands.removeCommand('diary-create-quote');
    } catch (e) {
      console.warn('移除命令失败', e);
    }

    state.events.fileListenerAttached = false;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}


// ===== 设置页 =====

export class DiaryNotebookSettingTab extends PluginSettingTab {
  plugin: DiaryNotebookPlugin;

  constructor(app: any, plugin: DiaryNotebookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h3', { text: '📂 目录配置' });

    new Setting(containerEl)
      .setName('日记目录')
      .setDesc('存放日记 markdown 文件的文件夹路径')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.diaryDirectory)
          .onChange(async (value) => {
            this.plugin.settings.diaryDirectory = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    new Setting(containerEl)
      .setName('影视目录')
      .setDesc('存放影视笔记的文件夹路径')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.movieDirectory)
          .onChange(async (value) => {
            this.plugin.settings.movieDirectory = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    new Setting(containerEl)
      .setName('信目录')
      .setDesc('存放信件的文件夹路径')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.letterDirectory)
          .onChange(async (value) => {
            this.plugin.settings.letterDirectory = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    containerEl.createEl('h3', { text: '📄 性能与交互配置' });

    new Setting(containerEl)
      .setName('每批加载数量')
      .setDesc('滚动加载时每批显示的条目数')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.batchSize)
          .onChange(async (value) => {
            this.plugin.settings.batchSize = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    new Setting(containerEl)
      .setName('长按识别时长(毫秒)')
      .setDesc('触发长按手势的毫秒数')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.longPressDuration)
          .onChange(async (value) => {
            this.plugin.settings.longPressDuration = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    new Setting(containerEl)
      .setName('文件变更延迟(ms)')
      .setDesc('文件修改后延迟刷新界面的毫秒数，可平衡性能')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.fileChangeDelay)
          .onChange(async (value) => {
            this.plugin.settings.fileChangeDelay = value;
            await this.plugin.saveSettings();
            setFileChangeDelay(parseInt(value) || 100);
          })
      );

    new Setting(containerEl)
      .setName('启用长按手势')
      .setDesc('开启后长按卡片可复制链接或修改标签')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableLongPress).onChange(async (value) => {
          this.plugin.settings.enableLongPress = value;
          await this.plugin.saveSettings();
          applyUiSettings({ enableLongPress: value });
        })
      );

    new Setting(containerEl)
      .setName('显示标签计数')
      .setDesc('在标签按钮上显示该标签包含的条目数量')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showTagCount).onChange(async (value) => {
          this.plugin.settings.showTagCount = value;
          await this.plugin.saveSettings();
          applyUiSettings({ showTagCount: value });
          loadAll();
        })
      );

    containerEl.createEl('h3', { text: '📌 默认值配置' });

    new Setting(containerEl)
      .setName('默认标签')
      .setDesc('打开写日记弹窗时默认选中的标签名（需为有效标签）')
      .addText((text) =>
        text
          .setValue(this.plugin.settings.defaultTag)
          .onChange(async (value) => {
            this.plugin.settings.defaultTag = value;
            await this.plugin.saveSettings();
            applyUiSettings({ defaultTag: value });
          })
      );

    new Setting(containerEl)
      .setName('使用文件日期作为默认日期')
      .setDesc('开启后，添加日记时默认日期取自当前打开的日记文件的日期（若为日记文件）；关闭则使用当前时间')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useFileDateTime).onChange(async (value) => {
          this.plugin.settings.useFileDateTime = value;
          await this.plugin.saveSettings();
          applyUiSettings({ useFileDateTime: value });
        })
      );

    containerEl.createEl('h3', { text: '🏷️ 标签配置' });

    new Setting(containerEl)
      .setName('标签配置（每行一个）')
      .setDesc(
        '每行一个标签，格式：标签名 emoji（用空格分隔）；若需要二级标签，在主标签后加 > 和子标签列表，子标签之间用逗号分隔，例如：旅游 ✈️ > 四川 🀄, 大理 🛶'
      )
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.primaryTagsConfig)
          .onChange(async (value) => {
            this.plugin.settings.primaryTagsConfig = value;
            await this.plugin.saveSettings();
            this.reloadRuntime();
          })
      );

    containerEl.createEl('h4', { text: '默认标签配置（可复制修改）' });
    containerEl.createEl('pre', { text: DEFAULT_SETTINGS.primaryTagsConfig });
  }

  /** 应用设置变更到运行时常量/配置并全量刷新 */
  reloadRuntime() {
    applySettingsToRuntime(this.plugin.settings);
    setFileChangeDelay(parseInt(this.plugin.settings.fileChangeDelay) || 100);
    // 面板已初始化则重新加载数据
    if (document.getElementById('diary-tag-filter')) {
      loadAll();
    } else {
      init(this.plugin);
    }
  }
}
