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
    const movieFolder = path.join(config.vaultPath, config.movieFolder);

    console.log(`[Watcher] 开始监听: ${movieFolder}`);

    const watcher = chokidar.watch(movieFolder, {
      ignoreInitial: true,
      depth: 0,
    });

    const processing = new Set();

    watcher.on('add', async (filePath) => {
      if (!filePath.endsWith('.md')) return;
      if (processing.has(filePath)) return;
      processing.add(filePath);

      console.log(`[Watcher] 检测到新文件: ${path.basename(filePath)}`);
      try {
        await fetchPosterForNote(filePath, config);
      } catch (err) {
        console.error(`[Watcher] 处理失败: ${path.basename(filePath)} - ${err.message}`);
      } finally {
        processing.delete(filePath);
      }
    });

    watcher.on('error', (err) => {
      console.error('[Watcher] 监听错误:', err.message);
    });

    process.on('SIGINT', () => {
      console.log('\n[Watcher] 正在退出...');
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
