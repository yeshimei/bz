/**
 * 媒体素材解析测试（issue 445）：标签解析矩阵（完整 / 缺时长 / 缺情感 / 旧空标签 / 空描述 /
 * 多段文本 / 标签在正文中）、媒体聚合、时长与计数文案、提示词素材说明。
 * 隐私口径：全部构造数据，不含真实聊天内容。（纯数据层，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildMediaNote,
  collectMediaStats,
  emptyMediaStats,
  formatDuration,
  formatMediaCount,
  formatRecordingDuration,
  parseMediaTag,
  parseRecordingDurationSec,
} from '../../src/people/media';
import type { UnifiedMessage } from '../../src/people/types';

const m = (text: string, isSender = false): UnifiedMessage => ({ ts: 1700000000000, isSender, text });

describe('parseMediaTag 解析矩阵', () => {
  it('完整标签：时长 + 情感 + 转写文本', () => {
    expect(parseMediaTag('[语音 12s·平静] 今晚吃什么')).toEqual({
      kind: 'voice',
      text: '今晚吃什么',
      durationSec: 12,
      emotion: '平静',
    });
  });
  it('缺时长：只有情感', () => {
    expect(parseMediaTag('[语音·开心] 哈哈哈')).toEqual({ kind: 'voice', text: '哈哈哈', emotion: '开心' });
  });
  it('缺情感：只有时长（小数秒也认）', () => {
    expect(parseMediaTag('[语音 12s] 在吗')).toEqual({ kind: 'voice', text: '在吗', durationSec: 12 });
    expect(parseMediaTag('[语音 3.5s] 嗯')).toEqual({ kind: 'voice', text: '嗯', durationSec: 3.5 });
  });
  it('录音标签：分秒时长 + 情感（509，与 [语音 N秒·情感] 同构）', () => {
    expect(parseMediaTag('[录音 3分02秒·平静] 转写文本')).toEqual({
      kind: 'recording',
      text: '转写文本',
      durationSec: 182,
      emotion: '平静',
    });
    expect(parseMediaTag('[录音 45秒] 短轮')).toEqual({ kind: 'recording', text: '短轮', durationSec: 45 });
    expect(parseMediaTag('[录音 2分] 整分')).toEqual({ kind: 'recording', text: '整分', durationSec: 120 });
    expect(parseMediaTag('[录音] 无属性轮')).toEqual({ kind: 'recording', text: '无属性轮' });
    expect(parseMediaTag('[录音]')).toBeNull();
    expect(parseMediaTag('正文里 [录音 1分] 不算素材')).toBeNull();
  });
  it('纯标签：无时长无情感也有素材', () => {
    expect(parseMediaTag('[语音] 收到了')).toEqual({ kind: 'voice', text: '收到了' });
  });
  it('图片：描述整体为素材', () => {
    expect(parseMediaTag('[图片] 一只猫趴在键盘上')).toEqual({ kind: 'image', text: '一只猫趴在键盘上' });
  });
  it('多段文本：标签后的换行内容整体保留', () => {
    expect(parseMediaTag('[语音 5s]\n第一段\n第二段')).toEqual({ kind: 'voice', text: '第一段\n第二段', durationSec: 5 });
  });
  it('旧空标签 / 空描述 → null（保持现状不出素材）', () => {
    expect(parseMediaTag('[语音]')).toBeNull();
    expect(parseMediaTag('[图片]')).toBeNull();
    expect(parseMediaTag('[语音]   ')).toBeNull();
    expect(parseMediaTag('[图片] ')).toBeNull();
  });
  it('纯文本 → null；标签在正文中（非开头）→ null', () => {
    expect(parseMediaTag('今天天气不错')).toBeNull();
    expect(parseMediaTag('看看这个 [图片] 好看吗')).toBeNull();
    expect(parseMediaTag('前半句 [语音 12s·平静] 后半句')).toBeNull();
  });
  it('空输入兜底', () => {
    expect(parseMediaTag('')).toBeNull();
  });
});

describe('collectMediaStats 聚合', () => {
  it('语音条数 / 总时长 / 图片张数；旧空标签与纯文本不计', () => {
    const stats = collectMediaStats([
      m('[语音 12s·平静] 一'),
      m('[语音 30s] 二'),
      m('[语音] 三'), // 有素材但没时长：计条数不计时长
      m('[图片] 描述一'),
      m('[图片] 描述二'),
      m('[录音 3分02秒·平静] 录音轮次'),
      m('[录音 30秒] 短录音'),
      m('[图片]'),
      m('普通文本'),
      m(''),
    ]);
    expect(stats).toEqual({ voiceCount: 3, voiceTotalSec: 42, imageCount: 2, recordingCount: 2, recordingTotalSec: 212 });
  });
  it('空消息流 → 全零', () => {
    expect(collectMediaStats([])).toEqual(emptyMediaStats());
  });
});

describe('展示与提示词文案', () => {
  it('formatDuration 自适应：秒 / 分 / 时', () => {
    expect(formatDuration(45)).toBe('45 秒');
    expect(formatDuration(245)).toBe('4 分');
    expect(formatDuration(7200)).toBe('2 时');
  });
  it('录音时长标签互转（509）', () => {
    expect(formatRecordingDuration(182)).toBe('3分02秒');
    expect(formatRecordingDuration(45)).toBe('45秒');
    expect(formatRecordingDuration(60)).toBe('1分00秒');
    expect(parseRecordingDurationSec('3分02秒')).toBe(182);
    expect(parseRecordingDurationSec('2分')).toBe(120);
    expect(parseRecordingDurationSec('45秒')).toBe(45);
    expect(parseRecordingDurationSec('12s')).toBeUndefined();
    expect(parseRecordingDurationSec('平静')).toBeUndefined();
  });
  it('formatMediaCount：零项不出现，全零为空串', () => {
    expect(formatMediaCount({ ...emptyMediaStats(), voiceCount: 26, voiceTotalSec: 245, imageCount: 14 })).toBe('语音 26 条 · 4 分 · 图片 14 张');
    expect(formatMediaCount({ ...emptyMediaStats(), voiceCount: 3 })).toBe('语音 3 条');
    expect(formatMediaCount({ ...emptyMediaStats(), imageCount: 5 })).toBe('图片 5 张');
    expect(formatMediaCount({ ...emptyMediaStats(), recordingCount: 2, recordingTotalSec: 245 })).toBe('录音 2 段 · 4 分');
    expect(formatMediaCount({ ...emptyMediaStats(), voiceCount: 1, recordingCount: 2, imageCount: 3 })).toBe('语音 1 条 · 录音 2 段 · 图片 3 张');
    expect(formatMediaCount(emptyMediaStats())).toBe('');
  });
  it('buildMediaNote：无媒体返回空串；有语音带情感标记说明', () => {
    expect(buildMediaNote(emptyMediaStats())).toBe('');
    const note = buildMediaNote({ ...emptyMediaStats(), voiceCount: 26, voiceTotalSec: 245, imageCount: 14 });
    expect(note).toContain('语音 26 条 · 4 分 · 图片 14 张');
    expect(note).toContain('情感识别');
    // 纯图片素材不提语音情感
    const imageOnly = buildMediaNote({ ...emptyMediaStats(), imageCount: 2 });
    expect(imageOnly).toContain('图片 2 张');
    expect(imageOnly).not.toContain('情感');
  });
  it('群聊成员名前缀：[成员名] [语音/图片 …] 照常解析出素材（issue 449 评审 P1-1）', () => {
    expect(parseMediaTag('[甲] [语音 12s·开心] 构造原话')).toEqual({
      kind: 'voice',
      text: '构造原话',
      durationSec: 12,
      emotion: '开心',
    });
    expect(parseMediaTag('[乙] [图片] 构造描述')).toEqual({ kind: 'image', text: '构造描述' });
  });

  it('已知标签名不做前缀剥离：[引用…] / [视频 N秒] / [分享] 仍不解析出素材', () => {
    expect(parseMediaTag('[引用「xx」] [语音 5s] 嗯')).toBeNull();
    expect(parseMediaTag('[视频 61秒]')).toBeNull();
    expect(parseMediaTag('[分享] 构造分享')).toBeNull();
  });
});
