#!/usr/bin/env node
/**
 * obsidian-news - 聚合讯数据源守护脚本
 * 统一 CLI 入口
 *
 * 用法:
 *   obsidian-news watch        前台运行抓取循环（启动即抓 + 每 30 分钟轮询）
 *   obsidian-news fetch        单轮抓取后退出（手动补抓/冒烟）
 *   obsidian-news start        通过 pm2 启动（后台守护，推荐）
 *   obsidian-news stop         停止 pm2 进程
 *   obsidian-news status       查看 pm2 进程状态
 *   obsidian-news logs         查看 pm2 日志
 */

const path = require('path');
const { execSync } = require('child_process');

// pm2 进程名保持 news-watcher（与历史部署一致，其他脚本引用不破）
const PM2_NAME = 'news-watcher';

const command = process.argv[2];

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
    // 前台运行：启动即抓 + 定时轮询（调试/前台场景）
    const { checkAndFetch, NEWS_PATH, FETCH_INTERVAL_MS } = require('./watcher.js');
    console.log(`[Watcher] 前台运行，监控: ${NEWS_PATH}`);
    checkAndFetch();
    setInterval(checkAndFetch, FETCH_INTERVAL_MS);
    process.on('SIGINT', () => {
      console.log('\n[Watcher] 正在退出...');
      process.exit(0);
    });
    break;
  }

  case 'fetch': {
    // 单轮抓取后退出（手动补抓 / 发布冒烟）
    const { checkAndFetch } = require('./watcher.js');
    checkAndFetch()
      .then(() => process.exit(0))
      .catch((e) => {
        console.error('[错误] 抓取失败:', e.message);
        process.exit(1);
      });
    break;
  }

  case 'start': {
    console.log('[pm2] 启动 watcher...');
    runPm2(`start ${path.join(__dirname, 'cli.js')} --name ${PM2_NAME} -- watch`);
    console.log('[pm2] 已启动。使用 obsidian-news status 查看状态。');
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
obsidian-news - 聚合讯数据源守护

用法:
  obsidian-news watch        前台运行抓取循环（启动即抓 + 每 30 分钟轮询）
  obsidian-news fetch        单轮抓取后退出（手动补抓/冒烟）
  obsidian-news start        通过 pm2 启动（后台守护，推荐）
  obsidian-news stop         停止 pm2 进程
  obsidian-news status       查看 pm2 进程状态
  obsidian-news logs         查看 pm2 日志

配置文件: ~/.news-watcherrc（vaultPath 指向 Obsidian vault 根目录）
环境变量: NEWS_PATH 可覆盖 news.json 绝对路径
`.trim());
    break;
  }
}
