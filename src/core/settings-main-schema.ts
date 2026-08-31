/**
 * 主设置页 schema（ticket 131，ADR-0064）：BzSettingTab.display() 两区块（🤖 AI / 📂 数据存储
 * 路径）的声明式定义。归属 core 的理由：两区块均为跨域全局项（ADR-0009 设置所有权），且文案
 * lint（ticket 100）需以纯数据方式全量断言（本模块只依赖 core 与设置类型，node 环境可安全加载）。
 *
 * 行为零变化锚点：
 * - AI 服务商切换 → 密钥行显隐由 visibleWhen 声明（deepseek 显示 DeepSeek 行，其余显示 OpenCode 行，
 *   与原 refreshKeys 的 toggleClass 口径等价）；ticket 170 起 custom 显示自定义端点/模型/密钥行；
 * - 存储路径行 onCommit 的 warning 提示文案逐字保留（f1 防错提示，正文不带 emoji，铁律 7）；
 * - 区块标题 DOM 契约 .bz-setting-section-title 不破（无 icon 分组 = 区块标题平铺形态）。
 * - ticket 100 文案修正（键名/行为不动）：两个 API Key 行标题收短为「DeepSeek 密钥」「OpenCode 密钥」，
 *   全部描述改写为约 20 字自然句、去符号花样（原描述含括号/斜杠/域名/超长枚举，lint 不过）。
 */
import { AI_PROVIDER_REGISTRY } from './ai';
import { notice } from './notice';
import type { SettingsSchema } from './settings-schema';

/** 存储路径改动防错提示（f1；正文不带 emoji，铁律 7）——文案逐字冻结，勿改 */
export const STORAGE_PATH_COMMIT_NOTICE = '存储路径已修改：仅改路径，文件不会自动迁移，旧数据需自行迁移；重载插件后生效。';

/** 构造主设置页 schema（每次 display 重建；visibleWhen 在渲染器内随变更重求值） */
export function mainSettingsSchema(): SettingsSchema {
  return {
    groups: [
      {
        icon: 'sparkles',
        name: '🤖 AI',
        rows: [
          {
            type: 'select',
            name: 'AI 服务商',
            desc: '切换服务商后显示对应的配置项',
            binding: { key: 'aiProvider' },
            options: AI_PROVIDER_REGISTRY.map((p) => ({ value: p.id, label: p.label })),
          },
          {
            type: 'text',
            name: 'DeepSeek 密钥',
            desc: '留空则自动回退读取外部配置密钥',
            binding: { key: 'deepseekApiKey' },
            visibleWhen: (snapshot) => snapshot.aiProvider === 'deepseek',
          },
          {
            type: 'text',
            name: 'OpenCode 密钥',
            desc: '在订阅官网获取后填入这里',
            binding: { key: 'opencodeGoApiKey' },
            visibleWhen: (snapshot) => snapshot.aiProvider === 'opencode-go',
          },
          {
            type: 'text',
            name: '自定义 API 地址',
            desc: 'OpenAI 兼容服务的完整接口地址',
            binding: { key: 'aiCustomEndpoint' },
            placeholder: 'https://api.example.com/v1',
            visibleWhen: (snapshot) => snapshot.aiProvider === 'custom',
          },
          {
            type: 'text',
            name: '自定义模型',
            desc: '该服务使用的模型名称',
            binding: { key: 'aiCustomModel' },
            placeholder: 'taste-1',
            visibleWhen: (snapshot) => snapshot.aiProvider === 'custom',
          },
          {
            type: 'text',
            name: '自定义 API 密钥',
            desc: '在服务官网获取后填入这里',
            binding: { key: 'aiCustomApiKey' },
            visibleWhen: (snapshot) => snapshot.aiProvider === 'custom',
          },
          {
            type: 'number',
            name: '最大输出 token',
            desc: '每次请求输出上限，填 0 用 API 默认',
            binding: { key: 'aiMaxTokens' },
            min: 0,
            max: 1000000,
            step: 1000,
          },
        ],
      },
      {
        icon: 'folder-open',
        name: '📂 数据存储路径',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '数据存储路径',
            desc: '全部 JSON 数据文件统一存放的目录',
            binding: { key: 'storagePath' },
            onCommit: () => {
              notice(STORAGE_PATH_COMMIT_NOTICE, 'warning');
            },
          },
        ],
      },
    ],
  };
}
