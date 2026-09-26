/**
 * 脸谱域（people）设置 schema（issue 446/447/457）：数据源 / 媒体 / 预览 / 隐私 四组，声明式
 * （ADR-0064 渲染器）。
 * 457 口径：每行描述一律**一句纯功能描述**（是什么、干什么），不再夹带条件尾巴
 * （「空 = 面板不显示数据源入口」这类规则说明退场）；两处目录录入态各归其位——
 * 数据文件夹（vault 外的预处理产出目录）用**系统文件夹选择器**（core/path-picker
 * pickSystemFolder，可选库外目录，输入框保留供粘贴），媒体文件夹（库内路径）用
 * **vault 文件夹选择器**（type:'path' 路径行，ADR-0061）。
 * 「清空预览」经 loader 回调接线（core 不反向依赖域，knowledge 同款）。
 * 447 拍板：「打开时自动扫描」与「生成」组（GenTrigger/GenThreshold）随自动链路一并退役——
 * 扫描在打开数据源弹窗时进行，生成由弹窗内「画脸谱」手动触发。
 */
import type { SettingsSchema } from '../core/settings-schema';
import { getSettings, saveSettings } from '../core/settings-provider';
import { pickSystemFolder } from '../core/path-picker';
import { notifyActionError } from '../core/notice';
import { peopleMediaDir } from './datasource';

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
            desc: '微信聊天导出的联系人数据目录',
            help:
              '外部数据根目录，结构为 <数据根>/<联系人>/chat.json，voice.json 与 image_desc.json 为兼容兜底。' +
              '留空则面板不显示数据源入口。换目录后要在数据源弹窗点刷新重新扫描，不会自动重扫。',
            binding: { key: 'peopleDataDir' },
            placeholder: '例如 D:\\微信备份\\export_full',
            actions: [
              {
                text: '选择…',
                onClick: async () => {
                  const dir = await pickSystemFolder();
                  if (!dir) return;
                  try {
                    getSettings().peopleDataDir = dir;
                    await saveSettings();
                  } catch (e) {
                    notifyActionError(e, '保存数据文件夹');
                  }
                },
              },
            ],
          },
          {
            type: 'toggle',
            name: '群聊纳入列表',
            desc: '群聊会话也进勾选列表',
            binding: { key: 'peopleIncludeGroups' },
          },
        ],
      },
      {
        icon: 'image',
        name: '媒体',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '媒体文件夹',
            desc: '库内存放头像的文件夹',
            binding: { key: 'peopleMediaDir' },
            fallbackValue: () => peopleMediaDir(),
          },
          {
            type: 'info',
            name: '头像入库',
            desc: '只有头像复制进库，其余媒体留在外部数据目录',
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
            desc: '有描述的图片以描述文本进预览',
            binding: { key: 'peopleImageDescMode' },
            options: [
              { value: 'file', label: '文件描述' },
              { value: 'off', label: '仅标签' },
            ],
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
            desc: '撤回与打招呼等消息保留',
            binding: { key: 'peopleKeepSystem' },
          },
        ],
      },
      {
        icon: 'shield',
        name: '隐私',
        rows: [
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
