/**
 * 游戏库（gameshelf）域设置 schema（接入设置面板；面板内无设置按钮，收敛进设置面板域页）。
 * 顺序与各域同范式（issue 246）：**外观 → 目录 → Steam**。
 * Steam 组 = 票 368 两键（SteamID64 / Web API 密钥）+ 自动同步开关；文案守 copy-lint 规范
 * （标题 4-8 字零符号、描述自然句不带符号花样）。
 */
import type { SettingsSchema } from '../core/settings-schema';

export function gameshelfSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        // 外观组（2026-09-17 用户点名补齐，与各域同款置顶）：布局单卡占位 + 主题单档，
        // layoutKey 联动同范式；两键目前只是占位（域内未消费皮肤），接入皮肤时在 styles.css 消费
        icon: 'palette',
        name: '外观',
        rows: [
          {
            type: 'choiceCards',
            name: '面板布局',
            binding: { key: 'gameshelfLayout' },
            options: [{ value: 'default', label: '海报墙', prevClass: 'bz-sp-prev-panel' }],
          },
          {
            type: 'choiceCards',
            name: '面板主题',
            binding: { key: 'gameshelfSkinTheme' },
            layoutKey: 'gameshelfLayout',
            options: [{ value: 'ink', label: '墨黑', layout: 'default', prevClass: 'bz-sp-prev-ink' }],
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '游戏文件夹',
            desc: '游戏库读取的游戏笔记文件夹',
            binding: { key: 'gameshelfFolderPath' },
          },
          {
            type: 'path',
            mode: 'single',
            name: '海报文件夹',
            desc: '游戏封面与图标缓存到本地的文件夹',
            binding: { key: 'gameshelfPosterFolder' },
          },
        ],
      },
      {
        icon: 'gamepad-2',
        name: 'Steam',
        rows: [
          {
            type: 'text',
            name: 'SteamID64',
            desc: 'Steam 的数字账号 ID',
            help:
              'Steam 账号的固定数字 ID，用来拉已购游戏、累计时长（分钟）、最近游玩时间与成就进度。格式是 17 位纯数字、固定以 7656 开头，不符合就判定为未配置，不会发出请求。' +
              '它和 Web API 密钥必须同时填好，同步才跑得起来；拉取走 Steam 官方接口，国内直连常被重置，需要系统代理。',
            binding: { key: 'gameshelfSteamId' },
            placeholder: '76561198000000000',
          },
          // GS3（呈报#48）：密钥行接「密钥型」档位——type=password 掩码显示 + 眼睛切换明文，
          // 原明文 text 行退役（旁人瞄屏不可见）；提交链与 text 行同内核。
          // 2026-09-23：档位收编进 core 的 SettingsRow 联合，行字面量直接写（secretRow() 断言退场）
          {
            type: 'secret',
            name: 'Web API 密钥',
            desc: '在 Steam 官网开发者页免费申请',
            help:
              'Steam Web API 的密钥，拉已购游戏、近期游玩与成就都要用它，在 Steam 官网开发者页免费申请。它与 SteamID64 是并列的必填项：任一为空，同步就停在未配置状态，不发出请求。' +
              '密钥是账号级的，要跟上面的 SteamID64 对上——配成别人的 ID，拉回来的就是别人的库；接口在国内直连常被重置，需要系统代理。',
            binding: { key: 'gameshelfSteamApiKey' },
            placeholder: '32 位十六进制串',
          },
          {
            type: 'toggle',
            name: '自动同步',
            desc: '打开面板时数据过期即自动拉取',
            binding: { key: 'gameshelfAutoSync' },
          },
        ],
      },
    ],
  };
}
