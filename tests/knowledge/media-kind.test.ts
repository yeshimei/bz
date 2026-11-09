// @vitest-environment node
/**
 * 本机媒体类型判定（src/knowledge/media-kind.ts，ADR-0296）：
 * 扩展名白名单 → 影像/音声；标题取文件名去扩展名；文件选择器过滤器形状。
 */
import { describe, it, expect } from 'vitest';
import {
  LOCAL_MEDIA_FILTERS,
  MEDIA_KIND_LABEL,
  mediaExtOf,
  mediaKindOf,
  mediaTitleOf,
} from '../../src/knowledge/media-kind';

describe('mediaExtOf（路径 → 小写扩展名）', () => {
  it('正反斜杠都认；无扩展名 → 空串', () => {
    expect(mediaExtOf('D:/音频/播客.MP3')).toBe('mp3');
    expect(mediaExtOf('C:\\视频\\录屏.MKV')).toBe('mkv');
    expect(mediaExtOf('无扩展名')).toBe('');
    expect(mediaExtOf('')).toBe('');
  });
});

describe('mediaKindOf（白名单判定）', () => {
  it('视频容器 → video', () => {
    for (const ext of ['mp4', 'mkv', 'mov', 'webm', 'flv', 'avi', 'ts', 'm4v']) {
      expect(mediaKindOf(`x.${ext}`)).toBe('video');
    }
  });

  it('音声格式 → audio', () => {
    for (const ext of ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'wma']) {
      expect(mediaKindOf(`x.${ext}`)).toBe('audio');
    }
  });

  it('不在白名单 / 无扩展名 → null（调用方据此拒绝导入）', () => {
    expect(mediaKindOf('笔记.md')).toBeNull();
    expect(mediaKindOf('压缩包.zip')).toBeNull();
    expect(mediaKindOf('没有后缀')).toBeNull();
    expect(mediaKindOf('')).toBeNull();
  });
});

describe('mediaTitleOf（文件名去扩展名，本地任务的缺省标题）', () => {
  it('去目录、去扩展名；多点在文件名里只去最后一段', () => {
    expect(mediaTitleOf('D:/音频/2026 播客 第 3 期.mp3')).toBe('2026 播客 第 3 期');
    expect(mediaTitleOf('C:\\x\\a.b.c.wav')).toBe('a.b.c');
    expect(mediaTitleOf('.hidden')).toBe('.hidden');
    expect(mediaTitleOf('')).toBe('');
  });
});

describe('MEDIA_KIND_LABEL / LOCAL_MEDIA_FILTERS', () => {
  it('标签是「影像 / 音声」（与文献类型徽标同源）', () => {
    expect(MEDIA_KIND_LABEL.video).toBe('影像');
    expect(MEDIA_KIND_LABEL.audio).toBe('音声');
  });

  it('过滤器：合并项 + 分项，扩展名不带点', () => {
    expect(LOCAL_MEDIA_FILTERS).toHaveLength(3);
    expect(LOCAL_MEDIA_FILTERS[0].name).toBe('视频与音声');
    expect(LOCAL_MEDIA_FILTERS[0].ext).toContain('mp4');
    expect(LOCAL_MEDIA_FILTERS[0].ext).toContain('mp3');
    expect(LOCAL_MEDIA_FILTERS.every((f) => f.ext.every((e) => !e.startsWith('.')))).toBe(true);
  });
});
