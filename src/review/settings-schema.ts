/**
 * 复习计划设置 schema（自 src/review/ui.ts 拆出，ticket 131 声明式；ADR-0064）
 *
 * 检查提醒/做题家/复习节奏/记忆算法/自动化/界面 + 移动端六组卡片。
 * 做题家子项显隐（原 quizBox style.display）收敛为 visibleWhen 声明式联动；
 * 监听文件夹走通用 path 行（multi chips，落盘外部 binding 自管：新增先确认存量收编、
 * 移除连带清理排除记录）；排除名单 chips 区走 custom 插槽。
 * deps 仅在交互回调（custom/path onChange）经闭包引用，工厂构建无副作用。
 *
 * settings-panel 桌面侧栏经 reviewSettingsSchema 消费（入口契约保持自 review/ui re-export）。
 */
import { Setting, type App } from 'obsidian';
import { notice } from '../core/notice';
import { getSettings, saveSettings } from '../core/settings-provider';
import { mobileFullscreenGroup } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';
import type { ReviewItem } from './data';
import type { ReviewDataManager } from './data';

export function reviewSettingsSchema(deps: { app: App; dataManager: ReviewDataManager }): SettingsSchema {
  // 排除名单 custom 行的 chips 重渲染句柄（原 renderExcludeRows；交互后调用）
  let renderExcludeRows: (() => void) | null = null;
  // enableAutoNotify 常驻轮询在 main.ts onload 注册、运行时按设置实时读值（app.ts checkOverdueAndNotify
  // 门控），设置弹窗 toggle 只需落盘，渲染器键直绑自动完成，无需额外副作用回调。
  return {
    groups: [
      {
        icon: 'bell',
        name: '检查提醒',
        rows: [
          { type: 'toggle', name: '到期提醒', desc: '有笔记到期待复习时自动弹出提醒', binding: { key: 'enableAutoNotify' } },
          { type: 'toggle', name: '新笔记加入提醒', desc: '新笔记被自动加入时弹出提示，多条合并成一条', binding: { key: 'reviewAutoAddNotice' } },
        ],
      },
      {
        icon: 'graduation-cap',
        name: '做题家',
        rows: [
          { type: 'toggle', name: '用做题测难度', desc: '开始复习即做题，按正确率自动定难度', binding: { key: 'forceQuizForReview' } },
          // 出题子项：仅「用做题测难度」开启时显示（ticket 170 isChild 联动 + visibleWhen 兜底）
          { type: 'toggle', name: '允许多选题', desc: '开启后 AI 可能出多选题，关闭则只出单选题', binding: { key: 'enableMultipleChoice' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          { type: 'text', name: '每篇笔记出题数量', desc: '固定每篇笔记出题的数量，留空/0=自动', binding: { key: 'questionsPerNote' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          { type: 'toggle', name: '打乱出题顺序', desc: '做题时随机排列题目顺序', binding: { key: 'shuffleQuestions' }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
          {
            type: 'select',
            name: '出题难度',
            desc: '控制 AI 出题深浅',
            binding: { key: 'difficulty' },
            options: [
              { value: 'random', label: '随机' },
              { value: 'easy', label: '简单' },
              { value: 'medium', label: '中等' },
              { value: 'hard', label: '困难' },
            ],
            visibleWhen: (s) => s.forceQuizForReview === true,
            isChild: true,
          },
        ],
      },
      {
        icon: 'timer',
        name: '复习节奏',
        rows: [
          // 非正数钳制为 0（原 onChange 口径：>0 保留否则 0）；空串不写（防脏值落盘）
          { type: 'number', name: '每日复习上限', desc: '一轮最多复习的篇数，不填则不限制', binding: { key: 'reviewDailyLimit' }, min: 0 },
          // 原钳制「n>0 且 n<=5 保留、否则回 1」：渲染器 min/max 只做边界钳制，超上界回 1 语义在 onChange 复刻
          {
            type: 'number',
            name: '复习间隔缩放',
            desc: '数值越小复习越频繁，数值越大越宽松',
            binding: { key: 'reviewIntervalScale' },
            onChange: (v) => {
              if (!(v > 0 && v <= 5)) (getSettings() as any).reviewIntervalScale = 1;
            },
          },
          // ADR-0077：R 目标阈值（低于该值视为可复习/提前；默认 0.9）
          {
            type: 'number',
            name: 'R 目标阈值',
            desc: '记忆保留度低于该值视为该复习了',
            binding: { key: 'reviewRThreshold' },
            min: 0.5,
            max: 0.99,
          },
        ],
      },
      {
        icon: 'brain',
        name: '记忆算法',
        rows: [
          // ADR-0077：FSRS 参数自动拟合（全自动定期重算）
          { type: 'toggle', name: '参数自动拟合', desc: '按个人复习历史拟合记忆参数，优化复习节奏', binding: { key: 'reviewEnableFit' } },
          {
            type: 'number',
            name: '每 N 次复习重算',
            desc: '累计 N 次评级后自动重拟合一次',
            binding: { key: 'reviewFitEveryN' },
            min: 1,
            visibleWhen: (s) => (s as any).reviewEnableFit === true,
            isChild: true,
          },
        ],
      },
      {
        icon: 'sliders-horizontal',
        name: '自动化',
        rows: [
          // 监听文件夹：通用 path 行（multi chips + 添加… 按钮，ticket 133 形态）。
          // 落盘走外部 binding 自管（权威写盘在 onChange）：新增目录需先确认存量收编（取消=不加入，
          // 回传回退清单否决本次变更），移除目录需连带清理其下排除记录（ticket 099）。
          {
            type: 'path',
            mode: 'multi',
            name: '监听文件夹',
            desc: '文件夹里的新笔记自动加入复习计划，包括子文件夹',
            binding: {
              get: () => ((getSettings() as any).reviewWatchedFolders || []) as string[],
              set: () => {},
              save: () => {},
            },
            pickerTitle: '选择监听文件夹',
            pickerDesc: '文件夹里的新笔记自动加入复习计划，包括子文件夹',
            okText: '确定',
            onChange: (list) => {
              const prev = [...(((getSettings() as any).reviewWatchedFolders as string[]) || [])];
              return (async (): Promise<string[]> => {
                const { ReviewWatcher } = await import('./watch');
                const watcher = new ReviewWatcher(deps.app, deps.dataManager);
                const kept: string[] = [];
                for (const folder of list) {
                  if (!folder) {
                    notice('暂不支持监听库根目录', 'warning');
                    continue;
                  }
                  if (prev.includes(folder)) {
                    kept.push(folder);
                    continue;
                  }
                  // 新增：先确认存量收编；取消 = 该目录不加入（不写排除名单）
                  if (await watcher.confirmBatchAddForFolder(folder)) kept.push(folder);
                }
                for (const folder of prev) {
                  if (list.includes(folder)) continue;
                  // 移除：同时清空其下排除记录（否则二次添加时存量被旧黑名单挡住）
                  const cleared = await watcher.removeWatchedFolder(folder);
                  notice(cleared > 0 ? `已移除监听文件夹，并清理其下 ${cleared} 条排除记录` : '已移除监听文件夹', 'success');
                }
                (getSettings() as any).reviewWatchedFolders = kept;
                await saveSettings();
                return kept;
              })();
            },
          },
          // 排除名单 chips 区（ticket 57 管理 UI；DOM id/类名零变化；交互后经 renderExcludeRows 重渲染）
          {
            type: 'custom',
            render: (body) => {
              const setting = new Setting(body).setName('排除名单').setDesc('不参与监听自动加入的笔记，可在此单条解除');
              setting.settingEl.classList.add('bz-review-exclude-row');
              const excludeBox = document.createElement('div');
              excludeBox.id = 'review-excluded-list';
              setting.controlEl.appendChild(excludeBox);
              renderExcludeRows = () => {
                excludeBox.innerHTML = '';
                const notes = (getSettings() as any).reviewExcludedNotes || [];
                if (!notes.length) {
                  const empty = document.createElement('div');
                  empty.className = 'bz-review-exclude-empty';
                  empty.textContent = '暂无排除笔记';
                  excludeBox.appendChild(empty);
                  return;
                }
                notes.forEach((path: string) => {
                  const chip = document.createElement('span');
                  chip.className = 'bz-review-exclude-chip';
                  const name = document.createElement('span');
                  name.className = 'bz-review-exclude-name';
                  name.textContent = path;
                  name.title = path;
                  const remove = document.createElement('button');
                  remove.className = 'bz-review-exclude-remove';
                  remove.setAttribute('aria-label', `解除排除 ${path}`);
                  remove.textContent = '✕';
                  remove.onclick = () => {
                    void (async () => {
                      const { ReviewWatcher } = await import('./watch');
                      await new ReviewWatcher(deps.app, deps.dataManager).removeExcludedNote(path);
                      renderExcludeRows?.();
                      notice('已解除排除', 'success');
                    })();
                  };
                  chip.appendChild(name);
                  chip.appendChild(remove);
                  excludeBox.appendChild(chip);
                });
              };
              renderExcludeRows();
            },
          },
        ],
      },
      {
        icon: 'eye',
        name: '界面',
        rows: [
          { type: 'toggle', name: '文件树标记', desc: '在文件树中为复习笔记着色并标到期时间', binding: { key: 'reviewTreeBadge' } },
        ],
      },
      // ticket 170：所有域移动端组统一无描述
      mobileFullscreenGroup('reviewMobileDefaultFullscreen', { desc: '' }),
    ],
  };
}
