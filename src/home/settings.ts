/**
 * 首页（home 域）设置 schema（2026-09-10 用户拍板；2026-09-11 issue 287 扩时间线六项、
 * issue 288 拆细分组 + 去「已跳过」）。
 *
 * 四组，顺序固定：**外观 → 时间线 → 内容过滤 → 预告栏**。
 *  「时间线」只放时间线**自己长什么样**（字号 / 时间范围 / 默认打开日 / 显示时刻列）。
 *  「内容过滤」只放**哪些痕迹进来**（产出 / 状态推进 / 点评 ✦）——
 *  与「长相」分开，用户 2026-09-11 明确要求（「全部放到时间线中不太对」）。
 *  「预告栏」= 右侧那一栏（明天预告卡），它不是时间线的一部分，单开一组。
 *  - 「外观」= 与其他域同范式（issue 246）：布局行「活动河」+ 主题行「米白」，
 *    占位键 homeLayout/homeSkin（可看可选可落盘；域 UI 消费在首页真做皮肤时接入，
 *    届时挂 onChange 热切换——与日记本/剪藏本等占位域同口径）。
 *  - 全部键直绑，首页每次打开现读（见 ui.ts readHomeSettings），改完再开即生效。
 *  - 「入口」= 首页入口的顺序与显隐，**内联在面板里**编辑（custom 行 + ./entry-editor，
 *    不再开浮层弹窗、不再有「编辑入口…」按钮，也不再挂说明小字行）。
 * **按端各一份、互不影响**：桌面端只显示/只改桌面那套（顺序 + 隐藏），
 * 移动端只显示/只改移动那套 —— 由 entry-editor 依环境判定，schema 层不传端。
 * 数据落 home.json（见 ./order），与首页渲染共用 shared.visibleDomains 同一口径。
 */
import { getApp } from '../core/app';
import type { SettingsSchema } from '../core/settings-schema';
import { mountHomeEntryEditor } from './entry-editor';

export function homeSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（issue 246 范式，与各域同款置顶）：布局/主题各一档占位单卡
        icon: 'palette',
        name: '外观',
        rows: [
          { type: 'choiceCards', name: '面板布局', binding: { key: 'homeLayout' }, options: [{ value: 'default', label: '活动河', prevClass: 'bz-sp-prev-panel' }] },
          { type: 'choiceCards', name: '面板主题', binding: { key: 'homeSkin' }, layoutKey: 'homeLayout', options: [{ value: 'cream', label: '米白', layout: 'default', prevClass: 'bz-sp-prev-cream' }] },
        ],
      },
      {
        // 时间线组（issue 288 拆分后）：只剩「时间线自己长什么样」四行——顺序按「看字 → 看多久 → 从哪天开始看 → 那一列要不要」
        icon: 'activity',
        name: '时间线',
        rows: [
          {
            type: 'select',
            name: '时间线字号',
            desc: '紧凑压信息密度，宽松看得省力。只作用于中间那条时间线。',
            binding: { key: 'homeTimelineSize' },
            options: [
              { value: 'compact', label: '紧凑' },
              { value: 'normal', label: '标准' },
              { value: 'loose', label: '宽松' },
            ],
          },
          {
            type: 'select',
            name: '时间范围',
            desc: '周历能往回翻几天。当天只留今天一格，本周是完整七天。',
            binding: { key: 'homeTimelineRange' },
            options: [
              { value: 'today', label: '当天' },
              { value: '3d', label: '最近 3 天' },
              { value: 'week', label: '本周' },
            ],
          },
          {
            type: 'select',
            name: '默认打开日',
            desc: '打开首页先落在哪天，选最后有动静就不会一开是空的。',
            binding: { key: 'homeDefaultDay' },
            options: [
              { value: 'today', label: '今天' },
              { value: 'lastActive', label: '最后有动静的那天' },
            ],
          },
          {
            type: 'toggle',
            name: '显示时刻列',
            desc: '每行左边显示时刻，关掉整列收起，正文往左靠。',
            binding: { key: 'homeTimelineTime' },
          },
        ],
      },
      {
        // 内容过滤组（issue 288 从时间线组拆出）：只放「哪些痕迹进来」，与「长相」分开
        icon: 'funnel',
        name: '内容过滤',
        rows: [
          {
            type: 'toggle',
            name: '产出动作',
            desc: '写下的收进的读完的，都是真正产出东西的动作。',
            binding: { key: 'homeTimelineProduce' },
          },
          {
            type: 'toggle',
            name: '状态推进',
            desc: '加入片单读到一半新增待办，这类还没成事实的推进。',
            binding: { key: 'homeTimelineProgress' },
          },
          {
            type: 'toggle',
            // 2026-09-12：「点评 ✦」→「小橘点评」（去符号；说明白这句话是谁说的）
            name: '小橘点评',
            desc: '小橘挂在痕迹下面的那句话，提醒动手早晚与日记连击。',
            binding: { key: 'homeTimelineNotes' },
          },
        ],
      },
      {
        // 预告栏组（issue 288 拆出）：右侧那一栏不属于时间线，自己一组
        icon: 'calendar-clock',
        name: '预告栏',
        rows: [
          {
            type: 'toggle',
            name: '明天预告卡',
            desc: '右侧那一栏复习剪藏与日记的预告，不看可以把整栏收掉。',
            binding: { key: 'homeNextCards' },
          },
        ],
      },
      {
        // 入口组（排最后）：拖动排序 + 移除/加回，内联编辑器
        icon: 'layout-grid',
        name: '入口',
        rows: [
          {
            type: 'custom',
            render: (body) => mountHomeEntryEditor(body, getApp()),
          },
        ],
      },
    ],
  };
}
