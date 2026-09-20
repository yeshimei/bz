// @vitest-environment node
/**
 * GS3（呈报#48）gameshelf 侧接入回归：Steam Web API 密钥行接「密钥型」档位。
 * 修复前必红：密钥行 type 为 'text'（明文裸奔）；拍板后应为 'secret'
 * （settings-panel 密钥型档位：type=password 掩码显示 + 眼睛切换明文）。
 * SteamID64 行不受影响（仍为普通 text 行）。
 */
import { describe, it, expect } from 'vitest';
import { gameshelfSettingsSchema } from '../../src/gameshelf/settings';

describe('GS3：Steam Web API 密钥行 = 密钥型档位', () => {
  const schema = gameshelfSettingsSchema();
  const steam = schema.groups.find((g) => g.name === 'Steam')!;
  const keyRow = steam.rows.find((r) => (r as { name?: string }).name === 'Web API 密钥') as unknown as Record<string, unknown>;
  const idRow = steam.rows.find((r) => (r as { name?: string }).name === 'SteamID64') as unknown as Record<string, unknown>;

  it('修复前必红：密钥行 type 应为 secret（修复前 text 明文）', () => {
    expect(keyRow.type).toBe('secret');
  });

  it('密钥行契约完整：绑定键 / 占位 / 描述随档位保留', () => {
    expect((keyRow.binding as { key: string }).key).toBe('gameshelfSteamApiKey');
    expect(keyRow.placeholder).toBe('32 位十六进制串');
    expect(keyRow.desc).toBe('在 Steam 官网开发者页免费申请');
  });

  it('SteamID64 行不误伤：仍为普通 text 行', () => {
    expect(idRow.type).toBe('text');
  });

  it('Steam 组行序不变：SteamID64 → Web API 密钥 → 自动同步', () => {
    expect(steam.rows.map((r) => (r as { name?: string }).name)).toEqual(['SteamID64', 'Web API 密钥', '自动同步']);
  });
});
