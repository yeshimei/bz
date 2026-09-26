/**
 * 脸谱域（people）设置 schema（issue 446/447；聊天仓口径 issue 466 / ADR-0197；
 * 467 / ADR-0194 入保库）：数据源 / 聊天仓 / 隐私 三组，声明式（ADR-0064 渲染器）。
 * 数据根目录在 vault 外（预处理线产出），故用文本行粘贴路径而非 vault 内选择器；
 * 「清空聊天数据」经 loader 回调接线（core 不反向依赖域，knowledge 同款）。
 * 447 拍板：「打开时自动扫描」与「生成」组（GenTrigger/GenThreshold）随自动链路一并退役——
 * 扫描在打开数据源弹窗时进行，生成由弹窗内「画脸谱」手动触发。
 * 467 退役：「媒体」组（peopleMediaDir 媒体文件夹 + 头像入库说明）随明文媒体目录一并退役——
 * 头像作为密文附件随保库记录走，库内不再有明文头像目录。
 */
import type { SettingsSchema } from '../core/settings-schema';

export function peopleSettingsSchema(opts?: { onClearStore?: () => void | Promise<void> }): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '数据源',
        rows: [
          {
            type: 'text',
            name: '数据根目录',
            desc: '预处理导出的联系人数据目录，粘贴完整路径；空 = 面板不显示数据源入口',
            binding: { key: 'peopleDataDir' },
            placeholder: '例如 D:\\微信备份\\export_full',
          },
          // 微信账号目录（issue 462）：多账号数据目录下指定用哪个账号；空 = 自动探测
          // （探测与覆盖逻辑由后续票接入，本票只加键位与文案）
          {
            type: 'text',
            name: '微信账号目录',
            desc: '数据目录下的微信账号文件夹，留空自动探测',
            binding: { key: 'peopleWxAccountDir' },
            placeholder: '空 = 自动探测',
          },
          {
            type: 'toggle',
            name: '群聊纳入列表',
            desc: '多位发送者的会话也进勾选列表',
            binding: { key: 'peopleIncludeGroups' },
          },
        ],
      },
      {
        icon: 'eye',
        name: '聊天仓',
        rows: [
          {
            type: 'toggle',
            name: '语音转写',
            desc: '语音消息以转写文本进时间线',
            binding: { key: 'peoplePreviewVoice' },
          },
          {
            type: 'select',
            name: '图片描述',
            desc: '有描述的图片以描述文本进时间线（chat.json 已回填，读文件为兼容兜底）；无描述只计数',
            binding: { key: 'peopleImageDescMode' },
            options: [
              { value: 'file', label: '文件描述' },
              { value: 'off', label: '仅标签' },
            ],
          },
          {
            type: 'toggle',
            name: '视频标签',
            desc: '视频消息以时长标签进时间线',
            binding: { key: 'peoplePreviewVideo' },
          },
          {
            type: 'toggle',
            name: '系统消息',
            desc: '撤回与打招呼等锚点消息保留',
            binding: { key: 'peopleKeepSystem' },
          },
        ],
      },
      {
        icon: 'shield',
        name: '隐私',
        rows: [
          {
            type: 'info',
            name: '数据在保险库里',
            desc: '人物卡、聊天数据、任务与头像按联系人各存一条保险库加密记录，与保险库共用主密码；上锁即不可读',
          },
          {
            type: 'info',
            name: '媒体本体不入库',
            desc: '图片语音视频文件留在外部数据目录，加密记录只存消息与路径；头像以密文附件随记录走',
          },
          {
            type: 'button',
            name: '清空聊天数据',
            buttonText: '清空',
            cta: true,
            desc: '清掉各加密记录里的消息数据（需先解锁），不动已生成的脸谱',
            onClick: () => void opts?.onClearStore?.(),
          },
        ],
      },
    ],
  };
}
