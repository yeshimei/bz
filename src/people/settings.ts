/**
 * 脸谱域（people）设置 schema（issue 446/447）：数据源 / 预览 / 隐私 三组，声明式
 * （ADR-0064 渲染器）。数据文件夹在 vault 外（预处理线产出），故用文本行粘贴路径而非
 * vault 内选择器；「清空预览」经 loader 回调接线（core 不反向依赖域，knowledge 同款）。
 * 447 拍板：「打开时自动扫描」与「生成」组（GenTrigger/GenThreshold）随自动链路一并退役——
 * 扫描在打开数据源弹窗时进行，生成由弹窗内「画脸谱」手动触发。
 */
import type { SettingsSchema } from '../core/settings-schema';

export function peopleSettingsSchema(opts?: { onClearPreview?: () => void | Promise<void> }): SettingsSchema {
  return {
    groups: [
      {
        icon: 'folder-open',
        name: '数据源',
        rows: [
          {
            type: 'text',
            name: '数据文件夹',
            desc: '预处理导出的联系人数据目录，粘贴完整路径；空 = 面板不显示数据源入口',
            binding: { key: 'peopleDataDir' },
            placeholder: '例如 D:\\微信备份\\export_full',
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
        name: '预览',
        rows: [
          {
            type: 'toggle',
            name: '语音转写',
            desc: '语音消息以转写文本进预览',
            binding: { key: 'peoplePreviewVoice' },
          },
          {
            type: 'select',
            name: '图片描述',
            desc: '图片条目的描述文本来源',
            binding: { key: 'peopleImageDescMode' },
            options: [
              { value: 'file', label: '预生成文件' },
              { value: 'ai', label: 'AI 视觉' },
              { value: 'off', label: '不读取' },
            ],
          },
          {
            type: 'info',
            name: 'AI 视觉暂未接入',
            desc: '先用其他来源，接入后无需改数据',
            visibleWhen: (s) => String((s as Record<string, unknown>).peopleImageDescMode ?? 'file') === 'ai',
          },
          {
            type: 'toggle',
            name: '视频标签',
            desc: '视频消息以时长标签进预览',
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
            name: '原始媒体不入库',
            desc: '图片语音视频文件留在外部数据目录，不复制进库',
          },
          {
            type: 'info',
            name: '预览只存文本',
            desc: '语音转写与图片描述以文本进预览缓存',
          },
          {
            type: 'button',
            name: '清空预览',
            buttonText: '清空',
            cta: true,
            desc: '清掉全部导入预览缓存，不动已生成的脸谱',
            onClick: () => void opts?.onClearPreview?.(),
          },
        ],
      },
    ],
  };
}
