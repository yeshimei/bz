#!/usr/bin/env node

/**
 * douban-poster - 豆瓣海报自动抓取
 * 统一 CLI 入口
 *
 * 用法:
 *   douban-poster watch          前台运行 watcher
 *   douban-poster fetch <file>   对单个笔记抓取海报
 *   douban-poster start          通过 pm2 启动 watcher（后台守护）
 *   douban-poster stop           停止 pm2 进程
 *   douban-poster status         查看 pm2 进程状态
 *   douban-poster logs           查看 pm2 日志
 */

import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, ensureConfig } from './config.js';
import { fetchPosterForNote } from './pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PM2_NAME = 'douban-poster';

const command = process.argv[2];
const config = loadConfig();

// 需要配置的命令
const needsConfig = ['watch', 'fetch', 'start'];
if (needsConfig.includes(command) && !ensureConfig(config)) {
  process.exit(1);
}

function runPm2(args) {
  try {
    execSync(`npx pm2 ${args}`, { stdio: 'inherit' });
  } catch {
    console.error('[错误] pm2 未安装，请运行: npm install -g pm2');
    process.exit(1);
  }
}

switch (command) {
  case 'watch': {
    const { default: chokidar } = await import('chokidar');
    const { collectMissingPosterNotes, sortByBirthtime, createProcessor } = await import('./watcher.js');
    const movieFolder = path.join(config.vaultPath, config.movieFolder);
    // 抓取间隔（ms）：每个完成后等 15s，避免豆瓣接口限流
    const FETCH_INTERVAL = 15000;
    // 事件防抖（ms）：create/change 触发扫描前的合并窗口
    const SCAN_DEBOUNCE = 10000;

    console.log(`[Watcher] 开始监听: ${movieFolder}`);

    // 串行处理器：每个抓取完成后等 15s 再处理下一个
    const processor = createProcessor({
      interval: FETCH_INTERVAL,
      onNote: async (notePath) => {
        console.log(`[队列] 开始处理: ${path.basename(notePath)}`);
        await fetchPosterForNote(notePath, config);
      },
    });

    // 全目录扫描：缺海报的笔记入队（按创建时间倒序，最新创建的先抓）
    function scan() {
      const missing = sortByBirthtime(collectMissingPosterNotes(movieFolder));
      if (missing.length === 0) return;
      console.log(`[扫描] 发现 ${missing.length} 个缺海报的笔记，加入队列`);
      processor.pushMany(missing);
    }

    // 启动立即扫描一次
    scan();

    let scanTimer = null;
    const scheduleScan = () => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(scan, SCAN_DEBOUNCE);
    };

    const watcher = chokidar.watch(movieFolder, {
      ignoreInitial: true,
      depth: 0,
    });

    // 创建/改动均触发扫描（扫描幂等：已有海报的笔记自动跳过）
    watcher.on('add', (filePath) => {
      if (!filePath.endsWith('.md')) return;
      scheduleScan();
    });
    watcher.on('change', (filePath) => {
      if (!filePath.endsWith('.md')) return;
      scheduleScan();
    });

    watcher.on('error', (err) => {
      console.error('[Watcher] 监听错误:', err.message);
    });

    process.on('SIGINT', () => {
      console.log('\n[Watcher] 正在退出...');
      if (scanTimer) clearTimeout(scanTimer);
      watcher.close();
      process.exit(0);
    });
    break;
  }

  case 'fetch': {
    const input = process.argv[3];
    if (!input) {
      console.log('用法: douban-poster fetch <笔记文件名或路径>');
      console.log('示例: douban-poster fetch 《肖申克的救赎》.md');
      process.exit(1);
    }

    const movieFolder = path.join(config.vaultPath, config.movieFolder);
    const notePath = path.isAbsolute(input) ? input : path.join(movieFolder, input);
    await fetchPosterForNote(notePath, config);
    break;
  }

  case 'start': {
    console.log('[pm2] 启动 watcher...');
    runPm2(`start ${path.join(__dirname, 'cli.js')} --name ${PM2_NAME} -- watch`);
    console.log('[pm2] 已启动。使用 douban-poster status 查看状态。');
    break;
  }

  case 'stop': {
    runPm2(`stop ${PM2_NAME}`);
    break;
  }

  case 'status': {
    runPm2('status');
    break;
  }

  case 'logs': {
    runPm2(`logs ${PM2_NAME} --lines 50`);
    break;
  }

  default: {
    console.log(`
douban-poster - 豆瓣海报自动抓取

用法:
  douban-poster watch          前台运行 watcher
  douban-poster fetch <file>   对单个笔记抓取海报
  douban-poster start          通过 pm2 启动 watcher（后台守护）
  douban-poster stop           停止 pm2 进程
  douban-poster status         查看 pm2 进程状态
  douban-poster logs           查看 pm2 日志

配置文件: ~/.douban-posterrc
`.trim());
    break;
  }
}
