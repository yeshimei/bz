/**
 * 通用设置组预设（ticket 131，ADR-0064 决策 5）：跨域同构项 core 定义一次、域一行挂载。
 *
 * 「每批加载数量」数字行（diary/clipping/movie 三域统一文案）、
 * 「重载后生效」一次性提示 helper（movie/password/encrypt/secondbrain 快照设置收口）。
 *
 * TODO(后续域迁移票)——排序、默认筛选下拉暂不抽预设：diary 标签排序（fixed/count）、
 * memo 默认排序（priority/due/created）、movie 默认排序（六选项）/状态筛选/类型筛选——
 * 选项集与文案全不同构，无可收敛公约数；待各域迁移时逐域声明，出现同构后再抽。
 */
import { notice } from './notice';
import { getSettings, saveSettings, tryGetSettings } from './settings-provider';
import type { GroupDecl, SettingsKeyOfType, SettingsRow, SettingsSnapshot } from './settings-schema';

/** 「每批加载数量」数字行（三域统一文案，ticket 170）：日记/剪藏/影视逐字对齐。
 *  各域键为 string（滚动加载数量，data.json 字符串存储冻结）——number 行显示数字、落盘保持字符串。 */
export function batchSizeRow(
  key: SettingsKeyOfType<string>,
  opts?: { onCommit?: () => void }
): SettingsRow {
  return {
    type: 'number',
    name: '每批加载数量',
    desc: '滚动加载时每批显示的条目数',
    binding: numStrBinding(key, 20),
    min: 1,
    step: 1,
    onCommit: opts?.onCommit,
  };
}

/** 重载提示文案：快照设置改动后通知重载插件生效（正文不带 emoji，铁律 7） */
const RELOAD_SETTINGS_NOTICE = '设置已保存，重载插件后生效';

/**
 * string 键 ↔ number 值转换绑定（number 行显示数字，落盘保持字符串——数据格式冻结）。
 * 空值/非正数/NaN 一律回退默认（ticket 170：「用户没填值就填默认值」语义）。
 * 收敛 encrypt 预览长边/质量、密码生成长度等「string 键数字项」的同构绑定。
 */
export function numStrBinding(key: string, def: number): { get: () => number; set: (v: number) => void; save: () => void } {
  return {
    get: () => {
      const raw = (tryGetSettings() as any)[key];
      if (raw === '' || raw === null || raw === undefined) return def;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : def;
    },
    set: (v: number) => {
      (getSettings() as any)[key] = String(v);
    },
    save: () => saveSettings(),
  };
}

/**
 * 快照设置（启动时读取）的「改动需重载」一次性提示 helper：弹窗会话内只提示一次。
 * 收敛 movie/password/encrypt/secondbrain 四处重复的 warnReload 闭包。
 * 说明：渲染器 onCommit 自带「值有变更才提示」语义，此处仅负责一次性上限；
 * 返回的 closure 可直接挂 onCommit（text/path 行）/ onChange（toggle 行）。
 */
export function makeReloadWarnOnce(): () => void {
  let reloadWarned = false;
  return () => {
    if (reloadWarned) return;
    reloadWarned = true;
    notice(RELOAD_SETTINGS_NOTICE, 'info');
  };
}

/**
 * 引用同步监听范围（issue 187）：备忘录/收藏本 file-sync 的 rename/delete 事件
 * 只处理该范围内的 md。原 aiAgentWatchedFolders 设置键随旧 AIAgent 退役后固定为此默认值
 * （用户存量值即默认值，行为不变）。
 */
export const SYNC_WATCHED_FOLDERS = '卡片盒,归档/网页剪藏';
