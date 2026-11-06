/**
 * 日记本设置 schema。
 * 组序：外观 / 目录 / 显示 / 存储 / 分类。
 * - 目录：只保留日记文件夹（信件文件夹按用户要求从设置页隐藏，键与读写逻辑保留）；
 * - 显示：写日记时间口径、每卷则数（紧跟目录：先放哪儿，再怎么看，2026-11-05 用户要求）；
 * - 存储：custom 行（两种格式卡片 + 切换确认 + 转换进度，见 ./settings-format）；
 * - 分类：custom 行（清单式，全部平级，见 ./settings-types）。
 * 「维护」组与「日记格式体检」弹窗按用户拍板退役（2026-09-25）——格式 lint 仍留在
 * src/diary/repair.ts（store 写入路径消费），只是不再有手动体检入口。
 * ⚙️ 弹窗 / 设置面板「日记本」页共用本 schema。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings } from '../core/settings-provider';
import { obsidianDailyNotesFolder } from '../core/daily-notes';
import { applyDirectories } from './config';
import { mountDiaryFormatEditor } from './settings-format';
import { mountDiaryTypeEditor } from './settings-types';
import { emitDomainEvent } from '../core/domain-bus';
import { invalidateWallCache } from './data';

/**
 * 「收录影院 / 收录书库」两次连切的合并广播间隔：两个开关各自 emit 会让整册重读重排两次。
 * 缓存失效是**同步**做的（见 `notifyDiaryDisplayChanged`），被合并的只有重排信号。
 */
const DISPLAY_CHANGE_DEBOUNCE_MS = 150;
let displayChangeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 显示开关变了。两步分工：
 * 1. **立刻作废墙缓存**——日记本关着时 `diary:display-changed` 没有订阅者（订阅在 show/hide 之间），
 *    不在这里作废，下次 show() 会走 `_allowCacheNext` 快路命中旧聚合，影院/书库仍被收录；
 * 2. 广播做一次短防抖：连切两个开关只触发一轮整读重排。
 */
function notifyDiaryDisplayChanged(): void {
  invalidateWallCache();
  if (displayChangeTimer !== null) clearTimeout(displayChangeTimer);
  displayChangeTimer = setTimeout(() => {
    displayChangeTimer = null;
    emitDomainEvent('diary:display-changed', {});
  }, DISPLAY_CHANGE_DEBOUNCE_MS);
}

/** 日记本设置 schema */
export function diarySettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 范式）：布局/主题各一档，域 UI 消费待皮肤设计时接入
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'diarySkin' }, options: [{ value: 'default', label: '媒体墙', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'diarySkinTheme' }, layoutKey: 'diarySkin', options: [{ value: 'gallery', label: '画廊白', layout: 'default', prevClass: 'bz-sp-prev-gallery' }] },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '日记文件夹',
            desc: '留空则跟随 Obsidian 日记的新笔记存放位置',
            binding: { key: 'diaryDirectory' },
            // 留空时把「实际跟随到哪」显式挂成锁定 chip（只展示不落盘；点击可改为显式目录）。
            // 2026-11-05 用户重装后报「设置里空着，看不出到底跟到了哪个文件夹」。
            fallbackValue: () => obsidianDailyNotesFolder(),
            onChange: () => applyDirectories(getSettings()),
          },
        ],
      },
      {
        icon: 'eye',
        name: '显示',
        rows: [
          { type: 'toggle', name: '默认日期取自文件', desc: '默认日期取自当前打开的日记文件', binding: { key: 'useFileDateTime' } },
          {
            type: 'toggle',
            name: '收录影院',
            desc: '把影院的观影票根排进这本册子',
            binding: { key: 'diaryShowCinema' },
            // 保存后作废缓存 + 合并广播：日记本关着时缓存也要失效，开着时按新开关重读重排（聚合在 data.ts）
            onChange: () => notifyDiaryDisplayChanged(),
          },
          {
            type: 'toggle',
            name: '收录书库',
            desc: '把书库的藏书票排进这本册子',
            binding: { key: 'diaryShowBookshelf' },
            onChange: () => notifyDiaryDisplayChanged(),
          },
          {
            type: 'number',
            name: '每卷装多少则',
            desc: '一册只摊开一卷，凑够这么多则就另装一卷',
            binding: { key: 'diaryPageSize' },
            min: 10,
            max: 500,
            step: 10,
          },
        ],
      },
      {
        icon: 'hard-drive',
        name: '存储',
        rows: [{ type: 'custom', render: (body) => mountDiaryFormatEditor(body) }],
      },
      {
        icon: 'tags',
        name: '分类',
        rows: [{ type: 'custom', render: (body) => mountDiaryTypeEditor(body) }],
      },
    ],
  };
}
