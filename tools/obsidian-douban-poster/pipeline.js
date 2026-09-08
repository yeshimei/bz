/**
 * 豆瓣海报抓取管道 - 共享逻辑
 * CLI 和 Watcher 共用
 */

import path from 'node:path';
import fs from 'node:fs';
import { extractMovieName, hasPoster, hasDoubanInfo, updateFrontmatterFields, insertPosterEmbed } from './note-processor.js';
import { searchDouban, downloadImage, fetchSubjectInfo } from './douban-client.js';

/**
 * 对单个笔记执行海报抓取管道
 * @param {string} notePath 笔记的绝对路径
 * @param {object} config 配置对象
 * @param {object} [deps] 依赖注入（仅测试用：注入假豆瓣客户端）
 * @returns {Promise<boolean>} 是否成功抓取
 */
export async function fetchPosterForNote(notePath, config, deps = {}) {
  const { searchDouban: searchFn, downloadImage: downloadFn, fetchSubjectInfo: fetchInfoFn } = {
    searchDouban,
    downloadImage,
    fetchSubjectInfo,
    ...deps,
  };
  const posterFolder = path.join(config.vaultPath, config.posterFolder);

  // 检查笔记是否存在
  if (!fs.existsSync(notePath)) {
    console.error(`[跳过] 笔记不存在: ${path.basename(notePath)}`);
    return false;
  }

  // 海报 + 豆瓣信息都齐全才跳过；只有海报（信息不全）时重跑补全
  const hasPosterAlready = hasPoster(notePath);
  if (hasPosterAlready && hasDoubanInfo(notePath)) {
    console.log(`[跳过] ${path.basename(notePath)} 已有海报和豆瓣信息`);
    return false;
  }

  // 提取影视名称
  const name = extractMovieName(path.basename(notePath));
  console.log(`[搜索] 正在为《${name}》搜索豆瓣海报...`);

  // 搜索豆瓣
  let result;
  try {
    result = await searchFn(name);
  } catch (err) {
    console.error(`[失败] 搜索《${name}》时出错: ${err.message}`);
    return false;
  }
  if (!result) {
    console.error(`[失败] 未找到《${name}》的豆瓣结果`);
    return false;
  }

  console.log(`[找到] ${result.title} (${result.detailUrl})`);

  // 已有海报 → 补全分支：跳过下载与 embed 插入，只补豆瓣信息
  // （重下海报会换时间戳新文件名：旧文件成孤儿、正文 embed 去重只认相同路径必重复）
  if (!hasPosterAlready) {
    // 确保海报文件夹存在
    if (!fs.existsSync(posterFolder)) {
      fs.mkdirSync(posterFolder, { recursive: true });
    }

    // 生成海报文件名
    const ext = result.posterUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)?.[1] || 'jpg';
    const safeName = name.replace(/[/\\:*?"<>|]/g, '_');
    const timestamp = Date.now();
    const posterFileName = `${safeName}_${timestamp}.${ext}`;
    const posterPath = path.join(posterFolder, posterFileName);
    const posterRelativePath = `${config.posterFolder}/${posterFileName}`;

    // 下载海报
    try {
      console.log(`[下载] 正在下载高清海报...`);
      await downloadFn(result.posterUrl, posterPath);
    } catch (err) {
      console.error(`[失败] 下载海报时出错: ${err.message}`);
      return false;
    }
    console.log(`[完成] 海报已保存: ${posterRelativePath}`);

    // 更新笔记
    updateFrontmatterFields(notePath, { '海报': posterRelativePath });
    insertPosterEmbed(notePath, posterRelativePath);
    console.log(`[完成] 海报已写入: ${path.basename(notePath)}`);
  } else {
    console.log(`[补全] 已有海报，只补豆瓣信息: ${path.basename(notePath)}`);
  }

  // 顺便获取豆瓣信息写入YAML
  console.log(`[搜索] 正在获取《${name}》的豆瓣信息...`);
  try {
    const info = await fetchInfoFn(result.detailUrl);
    if (info) {
      const fields = {};
      if (info.rating) fields['豆瓣评分'] = info.rating;
      if (info.directors) fields['导演'] = info.directors;
      if (info.writers) fields['编剧'] = info.writers;
      if (info.casts) fields['主演'] = info.casts;
      if (info.genre) fields['类型'] = info.genre;
      if (info.region) fields['制片国家/地区'] = info.region;
      if (info.lang) fields['语言'] = info.lang;
      if (info.date) fields['上映日期'] = info.date;
      if (info.runtime) fields['片长'] = info.runtime;
      if (info.aka) fields['又名'] = info.aka;
      if (info.imdb) fields['IMDb'] = info.imdb;
      if (info.url) fields['豆瓣链接'] = info.url;
      if (info.intro) fields['简介'] = info.intro.slice(0, 300);
      updateFrontmatterFields(notePath, fields);
      console.log(`[完成] 豆瓣信息已写入: ${path.basename(notePath)}`);
    }
  } catch (err) {
    console.error(`[跳过] 豆瓣信息获取失败: ${err.message}`);
  }

  return true;
}
