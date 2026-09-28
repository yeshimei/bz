// ================================================================
// bz-face rec / refs —— 录音分离与声纹质心的判定层（纯函数，零依赖；issue 509 / ADR-0214）
//
// 职责切分（照 sync / export / prep 的三层切分）：
//   python/bz_rec.py   rec 轮本体（分离转写：VAD 门控 → CAM++ 滑窗 + Viterbi → SenseVoice 逐轮）
//   python/bz_refs.py  refs 轮本体（质心构建：chat.json who 标签 × voice/*.wav 分池均值）
//   lib/rec-core.js    本文件——CLI 参数解析 / 预检判定（进度权威在 sidecar，不走四行协议中继）
//   bin/bz-face.js     CLI 薄壳——预检 → 起子进程 → stdout 透传 → 汇总退出码
//
// 与 prep 的分工：prep 是聊天媒体的导出 / 转写（voice.json / image_map 旁路表）；
// rec 是补充素材录音（recordings/ 下的独立音频文件）的说话人分离与逐轮转写，
// sidecar（<file>.turns.json）phase 账本断点续跑——stdout 打印仅供人看，
// 插件轮询 sidecar 渲染进度，故本层没有中继 / 协议行组装。
//
// 铁的约定（同 sync-core）：
//   1. 本文件任何函数不得抛异常——畸形输入一律降级成失败结果；
//   2. 绝不执行任何安装；缺质心不是预检错误（降级阶梯 dual → me-only → blind，rec 照跑）。
// ================================================================
'use strict';
const path = require('path');
const fs = require('fs');

// ---- CLI 参数解析（rec / refs 子命令）----

/**
 * 解析 bz-face rec 的 argv：
 *   bz-face rec <录音文件名> --data-root <路径> --contact <目录名> [--python <命令>] [--help|--version]
 * 录音文件名 / --data-root / --contact 必填；文件名是 recordings/ 下的名字（含扩展名）。
 * @returns {{ command:'rec'|null, file?:string, dataRoot?:string, contact?:string,
 *            python?:string, help?:boolean, version?:boolean, error?:string }}
 */
function parseRecArgv(argv) {
  const out = { command: 'rec' };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'rec') i += 1;
  const positional = [];
  for (; i < args.length; i++) {
    let arg = String(args[i]);
    let inlineValue;
    const eq = arg.indexOf('=');
    if (eq > 2 && arg.startsWith('--')) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 < args.length) {
        i += 1;
        return String(args[i]);
      }
      return undefined;
    };
    switch (arg) {
      case '--data-root':
      case '-d': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--data-root 需要一个路径参数' };
        out.dataRoot = v;
        break;
      }
      case '--python':
      case '-p': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--python 需要一个命令参数' };
        out.python = v;
        break;
      }
      case '--contact': {
        const v = takeValue();
        if (v === undefined || !v.trim()) return { command: null, error: '--contact 需要一个联系人目录名参数' };
        out.contact = v;
        break;
      }
      case '--help':
        out.help = true;
        return out;
      case '--version':
        out.version = true;
        return out;
      default:
        if (arg.startsWith('-')) return { command: null, error: `未知参数「${arg}」` };
        positional.push(arg);
    }
  }
  if (positional.length > 1) return { command: null, error: '录音文件名只收一个（recordings/ 下的文件名，含扩展名）' };
  if (positional.length === 1) out.file = positional[0];
  if (!out.file) return { command: null, error: '缺录音文件名——用法：bz-face rec <录音文件名> --data-root <路径> --contact <目录名>' };
  if (!out.dataRoot) return { command: null, error: '--data-root 需要一个路径参数' };
  if (!out.contact) return { command: null, error: '--contact 需要一个联系人目录名参数' };
  return out;
}

/**
 * 解析 bz-face refs 的 argv：
 *   bz-face refs --data-root <路径> --contact <目录名> [--contact <目录名> …] [--python <命令>] [--help|--version]
 * --data-root 与至少一个 --contact 必填（--contact 可重复；去重在 Python 侧做）。
 */
