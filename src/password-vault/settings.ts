/**
 * 保险库（password-vault）设置 schema（ADR-0078）
 * 保险库 UI 无 ⚙️ 弹窗（用户拍板），设置入口并入设置面板（settings-panel）。
 * 生成器设置复用全局键（passwordCharset/passwordLength）与安全模式（securityMode），
 * 与旧密码本同源；移动端恒真全屏（无开关，ADR-0078 Q16）。
 */
import { makeReloadWarnOnce, numStrBinding } from '../core/settings-common';
import type { SettingsSchema } from '../core/settings-schema';

/** 保险库设置 schema（生成 + 安全；不含移动端全屏开关——恒真全屏） */
export function passwordVaultSettingsSchema(): SettingsSchema {
  const warnReload = makeReloadWarnOnce();
  return {
    groups: [
      { icon: 'key-round', name: '生成', rows: [
        { type: 'text', name: '密码生成字符集', desc: '随机生成密码时使用的字符集', binding: { key: 'passwordCharset' }, onCommit: warnReload },
        { type: 'number', name: '密码生成长度', desc: '随机生成密码的字符个数', binding: numStrBinding('passwordLength', 16), min: 4, max: 128, step: 1, onCommit: warnReload },
      ]},
      { icon: 'shield', name: '安全', rows: [
        { type: 'toggle', name: '安全模式', desc: '关闭窗口立即自动上锁', binding: { key: 'securityMode' }, onChange: warnReload },
      ]},
    ],
  };
}
