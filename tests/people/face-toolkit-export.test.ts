// @vitest-environment node
/**
 * 脸谱工具包 bz-face export 判定层测试（issue 485）。
 *
 * 被测对象是包内纯判定层 tools/obsidian-face/lib/export-core.js（CommonJS）与 sync-core
 * 的中继参数化——全部注入假件 / 预录输入，**不真跑子进程、不探测真实环境、不碰真实数据根**。
 * 覆盖：export 参数解析（--data-root 与至少一个 --contact 必填 / 可重复 / 畸形拒收）、
 * 预检判定（缺缓存密钥 / 缺解密库 / 联系人目录缺席 → 各自硬失败给中文引导；与 sync 预检
 * 的分道点：不探微信）、转发中继兜底文案带命令名。
 */
import { describe, it, expect } from 'vitest';
import { parseExportArgv, parseContactsFileText, judgeExportPreflight } from '../../tools/obsidian-face/lib/export-core.js';
import { createSyncRelay, SYNC_PHASES } from '../../tools/obsidian-face/lib/sync-core.js';
import { parseBzLine } from '../../src/core/external-tool';

describe('bz-face export 判定层（issue 485）', () => {
  describe('参数解析', () => {
    it('全参数：--data-root / --contact 可重复 / --python / --src（空格写法与等号写法）', () => {
      expect(
        parseExportArgv(['export', '--data-root', 'E:\\根', '--contact', '大琳', '--contact', '老周', '--python', 'py', '--src', 'C:\\账号']),
      ).toMatchObject({
        command: 'export',
        dataRoot: 'E:\\根',
        contacts: ['大琳', '老周'],
        python: 'py',
        src: 'C:\\账号',
      });
      expect(parseExportArgv(['--data-root=D:\\根', '--contact=阿四']).contacts).toEqual(['阿四']);
      expect(parseExportArgv(['export', '--data-root', 'x', '--contact', ' 陈默 ']).contacts).toEqual([' 陈默 ']); // 名单原样（目录名以扫描为准，不猜 trim）
    });

    it('--data-root 与至少一个 --contact 必填（help/version 例外）', () => {
      expect(parseExportArgv(['export']).error).toContain('--data-root');
      expect(parseExportArgv(['export', '--data-root', 'x']).error).toContain('--contact');
      expect(parseExportArgv(['export', '--data-root', 'x', '--contact', '']).error).toContain('--contact');
      expect(parseExportArgv(['export', '--help']).help).toBe(true);
      expect(parseExportArgv(['export', '--version']).version).toBe(true);
    });

    it('畸形值拒收：缺值、未知参数', () => {
      expect(parseExportArgv(['export', '--data-root']).error).toContain('--data-root');
      expect(parseExportArgv(['export', '--data-root', 'x', '--contact']).error).toContain('--contact');
      expect(parseExportArgv(['export', '--data-root', 'x', '--contact', '甲', '--wat']).error).toContain('未知参数');
      expect(parseExportArgv(['export', '--data-root', 'x', '--contacts-file']).error).toContain('--contacts-file');
    });

    it('--contacts-file：记路径不读盘（文件展开在 bin）；有它即可免 --contact（issue 510）', () => {
      const parsed = parseExportArgv(['export', '--data-root', 'E:\\根', '--contacts-file', 'E:\\名单.txt']);
      expect(parsed).toMatchObject({ dataRoot: 'E:\\根', contactsFile: 'E:\\名单.txt' });
      expect(parsed.error).toBeUndefined();
      expect(parseExportArgv(['export', '--data-root', 'E:\\根', '--contacts-file=E:\\名单.txt']).contactsFile).toBe('E:\\名单.txt');
    });

    it('名单文件文本解析：一行一个 / 逗号顿号分号同行多人 / # 注释与空行 / BOM（issue 510）', () => {
      expect(
        parseContactsFileText('大琳\n老周\r\n陈默、阿四,乙;丙\n\n# 注释行\n  丁  \n'),
      ).toEqual(['大琳', '老周', '陈默', '阿四', '乙', '丙', '丁']);
      expect(parseContactsFileText('\uFEFF大琳\r\n')).toEqual(['大琳']);
      expect(parseContactsFileText('')).toEqual([]);
      expect(parseContactsFileText('# 只有注释\n\n')).toEqual([]);
    });
  });

  describe('预检判定（与 sync 分道：不探微信，吃缓存产物）', () => {
    const okRoot = { configured: true, path: 'E:\\根', exists: true, writable: true };
    const happy = { contacts: ['大琳'], cachedKey: true, hasDecrypted: true, missingContacts: [] as string[] };

    it('齐备 → 放行', () => {
      expect(judgeExportPreflight({ dataRoot: okRoot }, happy).ok).toBe(true);
    });

    it('数据根：未配置 / 不存在 / 不可写 → 各自硬失败', () => {
      expect(judgeExportPreflight({ dataRoot: { configured: false } }, happy).error).toContain('--data-root');
      const missing = judgeExportPreflight({ dataRoot: { configured: true, path: 'X:\\缺失', exists: false } }, happy);
      expect(missing.ok).toBe(false);
      expect(missing.error).toContain('X:\\缺失');
      const ro = judgeExportPreflight({ dataRoot: { configured: true, path: 'D:\\只读', exists: true, writable: false } }, happy);
      expect(ro.error).toContain('不可写');
    });

    it('名单为空 → 硬失败点名 --contact', () => {
      expect(judgeExportPreflight({ dataRoot: okRoot }, { ...happy, contacts: [] }).error).toContain('--contact');
    });

    it('缺缓存密钥 / 缺解密库 → 各自硬失败并引导先跑 sync', () => {
      const noKey = judgeExportPreflight({ dataRoot: okRoot }, { ...happy, cachedKey: false });
      expect(noKey.ok).toBe(false);
      expect(noKey.error).toContain('key.json');
      expect(noKey.error).toContain('bz-face sync');
      const noDb = judgeExportPreflight({ dataRoot: okRoot }, { ...happy, hasDecrypted: false });
      expect(noDb.ok).toBe(false);
      expect(noDb.error).toContain('decrypted');
    });

    it('联系人目录缺席 → 点名前 3 位 + 总数；不静默起跑', () => {
      const one = judgeExportPreflight({ dataRoot: okRoot }, { ...happy, missingContacts: ['大琳'] });
      expect(one.ok).toBe(false);
      expect(one.error).toContain('「大琳」');
      const four = judgeExportPreflight(
        { dataRoot: okRoot },
        { ...happy, contacts: ['甲', '乙', '丙', '丁'], missingContacts: ['甲', '乙', '丙', '丁'] },
      );
      expect(four.error).toContain('等 4 位');
      expect(four.error).not.toContain('「丁」');
    });
  });

  describe('转发中继（485 参数化命令名）', () => {
    it('兜底结果行的文案带调用命令名（sync / export 各自可见）；行可被 parseBzLine 解析', () => {
      const exportLine = createSyncRelay('bz-face export --contact').finish(0, '')[0];
      expect(exportLine).toContain('重跑 bz-face export --contact');
      expect(parseBzLine(exportLine)?.kind).toBe('result');

      const syncLine = createSyncRelay().finish(0, '')[0];
      expect(syncLine).toContain('重跑 bz-face sync');
    });

    it('见过 [bz-result] 不补行（透传语义与 sync 轮一致）', () => {
      const relay = createSyncRelay('bz-face export --contact');
      relay.write('[bz-result] {"ok":true,"mode":"export","written":1}');
      expect(relay.finish(0, '')).toEqual([]);
    });
  });

  describe('sync 阶段词汇表（485 变轻后的口径）', () => {
    it('contacts 阶段改「统计联系人」；phase 词（机器契约）不变', () => {
      expect(SYNC_PHASES.map((p) => p.id)).toEqual(['key', 'decrypt', 'contacts', 'avatar']);
      expect(SYNC_PHASES.find((p) => p.id === 'contacts')?.label).toBe('统计联系人');
    });
  });
});