function parseRefsArgv(argv) {
  const out = { command: 'refs', contacts: [] };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'refs') i += 1;
  for (; i < args.length; i++) {
    let arg = String(args[i]);
    let inlineValue;
    const eq = arg.indexOf('=');
    if (eq > 2 && arg.startsWith('--')) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 < args.length) {
        i += 1;
        return String(args[i]);
      }
      return undefined;
    };
    switch (arg) {
      case '--data-root':
      case '-d': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--data-root 需要一个路径参数' };
        out.dataRoot = v;
        break;
      }
      case '--python':
      case '-p': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--python 需要一个命令参数' };
        out.python = v;
        break;
      }
      case '--contact': {
        const v = takeValue();
        if (v === undefined || !v.trim()) return { command: null, error: '--contact 需要一个联系人目录名参数' };
        out.contacts.push(v);
        break;
      }
      case '--help':
        out.help = true;
        return out;
      case '--version':
        out.version = true;
        return out;
      default:
        return { command: null, error: `未知参数「${arg}」` };
    }
  }
  if (!out.dataRoot) return { command: null, error: '--data-root 需要一个路径参数' };
  if (!out.contacts.length) return { command: null, error: '--contact 需要一个联系人目录名参数（可重复传多个）' };
  return out;
}

// ---- 预检判定 ----

/**
 * rec 预检：数据根存在可写、联系人目录在位、录音文件在位。缺质心不拦（降级阶梯照跑）。
 * @param {{ dataRoot:{configured:boolean,path?:string,exists?:boolean,writable?:boolean},
 *          contact?:string, file?:string }} probes
 * @param {{ recordingExists:boolean, contactDirExists:boolean }} facts
 */
function judgeRecPreflight(probes, facts) {
  const d = probes.dataRoot;
  if (!d || !d.configured) return { ok: false, error: '数据根未配置——先在设置里填数据源目录（--data-root）' };
  if (!d.exists) return { ok: false, error: `数据根目录不存在：${d.path}` };
  if (d.writable === false) return { ok: false, error: `数据根目录不可写：${d.path}` };
  if (!facts.contactDirExists) return { ok: false, error: `联系人目录不存在：${path.join(String(d.path || ''), String(probes.contact || ''))}——先跑 bz-face export` };
  if (!facts.recordingExists) {
    return { ok: false, error: `录音不存在：${path.join(String(d.path || ''), String(probes.contact || ''), 'recordings', String(probes.file || ''))}` };
  }
  return { ok: true };
}

/**
 * refs 预检：数据根存在可写、每位联系人目录在位（缺 voice/ 不拦——样本不足走 me-only / 跳过）。
 * @param {{ dataRoot:{configured:boolean,path?:string,exists?:boolean,writable?:boolean} }} probes
 * @param {{ contacts:string[], missingContacts:string[] }} facts
 */
function judgeRefsPreflight(probes, facts) {
  const d = probes.dataRoot;
  if (!d || !d.configured) return { ok: false, error: '数据根未配置——先在设置里填数据源目录（--data-root）' };
  if (!d.exists) return { ok: false, error: `数据根目录不存在：${d.path}` };
  if (d.writable === false) return { ok: false, error: `数据根目录不可写：${d.path}` };
  if (facts.missingContacts.length) {
    return { ok: false, error: `联系人目录不存在：${facts.missingContacts.join('、')}（数据根 ${d.path} 下）——目录名以数据源扫描为准` };
  }
  return { ok: true };
}

/** 录音文件在位探测（任何 IO 异常按缺席；rec 预检用） */
function recordingExists(dataRoot, contact, file) {
  try {
    return fs.statSync(path.join(String(dataRoot || ''), String(contact || ''), 'recordings', String(file || ''))).isFile();
  } catch {
    return false;
  }
}

/** 联系人目录在位探测（rec / refs 预检共用） */
function contactDirExists(dataRoot, contact) {
  try {
    return fs.statSync(path.join(String(dataRoot || ''), String(contact || ''))).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { parseRecArgv, parseRefsArgv, judgeRecPreflight, judgeRefsPreflight, recordingExists, contactDirExists };
