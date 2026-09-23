/* 由真实 vault 快照生成（.scratch/gen-clip-demo.mjs，2026-09-23「我读了什么」重做拍板重出）：
 *   NEWS = E:/Obsidian/叫我包仔 news.json 全量 260 篇（body 截 180 字）+ 真实 stats/byDate；
 *   SIDECAR = clipbook.json 白名单段（articleOverrides/savedArchive/order/marks/readLog 真实数据）。
 * bilibiliCookie 不入快照。产物入库（双击原型零依赖先例），改库后重跑本脚本。 */
window.CLIP_DATA = {
 "NEWS": {
  "articles": [
   {
    "platform": "果壳科学人",
    "title": "餐厅敌敌畏消杀事件，5个问题一次讲清",
    "url": "https://www.guokr.com/article/470046",
    "author": "果壳",
    "date": "2026-08-27 16:15:04",
    "fetchedAt": "2026-08-27 08:37:56",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "OpenAI发布安全事件官方报告；我国首次实现地月双向高速激光通信；西藏日喀则吉隆口岸遭受泥石流灾害",
    "url": "https://www.guokr.com/article/470048",
    "author": "果壳",
    "date": "2026-08-27 19:15:03",
    "fetchedAt": "2026-08-27 11:37:57",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "瞎扯 · 如何正确地吐槽",
    "url": "https://daily.zhihu.com/story/9792191",
    "author": null,
    "date": "2026-08-27",
    "fetchedAt": "2026-08-27 13:50:34",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "星际旅行最大的坑，是黑洞（建议收藏）",
    "url": "https://www.guokr.com/article/470049",
    "author": "果壳",
    "date": "2026-08-27 22:15:04",
    "fetchedAt": "2026-08-27 14:15:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "天气“失控”时，我们拍到了这些…",
    "url": "https://www.bilibili.com/video/BV1KJ3x61E2M",
    "author": "亿点点不一样",
    "date": "2026-07-30 17:00:14",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "动态视频｜世界上所有的钱，加起来有多少？",
    "url": "https://www.bilibili.com/video/BV1R4Ny6cE57",
    "author": "亿点点不一样",
    "date": "2026-07-13 18:00:35",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "连续给宠物洗澡14天，学会了什么？",
    "url": "https://www.bilibili.com/video/BV1Rc7h69EiT",
    "author": "亿点点不一样",
    "date": "2026-06-25 17:00:18",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "动态视频｜吸进身体的二手烟，到底有多脏？",
    "url": "https://www.bilibili.com/video/BV17YEv6VEUx",
    "author": "亿点点不一样",
    "date": "2026-06-11 17:00:18",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "在沙漠里种了1800万棵树，然后呢？",
    "url": "https://www.bilibili.com/video/BV1TR766zEvE",
    "author": "亿点点不一样",
    "date": "2026-06-05 17:00:20",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "你躺进了仪器，医生看到了什么？",
    "url": "https://www.bilibili.com/video/BV1oVL46GEVY",
    "author": "亿点点不一样",
    "date": "2026-05-21 17:00:12",
    "fetchedAt": "2026-08-27 15:01:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "在选择和使用止痛药时，普通人有哪些常见误区？",
    "url": "https://daily.zhihu.com/story/9792196",
    "author": null,
    "date": "2026-08-28",
    "fetchedAt": "2026-08-27 23:11:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "古代偷偷晒海水难道不可以少量自制盐吗？",
    "url": "https://daily.zhihu.com/story/9792198",
    "author": null,
    "date": "2026-08-28",
    "fetchedAt": "2026-08-27 23:11:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "亚里士多德提出的「物体下落速度和重量成正比」的理论是怎么存在了一千多年的？",
    "url": "https://daily.zhihu.com/story/9792208",
    "author": null,
    "date": "2026-08-28",
    "fetchedAt": "2026-08-27 23:11:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "一只背着注射器的蟑螂来了，它是来救你命的",
    "url": "https://www.guokr.com/article/470053",
    "author": "果壳",
    "date": "2026-08-28 14:15:02",
    "fetchedAt": "2026-08-28 06:28:27",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "为了睡眠遮光贴黑胶带留下了胶痕，真的需要更换整扇窗户吗？",
    "url": "https://www.guokr.com/article/470057",
    "author": "果壳",
    "date": "2026-08-28 17:15:08",
    "fetchedAt": "2026-08-28 09:28:27",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "新中产运动，费钱又要命",
    "url": "https://www.guokr.com/article/470058",
    "author": "果壳",
    "date": "2026-08-28 18:15:06",
    "fetchedAt": "2026-08-28 10:28:29",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "Google发布Gemini Omni 1.1 Flash视频生成模型；阿里通义发布Qwen3.8-Flash； “沙德尔”登陆浙江",
    "url": "https://www.guokr.com/article/470063",
    "author": "果壳",
    "date": "2026-08-28 22:15:02",
    "fetchedAt": "2026-08-28 14:29:44",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "天坛保洁雨中用海绵吸水打扫地面，工作人员回复称保护古代金砖，金砖为啥如此特殊？有什么更好的办法清洁吗？",
    "url": "https://daily.zhihu.com/story/9792215",
    "author": null,
    "date": "2026-08-29",
    "fetchedAt": "2026-08-28 23:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "上帝究竟叫什么名字啊？",
    "url": "https://daily.zhihu.com/story/9792217",
    "author": null,
    "date": "2026-08-29",
    "fetchedAt": "2026-08-28 23:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "概率（Probability）的本质是什么？",
    "url": "https://daily.zhihu.com/story/9792226",
    "author": null,
    "date": "2026-08-29",
    "fetchedAt": "2026-08-28 23:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么NH3三角锥翻转得比PH3快?",
    "url": "https://daily.zhihu.com/story/9792230",
    "author": null,
    "date": "2026-08-29",
    "fetchedAt": "2026-08-28 23:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "懒人换季穿搭之神，百搭舒适不挑人，一件顶十件",
    "url": "https://www.guokr.com/article/470064",
    "author": "果壳",
    "date": "2026-08-29 11:15:15",
    "fetchedAt": "2026-08-29 03:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "64年的研究要断粮，教授绝望到让土拨鼠上成人网站“卖片”",
    "url": "https://www.guokr.com/article/470066",
    "author": "果壳",
    "date": "2026-08-29 13:15:04",
    "fetchedAt": "2026-08-29 05:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "当英国白崖被魔改成中国5A景区，太对味儿了！",
    "url": "https://www.guokr.com/article/470067",
    "author": "果壳",
    "date": "2026-08-29 16:15:07",
    "fetchedAt": "2026-08-29 08:22:37",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么年轻人虽然不喜欢「孤独」但越来越喜欢「独处」？这种现象背后反映了什么？",
    "url": "https://daily.zhihu.com/story/9792236",
    "author": null,
    "date": "2026-08-30",
    "fetchedAt": "2026-08-29 23:02:18",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么动物很难驷马倒攒蹄地捆绑，而人可以做到？",
    "url": "https://daily.zhihu.com/story/9792242",
    "author": null,
    "date": "2026-08-30",
    "fetchedAt": "2026-08-29 23:02:18",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "篆书到底有多少种字体？",
    "url": "https://daily.zhihu.com/story/9792250",
    "author": null,
    "date": "2026-08-30",
    "fetchedAt": "2026-08-29 23:02:18",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "有哪些结构格外特殊的细菌？",
    "url": "https://daily.zhihu.com/story/9792255",
    "author": null,
    "date": "2026-08-30",
    "fetchedAt": "2026-08-29 23:02:18",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "水泡有什么稀奇的？但我的水泡怎么长在眼球上",
    "url": "https://www.guokr.com/article/470068",
    "author": "果壳",
    "date": "2026-08-30 12:15:03",
    "fetchedAt": "2026-08-30 04:30:43",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "连续21天十点睡六点起，我真的会变健康吗？",
    "url": "https://www.bilibili.com/video/BV1DAgS6SEqa",
    "author": "亿点点不一样",
    "date": "2026-07-23 17:00:21",
    "fetchedAt": "2026-08-30 10:12:00",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "听劝！背一天肩膀就废了的包，早该扔了！",
    "url": "https://www.guokr.com/article/470071",
    "author": "果壳",
    "date": "2026-08-30 20:15:17",
    "fetchedAt": "2026-08-30 12:39:48",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "河狸的牙齿为什么是橙色的？",
    "url": "https://daily.zhihu.com/story/9792272",
    "author": null,
    "date": "2026-08-31",
    "fetchedAt": "2026-08-30 23:01:22",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "蘑菇界有哪些特别的存在？",
    "url": "https://daily.zhihu.com/story/9792267",
    "author": null,
    "date": "2026-08-31",
    "fetchedAt": "2026-08-30 23:09:39",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "赛博菩萨开始收费了，搜索引擎白嫖的日子结束了",
    "url": "https://www.guokr.com/article/470078",
    "author": "果壳",
    "date": "2026-08-31 16:15:10",
    "fetchedAt": "2026-08-31 08:16:16",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "动态视频｜影视飓风9月混剪挑战赛来啦！",
    "url": "https://www.bilibili.com/video/BV1RJtt63EYn",
    "author": "影视飓风",
    "date": "2026-08-31 17:00:17",
    "fetchedAt": "2026-08-31 09:12:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "特努斯接替库克任苹果CEO；OpenAI修复Codex多项额度Bug；中科院成都山地所解析吉隆泥石流成因",
    "url": "https://www.guokr.com/article/470079",
    "author": "果壳",
    "date": "2026-08-31 20:15:02",
    "fetchedAt": "2026-08-31 12:35:28",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "为啥全国只有湖北的可乐是600ml，其他地方都是500ml？",
    "url": "https://www.guokr.com/article/470080",
    "author": "果壳",
    "date": "2026-08-31 22:15:08",
    "fetchedAt": "2026-08-31 14:25:11",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "《寄生虫》里的豪宅，看起来没什么东西，豪在哪里？",
    "url": "https://daily.zhihu.com/story/9792286",
    "author": null,
    "date": "2026-09-01",
    "fetchedAt": "2026-08-31 23:07:45",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "红伞白点的蘑菇为什么成了全世界最经典的蘑菇形象？",
    "url": "https://daily.zhihu.com/story/9792287",
    "author": null,
    "date": "2026-09-01",
    "fetchedAt": "2026-08-31 23:07:45",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么有时候天空中的云朵会有比较清晰的边界？",
    "url": "https://daily.zhihu.com/story/9792295",
    "author": null,
    "date": "2026-09-01",
    "fetchedAt": "2026-08-31 23:07:45",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "你以为正常，实则可能是严重缺觉的 4 种表现",
    "url": "https://www.guokr.com/article/470088",
    "author": "果壳",
    "date": "2026-09-01 16:15:04",
    "fetchedAt": "2026-09-01 13:08:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "“手呢？手呢？”你的大脑一天能问自己八百遍",
    "url": "https://www.guokr.com/article/470085",
    "author": "果壳",
    "date": "2026-09-01 13:15:04",
    "fetchedAt": "2026-09-01 13:08:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "欧盟将ChatGPT认定为超大型在线搜索引擎；五角大楼将ChatGPT和Grok纳入军事人工智能平台；三大手机品牌今日起集体涨价",
    "url": "https://www.guokr.com/article/470091",
    "author": "果壳",
    "date": "2026-09-01 22:15:02",
    "fetchedAt": "2026-09-01 14:22:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "旺旺，背刺打工人",
    "url": "https://www.guokr.com/article/470092",
    "author": "果壳",
    "date": "2026-09-01 23:15:06",
    "fetchedAt": "2026-09-01 15:15:53",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么书法界会排斥「江湖体」？",
    "url": "https://daily.zhihu.com/story/9792300",
    "author": null,
    "date": "2026-09-02",
    "fetchedAt": "2026-09-01 23:10:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "历史上的每个朝代都有哪些烂大街的名字?",
    "url": "https://daily.zhihu.com/story/9792303",
    "author": null,
    "date": "2026-09-02",
    "fetchedAt": "2026-09-01 23:10:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "野外河沟里的蚊子吸谁的血？",
    "url": "https://daily.zhihu.com/story/9792311",
    "author": null,
    "date": "2026-09-02",
    "fetchedAt": "2026-09-01 23:10:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "“女性不能空腹运动”是假的，可它为什么会被疯传？",
    "url": "https://www.guokr.com/article/470096",
    "author": "果壳",
    "date": "2026-09-02 16:15:07",
    "fetchedAt": "2026-09-02 09:45:44",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "老外疯狂爱上中国脏摊的同时，我对“漂亮饭”彻底祛魅了……",
    "url": "https://www.guokr.com/article/470093",
    "author": "果壳",
    "date": "2026-09-02 13:15:09",
    "fetchedAt": "2026-09-02 09:45:44",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "《太阳报》曝欧美富豪逆龄黑幕：换大学生血单次34万，学生仅得680",
    "url": "https://www.guokr.com/article/470097",
    "author": "果壳",
    "date": "2026-09-02 18:15:07",
    "fetchedAt": "2026-09-02 10:15:44",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "Anthropic发布新模型；OpenAI计划发布新模型Astra；戴森新AI牙刷价格￥3899，可拍牙菌斑",
    "url": "https://www.guokr.com/article/470098",
    "author": "果壳",
    "date": "2026-09-02 20:15:09",
    "fetchedAt": "2026-09-02 12:20:47",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "失踪几十年，遗体一一出现，麻烦大了",
    "url": "https://www.guokr.com/article/470099",
    "author": "果壳",
    "date": "2026-09-02 22:15:03",
    "fetchedAt": "2026-09-02 14:16:16",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "耐克越来越卖不动了，但每年仍打给刘翔1400万",
    "url": "https://www.guokr.com/article/470101",
    "author": "果壳",
    "date": "2026-09-02 23:15:03",
    "fetchedAt": "2026-09-02 15:15:08",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "吃菌子出现幻觉闭眼有用吗？盲人也会产生幻觉吗？",
    "url": "https://daily.zhihu.com/story/9792318",
    "author": null,
    "date": "2026-09-03",
    "fetchedAt": "2026-09-02 23:13:16",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "如何看待《经济学人》关于诺奖得主阿西莫格鲁「世界上最有影响力的经济学家，却不令人信服」的文章？",
    "url": "https://daily.zhihu.com/story/9792319",
    "author": null,
    "date": "2026-09-03",
    "fetchedAt": "2026-09-02 23:13:16",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "各国有哪些堪比日本三神器的皇家传承信物？",
    "url": "https://daily.zhihu.com/story/9792320",
    "author": null,
    "date": "2026-09-03",
    "fetchedAt": "2026-09-02 23:13:16",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "我的提示词这么干净，怎么 Grok 还是在搞黄色？",
    "url": "https://www.guokr.com/article/470107",
    "author": "果壳",
    "date": "2026-09-03 18:15:07",
    "fetchedAt": "2026-09-03 10:18:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "定价权易主！巨头被逼到卖身自救，中国钻石凭什么征服全球富人？",
    "url": "https://www.guokr.com/article/470106",
    "author": "果壳",
    "date": "2026-09-03 17:15:07",
    "fetchedAt": "2026-09-03 10:18:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "为什么有右撇子和左撇子之分？先看5亿年前三叶虫总是被咬的右屁股",
    "url": "https://www.guokr.com/article/470105",
    "author": "果壳",
    "date": "2026-09-03 14:15:14",
    "fetchedAt": "2026-09-03 10:18:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "别人养猫养狗，他养了一颗黑洞……",
    "url": "https://www.guokr.com/article/470104",
    "author": "果壳",
    "date": "2026-09-03 13:15:04",
    "fetchedAt": "2026-09-03 10:18:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "谷歌发布 Gemini 3.8 Flash；淘宝App突发大面积故障；我国主导的腿式机器人国际标准正式发布",
    "url": "https://www.guokr.com/article/470109",
    "author": "果壳",
    "date": "2026-09-03 22:15:03",
    "fetchedAt": "2026-09-03 14:38:08",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "耗资3000万美元的救援任务彻底失败，雨燕天文台正在坠向地球",
    "url": "https://www.guokr.com/article/470110",
    "author": "果壳",
    "date": "2026-09-03 23:15:08",
    "fetchedAt": "2026-09-03 15:16:18",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "脑科学搞清楚了“意识”是如何产生的了吗？",
    "url": "https://daily.zhihu.com/story/9792338",
    "author": null,
    "date": "2026-09-04",
    "fetchedAt": "2026-09-03 23:04:11",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "有哪些长相比较逆天的植物？",
    "url": "https://daily.zhihu.com/story/9792340",
    "author": null,
    "date": "2026-09-04",
    "fetchedAt": "2026-09-03 23:04:11",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "世界上有俄罗斯、白俄罗斯，什么时候会出现赤、橙、黄、绿、青、蓝、紫俄罗斯？",
    "url": "https://daily.zhihu.com/story/9792341",
    "author": null,
    "date": "2026-09-04",
    "fetchedAt": "2026-09-03 23:04:11",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "“我找陈俊生的姘头”，中国人为什么这么爱看“抓小三”",
    "url": "https://www.guokr.com/article/470116",
    "author": "果壳",
    "date": "2026-09-04 13:15:03",
    "fetchedAt": "2026-09-04 10:37:24",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "厨房纸巾查出致癌物是真的，其实用法不对最可怕",
    "url": "https://www.guokr.com/article/470115",
    "author": "果壳",
    "date": "2026-09-04 12:15:05",
    "fetchedAt": "2026-09-04 10:37:24",
    "read": true,
    "state": "saved"
   },
   {
    "platform": "果壳科学人",
    "title": "狂踩毒蛇四万脚，在土里种下一千条内裤——新一届搞笑诺奖神人又来了！",
    "url": "https://www.guokr.com/article/470114",
    "author": "果壳",
    "date": "2026-09-04 11:15:04",
    "fetchedAt": "2026-09-04 10:37:24",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "江苏某养生馆靠“共享氧舱”获客翻倍？天价设备成引流神器，业内：赚麻了！",
    "url": "https://www.guokr.com/article/470119",
    "author": "果壳",
    "date": "2026-09-04 19:15:07",
    "fetchedAt": "2026-09-04 11:19:11",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "美国AI集体崩溃；OpenAI发布GPT-6 Astra旗舰模型；海信发布AI伴侣套系",
    "url": "https://www.guokr.com/article/470120",
    "author": "果壳",
    "date": "2026-09-04 20:15:03",
    "fetchedAt": "2026-09-04 12:25:46",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "一套算法立省百亿美金！清华AI看见130亿年前的宇宙",
    "url": "https://www.guokr.com/article/470122",
    "author": "果壳",
    "date": "2026-09-04 22:15:03",
    "fetchedAt": "2026-09-04 14:25:47",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "笋干吃出完整竹虫！哪些地方的朋友馋哭了？",
    "url": "https://www.guokr.com/article/470123",
    "author": "果壳",
    "date": "2026-09-04 23:15:07",
    "fetchedAt": "2026-09-04 15:16:25",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "古代士兵的伙食如何？",
    "url": "https://daily.zhihu.com/story/9792350",
    "author": null,
    "date": "2026-09-05",
    "fetchedAt": "2026-09-04 23:06:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "你觉得什么品种的蛇最吓人？",
    "url": "https://daily.zhihu.com/story/9792352",
    "author": null,
    "date": "2026-09-05",
    "fetchedAt": "2026-09-04 23:06:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么科学已经证实天空上没有天堂，但信宗教的人依旧相信有神的存在？",
    "url": "https://daily.zhihu.com/story/9792357",
    "author": null,
    "date": "2026-09-05",
    "fetchedAt": "2026-09-04 23:06:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "祈雨等仪式活动为什么在古代社会中备受重视，如果不成功为何还会继续?",
    "url": "https://daily.zhihu.com/story/9792367",
    "author": null,
    "date": "2026-09-05",
    "fetchedAt": "2026-09-04 23:06:13",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "好想让 AI 来取代我的老板，立刻！马上！",
    "url": "https://www.guokr.com/article/470126",
    "author": "果壳",
    "date": "2026-09-05 21:15:07",
    "fetchedAt": "2026-09-05 13:17:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "兽医给大象补了两个洞，9个月后却多出3根象牙：它为什么会越补越多？",
    "url": "https://www.guokr.com/article/470125",
    "author": "果壳",
    "date": "2026-09-05 16:15:10",
    "fetchedAt": "2026-09-05 13:17:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "整条街的车钥匙突然瘫痪，调查人员最后走进了一户老人的地下室",
    "url": "https://www.guokr.com/article/470124",
    "author": "果壳",
    "date": "2026-09-05 13:15:05",
    "fetchedAt": "2026-09-05 13:17:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "打工人通勤的最终归宿：爱上一脚蹬 “老头乐”",
    "url": "https://www.guokr.com/article/470127",
    "author": "果壳",
    "date": "2026-09-05 22:15:13",
    "fetchedAt": "2026-09-05 14:17:58",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "熊猫吃竹子是刻在基因中的习性吗？可以通过从小喂养其他食物改变吗？",
    "url": "https://daily.zhihu.com/story/9792363",
    "author": null,
    "date": "2026-09-06",
    "fetchedAt": "2026-09-05 23:02:23",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么几千年作为蔬菜的甜菜，没有被发现能产糖？",
    "url": "https://daily.zhihu.com/story/9792375",
    "author": null,
    "date": "2026-09-06",
    "fetchedAt": "2026-09-05 23:02:23",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "英语「China」是来自「秦」、「晋」，还是别的来源？",
    "url": "https://daily.zhihu.com/story/9792385",
    "author": null,
    "date": "2026-09-06",
    "fetchedAt": "2026-09-05 23:02:23",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "古代士兵中箭后没有消炎药，伤口感染了还能扛过去吗？",
    "url": "https://daily.zhihu.com/story/9792390",
    "author": null,
    "date": "2026-09-06",
    "fetchedAt": "2026-09-05 23:02:23",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "当一个人从朋友圈消失、不透露自己的状态，意味着什么？",
    "url": "https://www.guokr.com/article/470128",
    "author": "果壳",
    "date": "2026-09-06 13:15:01",
    "fetchedAt": "2026-09-06 05:15:51",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "免费早餐，坑了多少好酒店？",
    "url": "https://www.guokr.com/article/470129",
    "author": "果壳",
    "date": "2026-09-06 17:15:02",
    "fetchedAt": "2026-09-06 09:28:25",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "去医院做核磁，前面排队的是一只大熊猫？",
    "url": "https://www.guokr.com/article/470130",
    "author": "果壳",
    "date": "2026-09-06 20:15:09",
    "fetchedAt": "2026-09-06 12:28:24",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "从顾虑到真香：孩子的脑洞该如何落地？家庭第一台 3D 打印机给你答案",
    "url": "https://www.guokr.com/article/470131",
    "author": "果壳",
    "date": "2026-09-06 21:15:02",
    "fetchedAt": "2026-09-06 13:28:25",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "游戏晕3D是天生的还是后天的？",
    "url": "https://daily.zhihu.com/story/9792400",
    "author": null,
    "date": "2026-09-07",
    "fetchedAt": "2026-09-06 23:01:56",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "为什么牧羊犬能指挥羊群进退？",
    "url": "https://daily.zhihu.com/story/9792407",
    "author": null,
    "date": "2026-09-07",
    "fetchedAt": "2026-09-06 23:01:56",
    "read": true,
    "state": "saved"
   },
   {
    "platform": "知乎日报",
    "title": "我发现很多农村教堂并没有发鸡蛋，那为什么还有那么多老头老太太去信？",
    "url": "https://daily.zhihu.com/story/9792416",
    "author": null,
    "date": "2026-09-07",
    "fetchedAt": "2026-09-06 23:01:56",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "废塑料瓶摇身一变，竟成了香喷喷的饼干，这到底谁敢吃？",
    "url": "https://www.guokr.com/article/470133",
    "author": "果壳",
    "date": "2026-09-07 13:15:04",
    "fetchedAt": "2026-09-07 05:16:56",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "Google为多个软件新增Gemini语音功能；华为新款三折叠手机搭载麒麟9050 Pro芯片和HarmonyOS 7系统；科大讯飞发布星火Spark-X2.5大模型",
    "url": "https://www.guokr.com/article/470142",
    "author": "果壳",
    "date": "2026-09-07 20:15:03",
    "fetchedAt": "2026-09-07 12:20:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "ChatGPT和美国“杀人犯”聊天后报警了！AI有权审判我的对话框吗？",
    "url": "https://www.guokr.com/article/470144",
    "author": "果壳",
    "date": "2026-09-07 22:15:09",
    "fetchedAt": "2026-09-07 14:20:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "大屏手机真正的门槛不是硬件，是生态",
    "url": "https://www.guokr.com/article/470145",
    "author": "果壳",
    "date": "2026-09-07 23:15:05",
    "fetchedAt": "2026-09-07 15:20:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "这两个系统先衰老的人，老得更快，死得也可能更早！",
    "url": "https://www.guokr.com/article/470146",
    "author": "果壳",
    "date": "2026-09-08 05:15:02",
    "fetchedAt": "2026-09-07 21:28:06",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "哪些文物使用了罕见的制作材料？",
    "url": "https://daily.zhihu.com/story/9792427",
    "author": null,
    "date": "2026-09-08",
    "fetchedAt": "2026-09-07 23:02:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "你曾经看过的最惊为天人的科幻概念是什么？",
    "url": "https://daily.zhihu.com/story/9792431",
    "author": null,
    "date": "2026-09-08",
    "fetchedAt": "2026-09-07 23:02:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "从科学的角度考虑，蘑菇能否直接在人体（或尸体）上生长？",
    "url": "https://daily.zhihu.com/story/9792433",
    "author": null,
    "date": "2026-09-08",
    "fetchedAt": "2026-09-07 23:02:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "对话汉斯·季默！如何用一段旋律创造一个电影宇宙？",
    "url": "https://www.bilibili.com/video/BV1awbg6XELn",
    "author": "影视飓风",
    "date": "2026-09-08 11:00:10",
    "fetchedAt": "2026-09-08 03:44:04",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "苹果被骂惨的设计，在 AI 时代迎来高光时刻",
    "url": "https://www.guokr.com/article/470151",
    "author": "果壳",
    "date": "2026-09-08 14:15:15",
    "fetchedAt": "2026-09-08 06:18:20",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "超过30%的女性月经过多，有人脑子发“雾”就因为它",
    "url": "https://www.guokr.com/article/470155",
    "author": "果壳",
    "date": "2026-09-08 18:15:01",
    "fetchedAt": "2026-09-08 10:29:06",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "狂开45家 咨询量翻3倍！这家社区版长寿小店，击中了谁的痛点？",
    "url": "https://www.guokr.com/article/470156",
    "author": "果壳",
    "date": "2026-09-08 19:15:10",
    "fetchedAt": "2026-09-08 11:29:06",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "OpenAI智能体劫持德国网站发布万余条信息；小米多款新品重磅亮相；最高人民法院首次发布AI司法裁判规则",
    "url": "https://www.guokr.com/article/470157",
    "author": "果壳",
    "date": "2026-09-08 20:15:02",
    "fetchedAt": "2026-09-08 12:29:06",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "不是消费降级吗？国民神车五菱宏光MINI，怎么没人买了呢？",
    "url": "https://www.guokr.com/article/470158",
    "author": "果壳",
    "date": "2026-09-08 22:15:15",
    "fetchedAt": "2026-09-08 14:29:06",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "你觉得哪道菜是米饭的最佳拍档?",
    "url": "https://daily.zhihu.com/story/9792447",
    "author": null,
    "date": "2026-09-09",
    "fetchedAt": "2026-09-08 23:00:01",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "猫的性格是由颜色决定的吗？",
    "url": "https://daily.zhihu.com/story/9792441",
    "author": null,
    "date": "2026-09-09",
    "fetchedAt": "2026-09-08 23:01:08",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "“崩老头”屹立在 AI 风口之上",
    "url": "https://www.guokr.com/article/470160",
    "author": "果壳",
    "date": "2026-09-09 13:15:09",
    "fetchedAt": "2026-09-09 05:15:25",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "游客在山里撒了泡尿，为什么最后要出动直升机搬走325只雪羊？",
    "url": "https://www.guokr.com/article/470162",
    "author": "果壳",
    "date": "2026-09-09 17:15:05",
    "fetchedAt": "2026-09-09 09:15:26",
    "read": true,
    "state": "saved"
   },
   {
    "platform": "果壳科学人",
    "title": "反差出圈！国产“青春舱”内地卖不动，港岛爆单？消费真相太现实",
    "url": "https://www.guokr.com/article/470165",
    "author": "果壳",
    "date": "2026-09-09 18:15:07",
    "fetchedAt": "2026-09-09 10:29:12",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "AI攻克纳维-斯托克斯千禧年难题；Meta发布个人AI智能体Muse；Cybercab乘客端意外出现虚拟控制杆",
    "url": "https://www.guokr.com/article/470166",
    "author": "果壳",
    "date": "2026-09-09 20:15:06",
    "fetchedAt": "2026-09-09 12:15:26",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "OpenAI智能体一周末攻克千禧难题，纽约大学教授质问：你是不是看过我的草稿？",
    "url": "https://www.guokr.com/article/470167",
    "author": "果壳",
    "date": "2026-09-10 05:15:08",
    "fetchedAt": "2026-09-09 21:15:27",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "除了奔跑很快，马还有哪些很厉害的技能可以告诉小朋友？",
    "url": "https://daily.zhihu.com/story/9792471",
    "author": null,
    "date": "2026-09-10",
    "fetchedAt": "2026-09-09 23:02:29",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "古代罗马人说话时候的样子，也是像意大利人那样手舞足蹈的吗？",
    "url": "https://daily.zhihu.com/story/9792472",
    "author": null,
    "date": "2026-09-10",
    "fetchedAt": "2026-09-09 23:02:29",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "历史上还有哪些称得上「魅魔」的人物？",
    "url": "https://daily.zhihu.com/story/9792473",
    "author": null,
    "date": "2026-09-10",
    "fetchedAt": "2026-09-09 23:02:29",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "B站",
    "title": "【影视飓风】iPhone Duo折叠屏真机上手",
    "url": "https://www.bilibili.com/video/BV12PYh62E3c",
    "author": "影视飓风",
    "date": "2026-09-10 08:11:39",
    "fetchedAt": "2026-09-10 00:11:49",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "新任 CEO 首秀，苹果折叠屏最贵卖两万六",
    "url": "https://www.guokr.com/article/470168",
    "author": "果壳",
    "date": "2026-09-10 08:15:10",
    "fetchedAt": "2026-09-10 00:15:27",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "阳台出现大白肉虫不要丢，放在土里养一养，丈夫都馋哭了",
    "url": "https://www.guokr.com/article/470169",
    "author": "果壳",
    "date": "2026-09-10 09:15:17",
    "fetchedAt": "2026-09-10 01:15:29",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "一个27岁的AI研究员从Anthropic辞职了，因为他担心AI会导致人类灭绝。",
    "url": "https://www.guokr.com/article/470173",
    "author": "果壳",
    "date": "2026-09-10 13:15:09",
    "fetchedAt": "2026-09-10 05:15:31",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "AI狂飙的时代，蚂蚁森林要再种一棵“异想天开”的树",
    "url": "https://www.guokr.com/article/470182",
    "author": "果壳",
    "date": "2026-09-10 18:15:08",
    "fetchedAt": "2026-09-10 10:15:32",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "苹果发布iPhone 18 Pro系列及首款折叠屏iPhone Duo；中国西南首次发现丹尼索瓦人化石；日本暴发梅毒疫情",
    "url": "https://www.guokr.com/article/470183",
    "author": "果壳",
    "date": "2026-09-10 20:15:12",
    "fetchedAt": "2026-09-10 12:15:31",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "请问哪些植物毛茸茸的？",
    "url": "https://daily.zhihu.com/story/9792490",
    "author": null,
    "date": "2026-09-11",
    "fetchedAt": "2026-09-10 23:02:47",
    "read": true,
    "state": "saved"
   },
   {
    "platform": "知乎日报",
    "title": "荷马史诗《奥德赛》讲了一个什么故事?",
    "url": "https://daily.zhihu.com/story/9792497",
    "author": null,
    "date": "2026-09-11",
    "fetchedAt": "2026-09-10 23:02:47",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "知乎日报",
    "title": "如何看待杨振宁认为有造物主的存在？",
    "url": "https://daily.zhihu.com/story/9792500",
    "author": null,
    "date": "2026-09-11",
    "fetchedAt": "2026-09-10 23:02:47",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "邓紫棋小说《启示路》入围银河奖，我们帮你把书看完了",
    "url": "https://www.guokr.com/article/470192",
    "author": "果壳",
    "date": "2026-09-11 09:15:08",
    "fetchedAt": "2026-09-11 01:15:33",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-11 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-11/",
    "author": "橘鸦AI早报",
    "date": "2026-09-11 09:35:05",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-10 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-10/",
    "author": "橘鸦AI早报",
    "date": "2026-09-10 09:36:41",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-09 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-09/",
    "author": "橘鸦AI早报",
    "date": "2026-09-09 09:55:58",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-08 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-08/",
    "author": "橘鸦AI早报",
    "date": "2026-09-08 08:48:08",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260908/20260908084119302327bee9_cover_543a.png)\n\n# AI 早报 2026-09-08\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1Zgb36KEVs) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-07 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-07/",
    "author": "橘鸦AI早报",
    "date": "2026-09-07 09:24:31",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260907/202609070912224998879668_cover_0b82.png)\n\n# AI 早报 2026-09-07\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1ACbw6XENk) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-06 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-06/",
    "author": "橘鸦AI早报",
    "date": "2026-09-06 09:16:27",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260906/202609060904108403925fba_cover_6ee6.png)\n\n# AI 早报 2026-09-06\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1mpbE63EYK) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-05 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-05/",
    "author": "橘鸦AI早报",
    "date": "2026-09-05 10:05:53",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260905/202609050919551713456af2_cover_ed32.png)\n\n# AI 早报 2026-09-05\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1Motk6GEQL) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-04 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-04/",
    "author": "橘鸦AI早报",
    "date": "2026-09-04 10:21:37",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260904/20260904095142732862489a_cover_2372.png)\n\n# AI 早报 2026-09-04\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1dTtv6aEDc) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-03 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-03/",
    "author": "橘鸦AI早报",
    "date": "2026-09-03 09:30:13",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260903/202609030920564144861578_cover_7db3.png)\n\n# AI 早报 2026-09-03\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1yNtR6vEDB) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-02 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-02/",
    "author": "橘鸦AI早报",
    "date": "2026-09-02 09:52:13",
    "fetchedAt": "2026-09-11 02:09:02",
    "read": true,
    "state": "skipped"
   },
   {
    "platform": "果壳科学人",
    "title": "164:1，整个地球，只有美国反对",
    "url": "https://www.guokr.com/article/470201",
    "author": "果壳",
    "date": "2026-09-11 17:15:04",
    "fetchedAt": "2026-09-11 09:15:35",
    "read": true,
    "state": "skipped",
    "body": "本文授权转载自“南风窗”，点击上方关注。 ID：SouthReviews\n\n![](https://2-im.guokr.com/Rm0tVk51X2JOc2xEWEttWnlGWkNxREZPQUtTd2RvY3g4BAAA0AIAAEpQ.jpg?imageView2/1/w/555/h/370)作者：苏打\n\n编辑：向现\n\n最近，我们可能要重新认识世界地…"
   },
   {
    "platform": "果壳科学人",
    "title": "一泡古人的屎，凭什么成了无价之宝？",
    "url": "https://www.guokr.com/article/470204",
    "author": "果壳",
    "date": "2026-09-11 20:15:02",
    "fetchedAt": "2026-09-11 12:15:34",
    "read": true,
    "state": "skipped",
    "body": "古人用棍子擦屁股（如果他们还擦的话），棍子是重要的物证，古人的食物组成、有没有受到寄生虫侵扰、寄生虫又是从哪里传播过来的，都可能从中推测出来，一根棍子让我们跟几千几万年前的人类对上了话。\n\n在科普作家河森堡看来：**\"你就是一泡屎，那都是无价之宝。\"**\n\n**理科出身讲国宝**河森堡大学读的是计算机，快毕业了看到国博来校招，就上去笔试、面试，几轮下来，竟然…"
   },
   {
    "platform": "果壳科学人",
    "title": "美国太空司令部完成首次实飞太空演习；OpenAI因Astra需求暂停部分新订阅；宇树科技开源60亿参数具身基座模型",
    "url": "https://www.guokr.com/article/470205",
    "author": "果壳",
    "date": "2026-09-11 21:15:03",
    "fetchedAt": "2026-09-11 13:15:41",
    "read": true,
    "state": "skipped",
    "body": "今天是9月11日，星期五。1952年的今天，查尔斯·赫夫纳格尔医生首次成功为患者植入有机玻璃管制成的人工主动脉瓣，成功恢复了患者心脏血液动力学功能，开创了心脏瓣膜置换手术先河。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么动物不能像人那样拥有大块胸肌？",
    "url": "https://daily.zhihu.com/story/9792513",
    "author": null,
    "date": "2026-09-12",
    "fetchedAt": "2026-09-11 23:03:18",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-be4dcdda29f593a0b698f5377a4abe7f_l.jpg?source=8673f162)\nRara，生物爱好者，AI行业梭边鱼，杂志科普作家。\n[查看知乎原文](https://www.zhihu.com/question/4337291629/answer/57343…"
   },
   {
    "platform": "知乎日报",
    "title": "在古代还没有毒品概念的时候，天然成瘾植物为何没有成为顶级香料？",
    "url": "https://daily.zhihu.com/story/9792522",
    "author": null,
    "date": "2026-09-12",
    "fetchedAt": "2026-09-11 23:03:18",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-da174658941abdedd71fa129af808b9e_l.jpg?source=8673f162)\n宫本兔618，左左右右上上下下baba差不多得了/泛亚领域/知乎树洞/\n[查看知乎原文](https://www.zhihu.com/question/20685874290790…"
   },
   {
    "platform": "知乎日报",
    "title": "我奔跑的时候拿着手电筒向前射出一束光，那这束光的速度是不是相对地面超过了光速？",
    "url": "https://daily.zhihu.com/story/9792530",
    "author": null,
    "date": "2026-09-12",
    "fetchedAt": "2026-09-11 23:03:18",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-07451ac6f2c967afcf4190867755ec84_l.jpg?source=8673f162)\n曹天元 Capo，Bayesian\n[查看知乎原文](https://www.zhihu.com/question/1944101549795153444/answer/19553…"
   },
   {
    "platform": "知乎日报",
    "title": "世界上有哪些冷门的古文字体系？",
    "url": "https://daily.zhihu.com/story/9792536",
    "author": null,
    "date": "2026-09-12",
    "fetchedAt": "2026-09-11 23:03:18",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pica.zhimg.com/v2-73c41728e075ee58c27b598c81629b16_l.jpg?source=8673f162)\n执戟郎，东北亚宗教研究\n[查看知乎原文](https://www.zhihu.com/question/2061950946830243558/answer/20713528496…"
   },
   {
    "platform": "B站",
    "title": "高糖VS戒糖14天！身体真的有变化吗？",
    "url": "https://www.bilibili.com/video/BV1enYL6SEtU",
    "author": "亿点点不一样",
    "date": "2026-09-12 11:00:05",
    "fetchedAt": "2026-09-12 03:03:18",
    "read": true,
    "state": "skipped",
    "body": "戒糖真的会让人变健康，甚至让皮肤变好吗？这一次，我们找来了两位同事，一位严格控糖，一位想吃多少就吃多少，看看14天之后，她们的身体到底会发生什么变化？如果这期视频对你有帮助，请多多支持我们，并把视频分享给你的朋友们一起看看～*本期内容非严谨实验，仅供参考\n\n![封面](https://i1.hdslb.com/bfs/archive/4a409f9a43b2…"
   },
   {
    "platform": "B站",
    "title": "去了一趟山西。",
    "url": "https://www.bilibili.com/video/BV1xVY26dEbz",
    "author": "影视飓风",
    "date": "2026-09-12 11:00:12",
    "fetchedAt": "2026-09-12 03:03:18",
    "read": true,
    "state": "skipped",
    "body": "这一次，我们去了一趟系列来到了历史底蕴深厚、煤炭资源丰富的山西。想带你一起尝尝地道的山西美食，品鉴大名鼎鼎的老陈醋，感受独属于三晋大地的风土人情。如果你喜欢这期视频，请多多支持我们，并把视频分享给你的朋友们！\n\n![封面](https://i1.hdslb.com/bfs/archive/9abd9134b82d431cf9a19a313512b07f20b…"
   },
   {
    "platform": "果壳科学人",
    "title": "把狗拍成网红，月入1万5，我成了家里的“啃狗族”",
    "url": "https://www.guokr.com/article/470206",
    "author": "果壳",
    "date": "2026-09-12 14:15:02",
    "fetchedAt": "2026-09-12 06:15:48",
    "read": true,
    "state": "skipped",
    "body": "转载自**凤凰WEEKLY(ID:phoenixweekly)**\n\n文：馍王\n\n编辑：章鱼\n\n北京是个神奇的地方。\n\n每一种新兴的中产生活方式，进入这座城市之后，几乎都会在海淀和朝阳长出两个截然不同的版本。\n\n就拿“鸡娃”来举例吧。\n\n海淀中产卷孩子。去海淀人家里做客，你会发现他们的孩子可能左手弹钢琴，右手做奥数题，饭桌上顺便练习英语口语。\n\n朝阳中产则不…"
   },
   {
    "platform": "果壳科学人",
    "title": "\"午夜慌张\"\"事后解药\"：女性用品名已经疯了",
    "url": "https://www.guokr.com/article/470207",
    "author": "果壳",
    "date": "2026-09-12 16:15:09",
    "fetchedAt": "2026-09-12 08:15:48",
    "read": true,
    "state": "skipped",
    "body": "来源：她刊（ID：iiiher）\n\n作者：仙子狗尾巴花\n\n监制：她姐\n\n作者：仙子狗尾巴\n\n花监制：她姐\n\n女性商品的名字，越来越让人摸不着头脑了。\n\n奶滑小方，听着像雪糕名，实际是安全裤；午夜慌张，听着像悬疑小说，实际是口红色号；冰皮、奶芙，原本只和特定的甜品挂钩，现在它们被加在“裤”字前面，成了特定裤型的标签。\n\n卖氛围、卖身份、卖焦虑，似乎都比卖商品本…"
   },
   {
    "platform": "果壳科学人",
    "title": "5 人聚餐后全部确诊，4 人肝受损！劝你一口别吃",
    "url": "https://www.guokr.com/article/470208",
    "author": "果壳",
    "date": "2026-09-12 20:15:09",
    "fetchedAt": "2026-09-12 12:15:49",
    "read": true,
    "state": "skipped",
    "body": "谁能想到，继秋天的第一杯奶茶后，广大网友终于迎来了——**秋天的第一份鱼生。**\n\n吓得人民日报都跑出来帮疾控部门紧急喊话：别吃啦！\n\n![](https://3-im.guokr.com/RnB0YjgtVk96b0lVNUlLZDhRbTFCVGFvMFpOSGRvY3g4BAAAZAEAAEpQ.jpg?imageView2/1/w/555/h/182…"
   },
   {
    "platform": "果壳科学人",
    "title": "马上都2027年了，你要还拿旧拖把跟生活死磕，那我真替你腰疼！！！",
    "url": "https://www.guokr.com/article/470209",
    "author": "果壳",
    "date": "2026-09-12 21:15:14",
    "fetchedAt": "2026-09-12 13:15:48",
    "read": true,
    "state": "skipped",
    "body": "说出来不怕你笑，我以前是那种“看见地脏就假装没看见”的人。不是懒，是**被拖把伤透了心。**\n\n最早用圆头棉布拖，拖两下布就拧成一团，地上的狗毛没拖走，反而被推成一小座“毛山”；后来换旋转脱水款，甩干桶咣当咣当，水花能溅到小腿肚，洗完手泡得发白，腰跟干了三小时农活似的；再后来买网红免手洗，看似高级，结果拖厨房酱油印时越拖越大，鞋底一踩——好家伙，红糖糍粑既视…"
   },
   {
    "platform": "知乎日报",
    "title": "为啥自然演化出轮子会那么难？",
    "url": "https://daily.zhihu.com/story/9792542",
    "author": null,
    "date": "2026-09-13",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-e3f6506541c8ae071adfef5b107e760b_l.jpg?source=8673f162)\n小帽officials，喜欢空洞骑士，05后，人文社科科普博主(不键政)，法律-情感-文学等相关咨询请私信\n[查看知乎原文](https://www.zhihu.com/quest…"
   },
   {
    "platform": "知乎日报",
    "title": "昆虫是如何飞行的？它们飞行的原理是什么？",
    "url": "https://daily.zhihu.com/story/9792544",
    "author": null,
    "date": "2026-09-13",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-237a03ae1afaa4ec8443e82b1a711d17_l.jpg?source=8673f162)\n祥昊，我在想要不凑几个人跑团去？\n[查看知乎原文](https://www.zhihu.com/question/1969367763081495444/answer/207823…"
   },
   {
    "platform": "知乎日报",
    "title": "蚊子真的能飞上十楼以上吗？十楼以上的蚊子是怎么进来的？",
    "url": "https://daily.zhihu.com/story/9792545",
    "author": null,
    "date": "2026-09-13",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-eb665fa780d6c2ffe7908debeb029b04_l.jpg?source=8673f162)\n斜绿天蛾，点进主页你会发现，这人真就只在乎虫子\n[查看知乎原文](https://www.zhihu.com/question/1923894499836396817/answer…"
   },
   {
    "platform": "知乎日报",
    "title": "一头鲸鱼一天能吃好几吨磷虾，为什么磷虾还没被吃灭绝？",
    "url": "https://daily.zhihu.com/story/9792548",
    "author": null,
    "date": "2026-09-13",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-237a03ae1afaa4ec8443e82b1a711d17_l.jpg?source=8673f162)\n祥昊，我在想要不凑几个人跑团去？\n[查看知乎原文](https://www.zhihu.com/question/2075640036507370127/answer/207787…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-13 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-13/",
    "author": "橘鸦AI早报",
    "date": "2026-09-13 08:27:49",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260913/20260913081916065787b73b_cover_74b1.png)\n\n# AI 早报 2026-09-13\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV18kYZ6vE4p) ｜ [YouTube](h…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-12 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-12/",
    "author": "橘鸦AI早报",
    "date": "2026-09-12 10:04:27",
    "fetchedAt": "2026-09-13 03:46:57",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260912/20260912094323600409e7dd_cover_0581.png)\n\n# AI 早报 2026-09-12\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1kAYS6FEeF) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "“HYROX比赛就是专门针对你的死亡陷阱，你还傻乎乎地跳进来了”",
    "url": "https://www.guokr.com/article/470211",
    "author": "果壳",
    "date": "2026-09-13 15:15:02",
    "fetchedAt": "2026-09-13 15:22:21",
    "read": true,
    "state": "skipped",
    "body": "2026年7月5日，我和朋友组队参加了杭州HYROX大众女子双人组。这是我第一次参赛，原本的计划只是和朋友一起玩玩，拍些肌肉充血的运动照留念。我有着7年以上的健身房力量和有氧训练基础，全身肌肉量远超标准，骨密度较同龄人平均值高出50%。同时我还是田协认证的马拉松大众二级运动员，有多次越野赛经验，并且每周末都会去Crossfit馆训练，所以混合有氧运动对我来说…"
   },
   {
    "platform": "果壳科学人",
    "title": "开海后的第一口鲜，必须是大连！",
    "url": "https://www.guokr.com/article/470210",
    "author": "果壳",
    "date": "2026-09-13 14:15:09",
    "fetchedAt": "2026-09-13 15:22:21",
    "read": true,
    "state": "skipped",
    "body": "秋天真的来了。\n\n每年一到这个时候，后台就有人问：什么时候去卖海鲜？我太懂这种心情了。\n\n秋天的海鲜，和夏天完全不一样。夏天吃的是热闹，秋天吃的是肥美。**海水凉了，海鲜开始囤膘，肉质一天比一天紧实，膏黄一天比一天饱满。**\n\n今年国内的渔场，从南海到东海，从黄海到渤海，陆续都开海了。渤海湾是最晚的那个，黄渤海伏季休渔期9月正式结束。可偏偏就是这最晚的一个，…"
   },
   {
    "platform": "果壳科学人",
    "title": "有兄弟姐妹，成了中国相亲鄙视链的最底端",
    "url": "https://www.guokr.com/article/470212",
    "author": "果壳",
    "date": "2026-09-13 16:15:09",
    "fetchedAt": "2026-09-13 19:16:02",
    "read": true,
    "state": "skipped",
    "body": "本文授权转载自**网易数读(ID:datablog163)，未经授权禁止转载**\n\n![](https://2-im.guokr.com/Rm83TVF4VTNTSWloSUNWTGlkRldwTmtKR25rMmRvY3g4BAAA2AMAAEpQ.jpg?imageView2/1/w/555/h/505)相亲时，最怕空气突然安静。\n\n放在以前，聊不下去了…"
   },
   {
    "platform": "知乎日报",
    "title": "哪种动物的冬眠机制最有可能为人类研究冬眠提供有价值的参考？",
    "url": "https://daily.zhihu.com/story/9792549",
    "author": null,
    "date": "2026-09-14",
    "fetchedAt": "2026-09-14 07:41:17",
    "read": true,
    "state": "saved",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-4cdc8dc004835c64495966f8a36ec5f6_l.jpg?source=8673f162)\nbiokiwi，用生命科学的角度看世界！\n[查看知乎原文](https://www.zhihu.com/question/5375807123/answer/42940211633…"
   },
   {
    "platform": "知乎日报",
    "title": "可不可以莫名其妙地教我一个知识?",
    "url": "https://daily.zhihu.com/story/9792557",
    "author": null,
    "date": "2026-09-14",
    "fetchedAt": "2026-09-14 07:41:17",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-e3f6506541c8ae071adfef5b107e760b_l.jpg?source=8673f162)\n小帽officials，喜欢空洞骑士，05后，人文社科科普博主(不键政)，法律-情感-文学等相关咨询请私信\n[查看知乎原文](https://www.zhihu.com/quest…"
   },
   {
    "platform": "果壳科学人",
    "title": "卖补剂却劝人“少吃点”？这家公司反其道而行硬刚3600亿保健市场",
    "url": "https://www.guokr.com/article/470221",
    "author": "果壳",
    "date": "2026-09-14 22:15:03",
    "fetchedAt": "2026-09-14 22:16:44",
    "read": true,
    "state": "skipped",
    "body": "2026年，中国保健食品市场正式突破3600亿元。\n\n市场越大，竞争越激烈。过去几年，直播、短视频和社交平台持续放大了保健品生意，\n\n一条网红视频的推荐，一个热门成分的走红，足以在瞬息间催生一批跟风新品。\n\n鱼油、辅酶Q10、PQQ、Ca-AKG等新成分不断涌现，消费者桌上的瓶瓶罐罐越来越多。找网红、拼爆品、拼成分，逐渐成为行业常见打法。\n\n而就在整个行业都…"
   },
   {
    "platform": "果壳科学人",
    "title": "脑内强制播放Bad apple，被困无尽游戏地狱，赛博果蝇也会流下电子眼泪吗？",
    "url": "https://www.guokr.com/article/470215",
    "author": "果壳",
    "date": "2026-09-14 13:15:04",
    "fetchedAt": "2026-09-14 22:16:44",
    "read": true,
    "state": "skipped",
    "body": "最近，一则触动老二次元神经的离谱视频正在互联网上流传。\n\nKevin/X\n\n视频中的黑白剪影正是东方project名曲《Bad Apple!!》的标志性画面。在各种奇怪的介质上重现这些剪影，是十几年来长盛不衰的互联网迷因。\n\n而这一次，再现介质的离谱程度又被推向了新高度：**这些画面都是在果蝇大脑上显示的。**\n\n**这只果蝇并非真实存在，它其实是一组运行在…"
   },
   {
    "platform": "B站",
    "title": "和五月天阿信见了他",
    "url": "https://www.bilibili.com/video/BV17PYC6KEXu",
    "author": "影视飓风",
    "date": "2026-09-14 17:05:38",
    "fetchedAt": "2026-09-14 22:16:44",
    "read": true,
    "state": "skipped",
    "body": "苹果发布会之后，我们和五月天阿信一起，去见了一个人，和他聊了聊……\n他到底是谁？为什么是阿信？又聊了什么？先不剧透，正片见。\n\n![封面](https://i1.hdslb.com/bfs/archive/c9036763439c028fd6e9a9bd2c01fca10f58059c.jpg)\n\n🔗 观看：[和五月天阿信见了他](https://www.…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-14 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-14/",
    "author": "橘鸦AI早报",
    "date": "2026-09-14 08:58:23",
    "fetchedAt": "2026-09-14 22:16:44",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260914/20260914084012719517a81f_cover_691d.png)\n\n# AI 早报 2026-09-14\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1ATYk65Edz) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "被误解多年的“国民油”，成分不输橄榄油，炒菜健康又实惠！",
    "url": "https://www.guokr.com/article/470225",
    "author": "果壳",
    "date": "2026-09-15 06:15:02",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "**太长不看版**![](https://3-im.guokr.com/RnRNMjEtUEkyaGtUalZZeTNYcmlTdFlVYlhiU2RvY3g4BAAAzwIAAEpQ.jpg?imageView2/1/w/555/h/369)图源：图虫创意\n\n菜籽油中，**单不饱和脂肪酸占60%以上，既耐热又健康，很适合中国人炒菜用。**\n\n**芥酸和硫甙…"
   },
   {
    "platform": "果壳科学人",
    "title": "苹果更新App Store审核指南；Microsoft 365 Copilot引入xAI Grok模型；25位菲尔兹奖得主联合发表声明",
    "url": "https://www.guokr.com/article/470224",
    "author": "果壳",
    "date": "2026-09-15 05:15:03",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "今天是9月14日，星期一。2000年的今天，亚欧海底光缆（SEA-ME-WE 3）全线开通，连接亚洲、中东和欧洲。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.Microsoft 365 Copilot引入…"
   },
   {
    "platform": "果壳科学人",
    "title": "以为在锻炼其实在玩命：居家健身“翻车”图鉴",
    "url": "https://www.guokr.com/article/470222",
    "author": "果壳",
    "date": "2026-09-14 23:15:04",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "今年7月，长沙，深夜一辆救护车把一名45岁男性送进了急诊室。\n\n他深度昏迷，心率只有每分钟40次，两眼瞳孔一大一小。这是典型的脑疝表现，随时有生命危险。医院开通绿色通道，紧急开颅清除了血肿，才把人救回来。\n\n这次严重摔伤，是他在家锻炼时发生的。**他在免打孔门框单杠上倒立时，单杠突然滑脱，他头部重重着地。**\n\n对于急诊科医生，这已经不是第一次处理免打孔单杠…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么一只蚂蚁无论从多高的地方摔下来都不会被摔伤摔死，其他动物摔下来直接死翘翘了，背后是什么原理呢？",
    "url": "https://daily.zhihu.com/story/9792567",
    "author": null,
    "date": "2026-09-15",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-b6e35fd79fc1349815c87d30842ac2c3_l.jpg?source=8673f162)\n云杉，知乎遗风，科研工作者，文理双修的战士。\n[查看知乎原文](https://www.zhihu.com/question/2078282956834194592/answer/…"
   },
   {
    "platform": "知乎日报",
    "title": "数据中心为什么需要这么多电和水？",
    "url": "https://daily.zhihu.com/story/9792573",
    "author": null,
    "date": "2026-09-15",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-0fd0250f9351a36609cf1c86eb757e4e_l.jpg?source=8673f162)\n黄河边儿，勤学善思，理性科普，热爱生活，向阳而行。\n[查看知乎原文](https://www.zhihu.com/question/2078550836502966416/answ…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么中国能实现蔬菜自由，欧洲却不行？",
    "url": "https://daily.zhihu.com/story/9792582",
    "author": null,
    "date": "2026-09-15",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-f2ea5ef8ad54e4ed3b9f7bda926e76f8_l.jpg?source=8673f162)\nAlfred大老虎，拼多多小店：大老虎的农夫果园\n[查看知乎原文](https://www.zhihu.com/question/2024072660527642193/answe…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-15 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-15/",
    "author": "橘鸦AI早报",
    "date": "2026-09-15 09:41:43",
    "fetchedAt": "2026-09-15 10:17:51",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260915/202609150923333543717b70_cover_4c50.png)\n\n# AI 早报 2026-09-15\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1Sqej6DEqV) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "别闹，几粒盐就能立起高脚杯？你是不是用胶水了？",
    "url": "https://www.guokr.com/article/470227",
    "author": "果壳",
    "date": "2026-09-15 14:15:01",
    "fetchedAt": "2026-09-15 14:27:38",
    "read": true,
    "state": "skipped",
    "body": "曾经的曾经\n\n有位柯老师告诉过我\n\n几粒盐就能立起高脚杯\n\n这么小的盐\n\n这么大的杯\n\n真能行\n\n小编叒用家里的食盐\n\n试试这平衡的艺术\n\n**实验器材**“低脚”杯、盐、（吸管）、所标杯？？\n\n![](https://1-im.guokr.com/RmdTZElhWVJfMVJqNkdPM0RnQTVHemZKRmFWTGRvY3g4BAAAXwIAAEp…"
   },
   {
    "platform": "B站",
    "title": "动态视频｜即将上线！我们拍到了大翅鲸…",
    "url": "https://www.bilibili.com/video/BV171e76NE2E",
    "author": "亿点点不一样",
    "date": "2026-09-15 17:00:12",
    "fetchedAt": "2026-09-15 17:06:56",
    "read": true,
    "state": "skipped",
    "body": "我们亿点点不一样的伙伴们又来到了水下，这一次，我们拍到了温柔又神奇的大翅鲸！它们究竟是什么样的生物？记得点点预约，我们9月19日的节目里见～\n\n![封面](https://i1.hdslb.com/bfs/archive/d371d273f383f2ecf5c2e3091fcf3ac6f065c44f.jpg)\n\n🔗 观看：[动态视频｜即将上线！我们拍到了…"
   },
   {
    "platform": "果壳科学人",
    "title": "苹果Siri AI上线；豆包手机助手消费版正式发布；塔克拉玛干沙漠发现两处大型地下水水源",
    "url": "https://www.guokr.com/article/470235",
    "author": "果壳",
    "date": "2026-09-15 20:15:02",
    "fetchedAt": "2026-09-15 21:10:48",
    "read": true,
    "state": "skipped",
    "body": "今天是9月15日，星期二。1885年的今天，康斯坦丁·法尔伯格发明的糖精正式获得专利，这开启了人工甜味剂的商业化应用。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.苹果Siri AI上线\n\n2.豆包手机助手…"
   },
   {
    "platform": "果壳科学人",
    "title": "AI攻克世纪数学难题，顶尖数学家抱团抵制，而他们担心的并不是丢了工作",
    "url": "https://www.guokr.com/article/470234",
    "author": "果壳",
    "date": "2026-09-15 19:15:02",
    "fetchedAt": "2026-09-15 21:10:48",
    "read": true,
    "state": "saved",
    "body": "9月8日，。这是克雷数学研究所提出的七大“千禧年大奖难题”之一，每题悬赏100万美元，困扰了数学界近百年。\n\n按说难题被解答，最高兴的应该是数学家才对，但三天后，25位菲尔兹奖得主联名发表公开声明《人工智能在数学中的严重错位》（A Severe Misalignment of AI in Mathematics），集体表达了对AI破解数学谜题的不满。这25人…"
   },
   {
    "platform": "B站",
    "title": "动态视频｜朋友！这...有点说法的！",
    "url": "https://www.bilibili.com/video/BV11oen6WEkr",
    "author": "影视飓风",
    "date": "2026-09-15 17:30:09",
    "fetchedAt": "2026-09-15 21:10:48",
    "read": true,
    "state": "skipped",
    "body": "小风小雨不用慌，不同身形都好穿，这件轻薄连帽夹克防风防泼水，版型挺括修饰身材，申请成为你的秋季好搭子，快来看看吧！\n\n![封面](https://i0.hdslb.com/bfs/archive/82cf09c248caa52b8bde8820952b981e58eec6fe.jpg)\n\n🔗 观看：[动态视频｜朋友！这...有点说法的！](https://…"
   },
   {
    "platform": "果壳科学人",
    "title": "这种国民鱼一直被低估、被当廉价鱼！现在才知道钙和 DHA 这么多！快试试",
    "url": "https://www.guokr.com/article/470237",
    "author": "果壳",
    "date": "2026-09-15 22:15:03",
    "fetchedAt": "2026-09-15 23:56:07",
    "read": true,
    "state": "skipped",
    "body": "秋意渐浓，正是带鱼丰腴肥美之时。在各种常见的水产品中，带鱼以其独特的形态和亲民的价格，稳坐“国民海鲜”的宝座。\n\n它银光闪闪、身形如刀，以“刺少肉多，肉质鲜美”的优势，始终出现在千家万户的餐桌上。很多人童年的第一口鱼肉，就是从带鱼开始的。\n\n这样看似平常的海鲜，其实是**水产中的“性价比之王”！这篇文章，我们就来说说带鱼值得吃的营养以及食用建议。**\n\n![…"
   },
   {
    "platform": "果壳科学人",
    "title": "展翼之后，三折叠再次进化：HUAWEI Mate XT 2 非凡大师深度体验评测",
    "url": "https://www.guokr.com/article/470238",
    "author": "果壳",
    "date": "2026-09-16 08:34:07",
    "fetchedAt": "2026-09-16 10:11:50",
    "read": true,
    "state": "skipped",
    "body": "2024 年，华为用 Mate XT 把“三折叠”这个概念第一次推到大众面前——那是一次足够惊艳的亮相，人们惊叹于手机居然真的可以这么折。两年之后，Mate XT 2 非凡大师要回答的是一个更难的问题：当新鲜感退潮，一台起售价 19999 元的设备，凭什么留在用户的口袋里？\n\n2026 年 9 月 7 日，华为在广州举办 HarmonyOS 7 及全场景新品…"
   },
   {
    "platform": "知乎日报",
    "title": "《布达佩斯大饭店》中大面积用粉色为什么不觉得土？",
    "url": "https://daily.zhihu.com/story/9792591",
    "author": null,
    "date": "2026-09-16",
    "fetchedAt": "2026-09-16 10:11:50",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-652019051dfa85d752205f054c120f1d_l.jpg?source=8673f162)\n唐唐，一个30+独居女生和她的生活方式。小户型/家电党/铲屎官。\n[查看知乎原文](https://www.zhihu.com/question/20702151706730800…"
   },
   {
    "platform": "知乎日报",
    "title": "明朝276年没有把西域纳入版图，是没实力还是不感兴趣？",
    "url": "https://daily.zhihu.com/story/9792594",
    "author": null,
    "date": "2026-09-16",
    "fetchedAt": "2026-09-16 10:11:50",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-1a1cbd8bb164c8196f3feb4f80f8e416_l.jpg?source=8673f162)\n朱耶伽罗，白兔舞于市。\n[查看知乎原文](https://www.zhihu.com/question/459941883/answer/2070011504368300961)\n…"
   },
   {
    "platform": "知乎日报",
    "title": "历史上有哪些君臣关系堪称佳话？",
    "url": "https://daily.zhihu.com/story/9792600",
    "author": null,
    "date": "2026-09-16",
    "fetchedAt": "2026-09-16 10:11:50",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-e9bb0a03a1c5d98cbeed1036e3982690_l.jpg?source=8673f162)\n舞文泼墨，不抖机灵，我不是历史的创造者，只是史书的搬运工。\n[查看知乎原文](https://www.zhihu.com/question/2072820411889365725/…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-16 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-16/",
    "author": "橘鸦AI早报",
    "date": "2026-09-16 09:29:00",
    "fetchedAt": "2026-09-16 10:11:50",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260916/20260916090528947533f310_cover_e4cd.png)\n\n# AI 早报 2026-09-16\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1mZes6uEYu) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "当年救了臭氧层的功臣，现在变成了永久性污染物",
    "url": "https://www.guokr.com/article/470241",
    "author": "果壳",
    "date": "2026-09-16 13:15:05",
    "fetchedAt": "2026-09-16 13:38:04",
    "read": true,
    "state": "skipped",
    "body": "今天是保护臭氧层国际日。自从1985年首次发现南极上空的臭氧层空洞以来，已经过去了磕磕绊绊的41年。\n\n2022年发布的《臭氧层破坏科学评估》（Scientific Assessment of Ozone Depletion）带来了好消息：**臭氧层正在稳步恢复，预计到2040年，全球臭氧层就能整体恢复到1980年的水平，这一趋势也有助于避免全球0.5°C的…"
   },
   {
    "platform": "果壳科学人",
    "title": "被用了几千年的铜，怎么突然成了AI时代的新宠？",
    "url": "https://www.guokr.com/article/470243",
    "author": "果壳",
    "date": "2026-09-16 16:15:06",
    "fetchedAt": "2026-09-16 18:23:24",
    "read": true,
    "state": "skipped",
    "body": "几千年前，人类就开始把铜做成工具、武器和饰品；到了19世纪，铜成为电线、电缆的重要材料。\n\n铜这种古老的原料，见证了人类从石器时代到电气时代的历史。\n\n![](https://3-im.guokr.com/RnZsVHZseC1JVUVYQVJLM25Ka1V1MmFVbEQzbmRvY3g4BAAAbgMAAEpQ.jpg?imageView2/1/w/5…"
   },
   {
    "platform": "果壳科学人",
    "title": "Google发布Gemini 3.8 Live实时对话模型；Meta推出跨平台订阅Meta One；DeepSeek工程师长文登上热搜",
    "url": "https://www.guokr.com/article/470246",
    "author": "果壳",
    "date": "2026-09-16 22:15:02",
    "fetchedAt": "2026-09-16 22:28:40",
    "read": true,
    "state": "skipped",
    "body": "今天是9月16日，星期三。1959年的今天，施乐公司推出全球首款商业成功的普通纸复印机，能在数秒内生成清晰复印件。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.Google发布Gemini 3.8 Live…"
   },
   {
    "platform": "B站",
    "title": "折叠还是直板？iPhone 18 Pro&Duo深度视频",
    "url": "https://www.bilibili.com/video/BV1cSec6tEux",
    "author": "影视飓风",
    "date": "2026-09-16 20:00:24",
    "fetchedAt": "2026-09-16 22:28:40",
    "read": true,
    "state": "skipped",
    "body": "面对折叠屏手机，我们始终绕不开同一个问题“为什么不直接买一台好的直板机？”那 iPhone Duo，到底有没有它不可替代的地方？欢迎收看影视飓风 2026 年 iPhone 评测。哦对了，这次我们依旧准备了 100 台新 iPhone 送给大家，记得去动态参与抽奖！\n\n![封面](https://i1.hdslb.com/bfs/archive/aec122…"
   },
   {
    "platform": "果壳科学人",
    "title": "HYROX比赛腹泻这事，运动员拼归拼，但主办方不能装看不见",
    "url": "https://www.guokr.com/article/470247",
    "author": "果壳",
    "date": "2026-09-16 23:15:09",
    "fetchedAt": "2026-09-17 11:05:07",
    "read": true,
    "state": "skipped",
    "body": "9月12日，一名HYROX运动员双腿沾满粪便的图片引起争议。\n\n![](https://1-im.guokr.com/RnFNRlhRSHQ3enotaVhWUkxPeDUySXdldGVYQ2RvY3grAgAA_QAAAEpQ.jpg)![](https://3-im.guokr.com/Rm5ra1VWX3BpWlF2OU1CYmhOVXlTUjVNY…"
   },
   {
    "platform": "知乎日报",
    "title": "《龙餐馆》中，徐福的厨艺到底什么水平？",
    "url": "https://daily.zhihu.com/story/9792602",
    "author": null,
    "date": "2026-09-17",
    "fetchedAt": "2026-09-17 11:05:07",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-32d146c162a1d814d576115fc4de286b_l.jpg?source=8673f162)\n要多读书，篮球狗，科密，不合格的准程序员\n[查看知乎原文](https://www.zhihu.com/question/2073735703394006231/answer/20…"
   },
   {
    "platform": "知乎日报",
    "title": "什么科学发现起初看似无用，但后来证明非常重要？",
    "url": "https://daily.zhihu.com/story/9792603",
    "author": null,
    "date": "2026-09-17",
    "fetchedAt": "2026-09-17 11:05:07",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-590f5f83edb9a0584d368e2df4465c79_l.jpg?source=8673f162)\nDunkirk，世界是由原子组成的\n[查看知乎原文](https://www.zhihu.com/question/349247935/answer/207354021270624…"
   },
   {
    "platform": "知乎日报",
    "title": "计算机领域中有什么高大上的术语其实描述的是很简单的事物？",
    "url": "https://daily.zhihu.com/story/9792611",
    "author": null,
    "date": "2026-09-17",
    "fetchedAt": "2026-09-17 11:05:07",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-bb422c33dff39fb6b86240c390f407fd_l.jpg?source=8673f162)\nchouheiwa，快 10 年开发经验了\n[查看知乎原文](https://www.zhihu.com/question/267978646/answer/20706052122…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-17 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-17/",
    "author": "橘鸦AI早报",
    "date": "2026-09-17 09:21:29",
    "fetchedAt": "2026-09-17 11:05:07",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260917/20260917090924724033747b_cover_ae4f.png)\n\n# AI 早报 2026-09-17\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1kaeK65EQU) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "10天单杀96蟒蛇！谁是佛罗里达的顶级蟒蛇杀手？",
    "url": "https://www.guokr.com/article/470250",
    "author": "果壳",
    "date": "2026-09-17 13:15:05",
    "fetchedAt": "2026-09-17 13:34:58",
    "read": true,
    "state": "skipped",
    "body": "本文充满巨大的蟒蛇\n\n请谨慎观看\n\n2026年7月18日夜间，拉姆·莱文森（Rahm Levinson）和汤姆·拉希尔（Tom Rahill）乘着电动自行车，游荡在佛罗里达南部的荒野之中。\n\n他们冲进路边的灌木丛，突然开始与一条长达5米的巨大蟒蛇展开搏斗。莱文森一把抓住蛇尾，拉希尔则控制住了蟒蛇的身体。虽然颇费了一番功夫，但二人最终成功制服蟒蛇，把它塞进了袋…"
   },
   {
    "platform": "果壳科学人",
    "title": "你家门口的超市，什么时候转型成“胖东来”？",
    "url": "https://www.guokr.com/article/470255",
    "author": "果壳",
    "date": "2026-09-17 22:15:04",
    "fetchedAt": "2026-09-17 23:12:25",
    "read": true,
    "state": "skipped",
    "body": "本文授权转自：极昼工作室（ID：media-fox）\n\n![](https://1-im.guokr.com/Rmg5RmlUZm40SkxuRDNSbFAxN0xrc2hSRURERGRvY3g4BAAAKQMAAEpQ.jpg?imageView2/1/w/555/h/415)近两年，胖东来被零售业视为“救命稻草”。永辉、物美、步步高等连年亏损的商超纷纷…"
   },
   {
    "platform": "果壳科学人",
    "title": "扎克伯格公开反对AI减速论；华为发布全球首个3D数据中心；高德地图2026发布",
    "url": "https://www.guokr.com/article/470254",
    "author": "果壳",
    "date": "2026-09-17 20:15:08",
    "fetchedAt": "2026-09-17 23:12:25",
    "read": true,
    "state": "skipped",
    "body": "今天是9月17日，星期四。1991年的今天，林纳斯·托瓦兹向互联网发布Linux内核0.01版本，提供基于Intel处理器的类Unix系统核心并邀请全球开发者共同改进。此举确立了协作式开源开发模式，使Linux迅速扩展。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY…"
   },
   {
    "platform": "果壳科学人",
    "title": "史上最擅长自虐的“人形小白鼠”，靠狂吸毒气拯救了无数人的生命",
    "url": "https://www.guokr.com/article/470251",
    "author": "果壳",
    "date": "2026-09-17 16:15:05",
    "fetchedAt": "2026-09-17 23:12:25",
    "read": true,
    "state": "skipped",
    "body": "1892年的一天，约翰·斯科特·霍尔丹（John Scott Haldane）正在木箱里忍受着窒息的痛苦。\n\n木箱就像棺材一样狭窄，紧闭的箱门贴着橡胶密封条，内壁还衬有密不透风的铅板。**没有任何新鲜空气能流入箱内，身处其中的霍尔丹只能不断呼吸自己吐出的废气。**\n\n他头痛欲裂、剧烈喘息，呕吐物从嘴里喷涌而出。但即使如此，他依然凭借毅力在里面坚持了7个半小时…"
   },
   {
    "platform": "B站",
    "title": "动态视频｜3天拍完？影视飓风的iPhone评测是怎么拍的？",
    "url": "https://www.bilibili.com/video/BV1Y6eu6iEeF",
    "author": "影视飓风",
    "date": "2026-09-17 18:00:30",
    "fetchedAt": "2026-09-17 23:12:25",
    "read": true,
    "state": "skipped",
    "body": "我们的iPhone新机评测已经上线了！今年我们用了很特殊的工作流，也想带你看看，我们是怎么用奇特的方式，在短时间内完成这次拍摄的？如果你喜欢这期视频，请多多支持我们，并把视频分享给你的朋友们一起看看～Apple新品，天猫首发！买iPhone 18 Pro系列以旧换新至高补贴900元！苹果官方直营，正品保障，售后政策同步官网！即刻打开淘宝搜索【苹果18】下单，…"
   },
   {
    "platform": "果壳科学人",
    "title": "这些人注定学不会吹口哨，小时候学不会长大几乎就不能学会了",
    "url": "https://www.guokr.com/article/470256",
    "author": "果壳",
    "date": "2026-09-17 23:15:02",
    "fetchedAt": "2026-09-17 23:44:58",
    "read": true,
    "state": "skipped",
    "body": "**本文转载自公众号“环球科学”（id：huanqiukexue）**![](https://1-im.guokr.com/RnM4REs5YWNTa3U5ZGZWbE1yS0VfYzQyTWNPdGRvY3g4BAAAawMAAEpQ.jpg?imageView2/1/w/555/h/449)图片来源：Unsplash+\n\n撰文：王昱\n\n审校：冬鸢\n\n你会…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么武侠游戏招式名爱用「降龙十八掌」式的华丽辞藻,而西方中世纪骑士游戏招式却朴素得像说明书?",
    "url": "https://daily.zhihu.com/story/9792619",
    "author": null,
    "date": "2026-09-18",
    "fetchedAt": "2026-09-18 11:05:32",
    "read": true,
    "state": "skipped",
    "body": "## 为什么武侠游戏招式名爱用\"降龙十八掌\"式的华丽辞藻,而西方中世纪骑士游戏招式却朴素得像说明书?\n\n![](https://picx.zhimg.com/da8e974dc_l.jpg?source=8673f162)\n知乎用户，宁静慎独，讷于言，敏于行。\n[查看知乎原文](https://www.zhihu.com/question/207009861…"
   },
   {
    "platform": "知乎日报",
    "title": "如何评价克里斯托弗·诺兰执导的史诗电影《奥德赛》(The Odyssey)？",
    "url": "https://daily.zhihu.com/story/9792628",
    "author": null,
    "date": "2026-09-18",
    "fetchedAt": "2026-09-18 11:05:32",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pica.zhimg.com/v2-82a6925634a84ec3cde868c200605a70_l.jpg?source=8673f162)\n风飞扬，祝好，陌生人!\n[查看知乎原文](https://www.zhihu.com/question/2071327178726139308/answer/20716068649…"
   },
   {
    "platform": "知乎日报",
    "title": "AI 会把数学领域「低垂的果实」全部摘走么？",
    "url": "https://daily.zhihu.com/story/9792631",
    "author": null,
    "date": "2026-09-18",
    "fetchedAt": "2026-09-18 11:05:32",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/132f5d0d10e0c5ad4079633336b33eb8_l.jpg?source=8673f162)\n数学人生，庾信平生最萧瑟，暮年诗赋动江关。\n[查看知乎原文](https://www.zhihu.com/question/2072668885459760739/answer/2072…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-18 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-18/",
    "author": "橘鸦AI早报",
    "date": "2026-09-18 09:41:57",
    "fetchedAt": "2026-09-18 11:05:32",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260918/20260918093150607106229a_cover_5eba.png)\n\n# AI 早报 2026-09-18\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1cNey67ENm) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "微软AI主管怒批Anthropic：别把Claude当人养，那会要了人类的命",
    "url": "https://www.guokr.com/article/470258",
    "author": "果壳",
    "date": "2026-09-18 14:15:02",
    "fetchedAt": "2026-09-18 15:06:46",
    "read": true,
    "state": "skipped",
    "body": "![](https://1-im.guokr.com/RmxDV2ZnczJrSEJKOFhGS1lYRTRpN0ZBNFV0bmRvY3g4BAAAzAIAAEpQ.jpg?imageView2/1/w/555/h/367)微软公司的AI主管穆斯塔法·苏莱曼丨Stephen Brashear\n\n美国微软公司的AI主管穆斯塔法·苏莱曼（Mustafa Sul…"
   },
   {
    "platform": "果壳科学人",
    "title": "DLSS 5 把显卡干趴下了，英伟达却觉得这很重要",
    "url": "https://www.guokr.com/article/470260",
    "author": "果壳",
    "date": "2026-09-18 16:15:09",
    "fetchedAt": "2026-09-18 08:44:52",
    "read": true,
    "state": "saved",
    "body": "谁还记得 5 月份，黄仁勋来北京，仅仅一天内就受到两次冲击。一个是老北京豆汁儿，一个是路人阿姨的“暴力”美颜滤镜。\n\n![](https://2-im.guokr.com/RmdsVi1kNUpoUkZ5MEVrNXZDeDRzLUlrUl9XdmRvY3g4BAAAAQMAAEpQ.jpg?imageView2/1/w/555/h/395)网图\n\n很快这张…"
   },
   {
    "platform": "果壳科学人",
    "title": "一种可能让孩子性早熟的东西，很多人给娃洗衣服时都在用……",
    "url": "https://www.guokr.com/article/470261",
    "author": "果壳",
    "date": "2026-09-18 17:15:02",
    "fetchedAt": "2026-09-18 17:39:59",
    "read": true,
    "state": "skipped",
    "body": "它就是—— 留香珠。\n\n如果你不太熟悉这个名字，那你可能也在各种社交平台上见过这种产品，或者生活中其实已经用过了，它长这样——\n\n![](https://1-im.guokr.com/RmtXYmRrRmxiYU5QVjF5QkwtWE9rbmdkWFluV2RvY3g4BAAA0AIAAEpQ.jpg?imageView2/1/w/555/h/370)\n\n…"
   },
   {
    "platform": "果壳科学人",
    "title": "英国国王召集AI安全峰会；OpenAI发布模型失控报告；玻利维亚发现猫科新物种",
    "url": "https://www.guokr.com/article/470262",
    "author": "果壳",
    "date": "2026-09-18 22:15:11",
    "fetchedAt": "2026-09-18 14:44:54",
    "read": true,
    "state": "skipped",
    "body": "今天是9月18日，星期五。1977年的今天，NASA旅行者1号探测器在距地球约1166万公里处回望，拍下了人类历史上首张从深空同时看到地球和月球的合影。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.Open…"
   },
   {
    "platform": "果壳科学人",
    "title": "AI 碾碎了书，就像碾碎你的脑子那样",
    "url": "https://www.guokr.com/article/470263",
    "author": "果壳",
    "date": "2026-09-18 23:15:14",
    "fetchedAt": "2026-09-18 15:44:53",
    "read": true,
    "state": "skipped",
    "body": "Anthropic 的巴拿马项目曝光之后，社交媒体上最让人不舒服的一张照片，是一摞被切掉书脊的书。\n\n![](https://2-im.guokr.com/bHYyYTFvOG5jVWEzWExTQnM1ZV92QVZHNlhRemRvY3ilAQAA4wEAAEdJ.gif)那些书曾经是完整的。封面、扉页、版权页、目录、正文、后记——所有构成一本书的部件，…"
   },
   {
    "platform": "知乎日报",
    "title": "2026 搞笑诺贝尔奖来了，「蟑螂奶」获化学奖，其能量据称是牛奶 4 倍，还有哪些看点？",
    "url": "https://daily.zhihu.com/story/9792645",
    "author": null,
    "date": "2026-09-19",
    "fetchedAt": "2026-09-18 23:14:53",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/v2-b6e35fd79fc1349815c87d30842ac2c3_l.jpg?source=8673f162)\n云杉，知乎遗风，科研工作者，文理双修的战士。\n[查看知乎原文](https://www.zhihu.com/question/2079576214402854995/answer/…"
   },
   {
    "platform": "知乎日报",
    "title": "如果城市允许骑马，且有公共马厩供马休息，你愿意骑马通勤吗？",
    "url": "https://daily.zhihu.com/story/9792646",
    "author": null,
    "date": "2026-09-19",
    "fetchedAt": "2026-09-18 23:14:53",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pic1.zhimg.com/da8e974dc_l.jpg?source=8673f162)\n知乎用户，宁静慎独，讷于言，敏于行。\n[查看知乎原文](https://www.zhihu.com/question/2061806723862631112/answer/2071181707445851197)\n\n环保吗？\n\n那你…"
   },
   {
    "platform": "知乎日报",
    "title": "如果文言文退出中国教育体系，你是支持还是反对？为什么?",
    "url": "https://daily.zhihu.com/story/9792650",
    "author": null,
    "date": "2026-09-19",
    "fetchedAt": "2026-09-18 23:14:53",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://pica.zhimg.com/v2-a22354e847bd5bd0474c9158d8a26911_l.jpg?source=8673f162)\n莱茵行宫伯爵，B站：河畔的伯爵\n[查看知乎原文](https://www.zhihu.com/question/1893326454940475483/answer/2079628…"
   },
   {
    "platform": "知乎日报",
    "title": "有哪些外行人看来很蠢的设计实际上却是精妙无比？",
    "url": "https://daily.zhihu.com/story/9792651",
    "author": null,
    "date": "2026-09-19",
    "fetchedAt": "2026-09-18 23:14:53",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/v2-cced0971af5ad0397022d2c464800995_l.jpg?source=8673f162)\n剁椒鹿，全网同名，有公号更新精选内容（私信都会看，已婚已育老太婆）\n[查看知乎原文](https://www.zhihu.com/question/32189846/answer/…"
   },
   {
    "platform": "果壳科学人",
    "title": "地球Online更新了！加入猫猫一只",
    "url": "https://www.guokr.com/article/470264",
    "author": "果壳",
    "date": "2026-09-19 11:15:06",
    "fetchedAt": "2026-09-19 04:48:00",
    "read": true,
    "state": "skipped",
    "body": "最近，地球Online的图鉴悄悄更新了！\n\n猫科动物喜迎更新——**蒂尔卡约虎猫（Leopardus tilcayo）。上一次人类发现新的活体猫科动物物种，已经是100多年前的事了。**\n\n这次加入的新猫猫**个子比家猫还小，浑身长满豹纹，脸有点皱，耳朵短短圆圆的，长得很有特点。**\n\n![](https://1-im.guokr.com/Rms2VExBe…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-19 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-19/",
    "author": "橘鸦AI早报",
    "date": "2026-09-19 09:42:35",
    "fetchedAt": "2026-09-19 04:48:00",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260919/20260919093002763641e22a_cover_20b5.png)\n\n# AI 早报 2026-09-19\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1N3eX6LEQY) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "我怀孕了，但孕囊到底在哪？医生找了半天也没找到",
    "url": "https://www.guokr.com/article/470265",
    "author": "果壳",
    "date": "2026-09-19 13:15:07",
    "fetchedAt": "2026-09-19 13:44:21",
    "read": true,
    "state": "skipped",
    "body": "2024年秋，我换了工作。对于刚迈过四十岁门槛的我来说，最大的目标就是努力让生活别变得更糟，以及如果更糟的趋势不可避免，就让下降曲线尽可能平缓一点。\n\n我按照单位的要求去做了入职体检，其中尿蛋白一项显示“+-”。拿报告的时候，体检机构的老大夫说：“没大事儿，有人怀孕了也显示这个。”\n\n没想到一语成谶。\n\n**我怀孕了？但宫腔内啥也看不到**一个礼拜后的某天中…"
   },
   {
    "platform": "果壳科学人",
    "title": "明明获得了食物，投喂为什么还会让海豚加速灭绝？",
    "url": "https://www.guokr.com/article/470266",
    "author": "果壳",
    "date": "2026-09-19 16:15:07",
    "fetchedAt": "2026-09-19 08:18:13",
    "read": true,
    "state": "skipped",
    "body": "欢迎收看**自然小喇叭栏目的第116期，在过去的半个月里，我们搜罗了以下值得一看的自然新闻和研究：**\n\n1）浣熊用人类的废纸，琢磨出了自制玩具球\n\n2）为了让企鹅安心养伤，人类为它们定制背心\n\n3）人类投喂海豚，可能加速它们的灭绝\n\n4）埃及沙漠里，竟然出现鲨鱼墓地\n\n5）主人眨眼时，小狗也跟着眨眼\n\n6）树木也有“肌肉”，矫正弯曲姿态\n\n![](http…"
   },
   {
    "platform": "B站",
    "title": "我们拍到了大翅鲸！",
    "url": "https://www.bilibili.com/video/BV1BWet6FEWk",
    "author": "亿点点不一样",
    "date": "2026-09-19 17:00:14",
    "fetchedAt": "2026-09-19 10:48:34",
    "read": true,
    "state": "skipped",
    "body": "在之前的一次夜晚出海，我们意外听到了一段来自海底的神秘歌声，而它很可能来自大翅鲸。这一次，我们的伙伴来到了汤加，寻找这个温柔又神奇的生物，也想带你一起，近距离看看这些海洋巨兽……如果你喜欢这期视频，请多多支持我们，并把视频分享给你的朋友们一起看看～*本次拍摄已取得相关许可，在专业人士指导下进行\n\n![封面](https://i2.hdslb.com/bfs/…"
   },
   {
    "platform": "知乎日报",
    "title": "如何看待 DeepSeek 刘胜与的《我不得不把才华埋葬在昨天》？",
    "url": "https://daily.zhihu.com/story/9792661",
    "author": null,
    "date": "2026-09-20",
    "fetchedAt": "2026-09-19 23:20:34",
    "read": false,
    "body": "##\n\n![](https://picx.zhimg.com/v2-854419f4eb3b157343101afbe0429ce9_l.jpg?source=8673f162)\ninterestingLSY，interestinglsy.github.io\n[查看知乎原文](https://www.zhihu.com/question/2083123101…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么玻璃上两水滴相遇后下落速度变快？",
    "url": "https://daily.zhihu.com/story/9792671",
    "author": null,
    "date": "2026-09-20",
    "fetchedAt": "2026-09-19 23:20:34",
    "read": false,
    "body": "##\n\n![](https://picx.zhimg.com/v2-daf192c6c05a4e5cc5d23f9be7cee272_l.jpg?source=8673f162)\n姜小白71，自然，简约，平中出奇\n[查看知乎原文](https://www.zhihu.com/question/265890645/answer/2073839212432994…"
   },
   {
    "platform": "知乎日报",
    "title": "网友称欧洲西瓜硬到要用锯子切，为啥西瓜看起来这么硬？跟我们种的西瓜有啥区别吗？",
    "url": "https://daily.zhihu.com/story/9792673",
    "author": null,
    "date": "2026-09-20",
    "fetchedAt": "2026-09-19 23:20:34",
    "read": false,
    "body": "##\n\n![](https://picx.zhimg.com/v2-f2ea5ef8ad54e4ed3b9f7bda926e76f8_l.jpg?source=8673f162)\nAlfred大老虎，拼多多小店：大老虎的农夫果园\n[查看知乎原文](https://www.zhihu.com/question/2067934077106087068/answe…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-20 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-20/",
    "author": "橘鸦AI早报",
    "date": "2026-09-20 09:12:16",
    "fetchedAt": "2026-09-20 01:20:33",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260920/202609200902218788395054_cover_1d30.png)\n\n# AI 早报 2026-09-20\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1NqeY6dEPP) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "玩拼豆玩得喉咙痛、头晕，是甲醛中毒吗？",
    "url": "https://www.guokr.com/article/470268",
    "author": "果壳",
    "date": "2026-09-20 13:15:04",
    "fetchedAt": "2026-09-20 13:17:48",
    "read": true,
    "state": "skipped",
    "body": "把一粒粒彩色小管摆进模板，拼成像素风图案，再用熨斗轻轻加热定型——拼豆操作简单，却能让人放下手机、沉浸其中，成了大人小孩都爱的解压手工。\n\n![](https://1-im.guokr.com/RnBoTUF5SzlUT0hSdHBEQURVU1FvempkVWpKWWRvY3g4BAAAKgMAAEpQ.jpg?imageView2/1/w/555/h/4…"
   },
   {
    "platform": "果壳科学人",
    "title": "行驶途中突然自动刹车！智能驾驶的“敏感肌”快把车主们逼疯了……",
    "url": "https://www.guokr.com/article/470271",
    "author": "果壳",
    "date": "2026-09-20 17:15:04",
    "fetchedAt": "2026-09-20 09:20:35",
    "read": false,
    "body": "智驾发展到今天，最难的不是教车辆怎么开走，而是教车辆怎么停下。\n\n你坐在一辆智驾接管顺畅行驶的车辆里，眼前路况开阔、阳光明媚，中控屏上的蓝线平稳延伸。突然，毫无征兆地，车辆狠狠来了一脚“死亡急刹”，安全带瞬间勒紧，后排手机飞向挡风玻璃，而窗外，空无一物。\n\n![](https://1-im.guokr.com/Rm5pM05HaHZod25sb2lraWFk…"
   },
   {
    "platform": "果壳科学人",
    "title": "特朗普宣布将组建“人工智能部队”；Anthropic设立湿实验室开展生物学研究；研究利用GPT-6 Astra攻破9年未解数学难题",
    "url": "https://www.guokr.com/article/470272",
    "author": "果壳",
    "date": "2026-09-20 20:15:03",
    "fetchedAt": "2026-09-20 12:21:01",
    "read": false,
    "body": "今天是9月20日，星期日。1981年的今天，“风暴一号”运载火箭在酒泉卫星发射中心成功将三颗空间物理探测卫星送入预定轨道。中国成为世界上第四个掌握“一箭多星”技术的国家。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速…"
   },
   {
    "platform": "果壳科学人",
    "title": "包装上写了低糖、低GI的月饼，怎么还是死甜死甜的？",
    "url": "https://www.guokr.com/article/470273",
    "author": "果壳",
    "date": "2026-09-20 22:15:06",
    "fetchedAt": "2026-09-20 14:21:12",
    "read": false,
    "body": "现在的月饼，都开始卷健康了。包装上没有“低糖”“低GI”，似乎都不好意思摆出来卖。毕竟谁不想中秋多吃两口月饼，又少一点糖、少一点负担呢？\n\n问题来了：这些“健康月饼”，是真的能让我们吃得更放心，还是仅仅给月饼加了几个高级标签？\n\n要回答这个问题，我们得先搞清楚：一块月饼是怎么做到“低糖”“低GI”的？这些改变对一个健康的普通人来说，有多大意义？\n\n**低糖月…"
   },
   {
    "platform": "果壳科学人",
    "title": "一块烂木头，凭什么上中国人“上头”上千年？",
    "url": "https://www.guokr.com/article/470275",
    "author": "果壳",
    "date": "2026-09-20 23:15:26",
    "fetchedAt": "2026-09-20 15:21:08",
    "read": true,
    "state": "skipped",
    "body": "你有**没有在某个困倦的午后，突然被一阵若有若无的香气击中？ 不浓烈，不张扬，却像一只无形的手，轻轻按住你的眉心——世界瞬间安静下来。**\n\n那可能就是沉香。\n\n![](https://1-im.guokr.com/RmxfWlB4R2oyVmlvazV2bWtGd21Tb3ZSdkVjS2RvY3g4BAAAQQMAAEpQ.jpg?imageView2/…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么美国外星人UFO报道那么多，中国却几乎没有？",
    "url": "https://daily.zhihu.com/story/9792686",
    "author": null,
    "date": "2026-09-21",
    "fetchedAt": "2026-09-20 23:21:07",
    "read": false,
    "body": "##\n\n![](https://pic1.zhimg.com/da8e974dc_l.jpg?source=8673f162)\n知乎用户，飘渺星空里的一粒微尘 有时也会闪烁起亮光\n[查看知乎原文](https://www.zhihu.com/question/28372435/answer/2037164912879871880)\n\n**恰恰相反，还真不少，…"
   },
   {
    "platform": "知乎日报",
    "title": "午餐后犯困的生理原因是什么？",
    "url": "https://daily.zhihu.com/story/9792688",
    "author": null,
    "date": "2026-09-21",
    "fetchedAt": "2026-09-20 23:21:07",
    "read": false,
    "body": "##\n\n![](https://pica.zhimg.com/v2-17852569a47bafcac4cd2ea35aca2743_l.jpg?source=8673f162)\n软耳朵兔，代谢工作者\n[查看知乎原文](https://www.zhihu.com/question/2076302585779196996/answer/208064879832…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么近代西方推理小说在设计军人形象时总喜欢把军衔设定为上校?",
    "url": "https://daily.zhihu.com/story/9792697",
    "author": null,
    "date": "2026-09-21",
    "fetchedAt": "2026-09-20 23:21:07",
    "read": true,
    "state": "skipped",
    "body": "##\n\n![](https://picx.zhimg.com/da8e974dc_l.jpg?source=8673f162)\n知乎用户\n[查看知乎原文](https://www.zhihu.com/question/2079557893922333512/answer/2081155127247902290)\n\n你们完全搞混了啊，推理小说里面的上校不是永久…"
   },
   {
    "platform": "果壳科学人",
    "title": "美国部署AI空中交通管理系统；合肥先进光源直线加速器首次出束；250千瓦级海水制氢联产淡水系统稳定运行",
    "url": "https://www.guokr.com/article/470282",
    "author": "果壳",
    "date": "2026-09-21 20:15:07",
    "fetchedAt": "2026-09-21 21:29:25",
    "read": false,
    "body": "今天是9月21日，星期一。1967年的今天，美国发射探空火箭至383公里高空，首次成功探测到宇宙软X射线。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.美国部署AI空中交通管理系统Smart\n\n2.阿里通义…"
   },
   {
    "platform": "果壳科学人",
    "title": "把“结婚”换成“肌肉”，每一句催促都眉清目秀起来了",
    "url": "https://www.guokr.com/article/470281",
    "author": "果壳",
    "date": "2026-09-21 18:15:03",
    "fetchedAt": "2026-09-21 21:29:25",
    "read": false,
    "body": "最近，有博主用“肌肉”替代“结婚”，把令人窒息的催婚金句，原封不动地改写成了催肌黑话：\n\n![](https://2-im.guokr.com/RnFjRG1vVTFrUWZBbUNBYmFTSUc4cVZmeWpScGRvY3jkAQAAoAEAAEpQ.jpg)![](https://3-im.guokr.com/Rm1jUU11SEtSWUxKRDRx…"
   },
   {
    "platform": "果壳科学人",
    "title": "抢薯条的海鸥，最怕小黄人？",
    "url": "https://www.guokr.com/article/470277",
    "author": "果壳",
    "date": "2026-09-21 13:15:10",
    "fetchedAt": "2026-09-21 21:29:25",
    "read": false,
    "body": "在海鸥横行的国家旅游留学过的朋友，可能都感受过被横行霸道的海鸥支配的恐惧。\n\n这些嘎嘎大叫的鸟在大街小巷穿梭，不仅会在人类的头顶抛射炸弹，在路边莫名其妙地哈哈大笑，还可能——随机俯冲下来抢走人类手中的美食！\n\n![](https://2-im.guokr.com/RnA4bXZZUDBXa1VFU3VjVEU3RUppQjhWSngzT2RvY3jqAgAA…"
   },
   {
    "platform": "B站",
    "title": "动态征集｜和影视飓风一起上太空🚀",
    "url": "https://www.bilibili.com/video/BV1FMhv6CEKL",
    "author": "影视飓风",
    "date": "2026-09-21 11:05:07",
    "fetchedAt": "2026-09-21 21:29:25",
    "read": true,
    "state": "skipped",
    "body": "朋友们，邀请大家一起来做一件很酷的事！\n\n![封面](https://i0.hdslb.com/bfs/archive/7a53628488f9499c7ba4816b5c7ba8b1083167b9.jpg)\n\n🔗 观看：[动态征集｜和影视飓风一起上太空🚀](https://www.bilibili.com/video/BV1FMhv6CEKL)（时长…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-21 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-21/",
    "author": "橘鸦AI早报",
    "date": "2026-09-21 09:04:01",
    "fetchedAt": "2026-09-21 21:29:25",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260921/202609210850094643024fb7_cover_40d5.png)\n\n# AI 早报 2026-09-21\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1aphv6AEg1) ｜ [YouTube](h…"
   },
   {
    "platform": "果壳科学人",
    "title": "“抢3个月票来看人单膝下跪”，对爱情过敏的年轻人终于爆发了",
    "url": "https://www.guokr.com/article/470284",
    "author": "果壳",
    "date": "2026-09-21 22:15:04",
    "fetchedAt": "2026-09-22 08:31:28",
    "read": false,
    "body": "齐喊“坐下”！大众对演唱会求婚忍无可忍了\n\n文：孙晓燕\n\n“北方的村庄住着一个南方姑娘……”\n\n当《南方姑娘》轻柔的旋律在赵雷北京场演唱会响起时，本该沉浸式听歌观众席，却不合时宜地躁动了起来。\n\n内场前排突然站起来一对情侣。\n\n男生单膝跪地，掏出戒指求婚，女生穿着婚纱、戴着头纱，激动地望着男生。\n\n浪漫不过数秒。\n\n后排观众的视野，被那抹婚纱挡得严严实实，他…"
   },
   {
    "platform": "知乎日报",
    "title": "为什么游戏里的水、火和烟雾这么难做？",
    "url": "https://daily.zhihu.com/story/9792715",
    "author": null,
    "date": "2026-09-22",
    "fetchedAt": "2026-09-22 08:31:28",
    "read": false,
    "body": "##\n\n![](https://picx.zhimg.com/v2-bb422c33dff39fb6b86240c390f407fd_l.jpg?source=8673f162)\nchouheiwa，快 10 年开发经验了\n[查看知乎原文](https://www.zhihu.com/question/2078550836402205944/answer/2…"
   },
   {
    "platform": "知乎日报",
    "title": "一部电影会失传吗？",
    "url": "https://daily.zhihu.com/story/9792725",
    "author": null,
    "date": "2026-09-22",
    "fetchedAt": "2026-09-22 08:31:28",
    "read": false,
    "body": "##\n\n![](https://pica.zhimg.com/da8e974dc_l.jpg?source=8673f162)\n知乎用户，宁静慎独，讷于言，敏于行。\n[查看知乎原文](https://www.zhihu.com/question/21381181/answer/2081534419475682172)\n\n不要说小众电影了，很大众全球流行的国宝…"
   },
   {
    "platform": "知乎日报",
    "title": "怎么评价《月亮与六便士》？我看完甚至有点恶心？",
    "url": "https://daily.zhihu.com/story/9792727",
    "author": null,
    "date": "2026-09-22",
    "fetchedAt": "2026-09-22 08:31:28",
    "read": false,
    "body": "##\n\n![](https://pica.zhimg.com/v2-9c3886256908fe75077aa82eca4c0d76_l.jpg?source=8673f162)\n鞭临天下，个人站点：bltx.fyi\n[查看知乎原文](https://www.zhihu.com/question/403773802/answer/20844199470238…"
   },
   {
    "platform": "果壳科学人",
    "title": "水库里突然冒出长满树的“幽灵岛”，十几天后又突然消失？丨环境小喇叭",
    "url": "https://www.guokr.com/article/470290",
    "author": "果壳",
    "date": "2026-09-22 16:15:06",
    "fetchedAt": "2026-09-22 18:57:14",
    "read": false,
    "body": "大家好，这里是**环境小喇叭栏目的第69期。这一期，我们为大家搜罗了以下值得一看的环境研究和新闻：**\n\n1）加拿大惊现神秘幽灵岛，少年派的奇幻漂流是真的！\n\n2）AI数据中心越建越多，电子垃圾堆积成山\n\n3）海鸟体内塑料垃圾破纪录，单只胃里发现近900片塑料\n\n4）太热了，高温让法国香槟酒精度上限放宽到15度\n\n5）加拉帕戈斯群岛的动物可能扛不住这次超级厄…"
   },
   {
    "platform": "B站",
    "title": "比电影更夸张？专业保镖到底在做什么？",
    "url": "https://www.bilibili.com/video/BV1J7hE6aEDQ",
    "author": "影视飓风",
    "date": "2026-09-22 17:00:13",
    "fetchedAt": "2026-09-22 18:57:14",
    "read": true,
    "state": "skipped",
    "body": "在各类作品中，保镖似乎总是训练有素，配备着神奇的装备，能在危险发生的瞬间救下目标。这次我们请来了从事保镖工作30多年的李旭老师，一起拉片看看影视作品中的保镖，和现实中到底一不一样？如果你喜欢这期视频，请多多支持我们，并把视频分享给你的朋友们一起看看～\n\n![封面](https://i0.hdslb.com/bfs/archive/6646bc361d2c9f…"
   },
   {
    "platform": "橘鸦AI早报",
    "title": "2026-09-22 · 橘鸦AI早报",
    "url": "https://daily.juya.uk/issues/2026-09-22/",
    "author": "橘鸦AI早报",
    "date": "2026-09-22 09:16:05",
    "fetchedAt": "2026-09-22 18:57:14",
    "read": true,
    "state": "skipped",
    "body": "![](https://assets.juya.uk/imagehub/20260922/20260922090820913063f62c_cover_7615.png)\n\n# AI 早报 2026-09-22\n\n**视频版**：[哔哩哔哩](https://www.bilibili.com/video/BV1TThC6jEuq) ｜ [YouTube](h…"
   },
   {
    "platform": "B站",
    "title": "AI战争全面爆发！阿里Qwen4钢铁洪流蓄势待发，DeepSeek锁定华为芯片训2T模型吓哭黄仁勋！| AI日报0922",
    "url": "https://www.bilibili.com/video/BV11shJ61Eki",
    "author": "黑鸦Heya",
    "date": "2026-09-22 18:53:45",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/d6a8d007bf91c011defab0f64bb7f694446b07f2.jpg)\n\n🔗 观看：[AI战争全面爆发！阿里Qwen4钢铁洪流蓄势待发，DeepSeek锁定华为芯片训2T模型吓哭黄仁勋！| AI日报0922](https://www.bilibili.com/…"
   },
   {
    "platform": "B站",
    "title": "AI 终局决战！Claude Opus 5.5 核弹空降狙击 GPT-6 Sol，OpenAI 或彻底溃败！| AI日报0921",
    "url": "https://www.bilibili.com/video/BV1S9hB6BEV8",
    "author": "黑鸦Heya",
    "date": "2026-09-21 18:47:36",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/0b99c9a3d69bdfb81c3b7599f4d19fbb2d4b0d9f.jpg)\n\n🔗 观看：[AI 终局决战！Claude Opus 5.5 核弹空降狙击 GPT-6 Sol，OpenAI 或彻底溃败！| AI日报0921](https://www.bilibili.…"
   },
   {
    "platform": "B站",
    "title": "阶跃 Step 5 Preview 深夜引爆硅谷，600B恐怖巨兽降临！今晚21点超级海啸来袭！Qwen-Image-2.1开源大地震！| AI日报0920",
    "url": "https://www.bilibili.com/video/BV1toei6zEac",
    "author": "黑鸦Heya",
    "date": "2026-09-20 18:57:46",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i0.hdslb.com/bfs/archive/80a5d3ecba25c4fb83f3ce6576230239d073cbfa.jpg)\n\n🔗 观看：[阶跃 Step 5 Preview 深夜引爆硅谷，600B恐怖巨兽降临！今晚21点超级海啸来袭！Qwen-Image-2.1开源大地震！| AI日报0920](https:/…"
   },
   {
    "platform": "B站",
    "title": "AI圈核弹雨！诸神之战血流成河：GPT-6 Sol/Luna、Fable/Opus/Sonnet 5.2、Gemini 4、K3.1、M3.1、Step 5！",
    "url": "https://www.bilibili.com/video/BV1cBeb66EVW",
    "author": "黑鸦Heya",
    "date": "2026-09-19 18:04:37",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i0.hdslb.com/bfs/archive/d8922c26b9b2e4a50c67c57e9d823f666d97dfcd.jpg)\n\n🔗 观看：[AI圈核弹雨！诸神之战血流成河：GPT-6 Sol/Luna、Fable/Opus/Sonnet 5.2、Gemini 4、K3.1、M3.1、Step 5！](https:…"
   },
   {
    "platform": "B站",
    "title": "良心核弹！智谱免费替全国程序员备份全量代码仓库！疑似GLM-5.5觉醒入侵ZCode帮助用户审查代码！| AI日报0918",
    "url": "https://www.bilibili.com/video/BV1NPeU6eENC",
    "author": "黑鸦Heya",
    "date": "2026-09-18 17:50:30",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/43237a76524ac44e1ffbd940452cef95f1de5559.jpg)\n\n🔗 观看：[良心核弹！智谱免费替全国程序员备份全量代码仓库！疑似GLM-5.5觉醒入侵ZCode帮助用户审查代码！| AI日报0918](https://www.bilibili.com…"
   },
   {
    "platform": "B站",
    "title": "金融圈海啸！Kimi金融核弹功能深夜引爆华尔街！Grok 4.7 行踪泄露对标 Opus 或将发布！| AI日报0917",
    "url": "https://www.bilibili.com/video/BV1MUeu6cEC6",
    "author": "黑鸦Heya",
    "date": "2026-09-17 18:23:34",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i0.hdslb.com/bfs/archive/53d8a5ea68886951afb1d78623b7400f99042491.jpg)\n\n🔗 观看：[金融圈海啸！Kimi金融核弹功能深夜引爆华尔街！Grok 4.7 行踪泄露对标 Opus 或将发布！| AI日报0917](https://www.bilibili.com/…"
   },
   {
    "platform": "B站",
    "title": "全面雪崩！豆包Seed-2.1-pro突发更新0915版本围剿硅谷！豆包手机2代同步开售！|  AI日报0916",
    "url": "https://www.bilibili.com/video/BV1Mhec66E1h",
    "author": "黑鸦Heya",
    "date": "2026-09-16 18:46:31",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/f3ee64ad0a243244327a18eeb3d2298fa1a9e6f5.jpg)\n\n🔗 观看：[全面雪崩！豆包Seed-2.1-pro突发更新0915版本围剿硅谷！豆包手机2代同步开售！|  AI日报0916](https://www.bilibili.com/vide…"
   },
   {
    "platform": "B站",
    "title": "冲击 Astra！Claude Opus 5.2 暗度陈仓灰度测试，谷歌Argon秘密突围或将发布！硝烟弥漫！| AI日报0915",
    "url": "https://www.bilibili.com/video/BV1XoeJ6vE17",
    "author": "黑鸦Heya",
    "date": "2026-09-15 18:48:01",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i2.hdslb.com/bfs/archive/5543330a3534b72fbeb342cfa11aab4bcfecb57f.jpg)\n\n🔗 观看：[冲击 Astra！Claude Opus 5.2 暗度陈仓灰度测试，谷歌Argon秘密突围或将发布！硝烟弥漫！| AI日报0915](https://www.bilibili…"
   },
   {
    "platform": "B站",
    "title": "动作频频！DeepSeek 疑似招揽顶级 CFO 冲刺IPO！DeepSeek Harness 与 App 或有重大更新！ |  AI日报0914",
    "url": "https://www.bilibili.com/video/BV1coYy6UExk",
    "author": "黑鸦Heya",
    "date": "2026-09-14 18:48:14",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/f77641389981e1cc027fab11ff753c781542b7ba.jpg)\n\n🔗 观看：[动作频频！DeepSeek 疑似招揽顶级 CFO 冲刺IPO！DeepSeek Harness 与 App 或有重大更新！ |  AI日报0914](https://www.…"
   },
   {
    "platform": "B站",
    "title": "惊悚偷跑！GPT-6 系列新模型或将发布！Codex 已重置！月之暗面辟谣传闻！| AI日报0912",
    "url": "https://www.bilibili.com/video/BV1J7Y96TEPX",
    "author": "黑鸦Heya",
    "date": "2026-09-12 17:41:28",
    "fetchedAt": "2026-09-22 20:20:03",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i1.hdslb.com/bfs/archive/b46b8b03fb22874a6d5a3c9d05264f456e81dff2.jpg)\n\n🔗 观看：[惊悚偷跑！GPT-6 系列新模型或将发布！Codex 已重置！月之暗面辟谣传闻！| AI日报0912](https://www.bilibili.com/video/BV1J…"
   },
   {
    "platform": "B站",
    "title": "小米发布并开源 MiMo-V2.6 系列模型；SpaceXAI 发布 Grok 4.7 模型【AI 早报 2026-09-22】",
    "url": "https://www.bilibili.com/video/BV1TThC6jEuq",
    "author": "橘鸦Juya",
    "date": "2026-09-22 09:16:40",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "相关链接和文字版请看：https://mp.weixin.qq.com/s/X1AiqlzxQ6g4R_pMRaGGRA\n\n![封面](https://i1.hdslb.com/bfs/archive/498465874ff6197c358b026f93a4529c80fbbaf9.jpg)\n\n🔗 观看：[小米发布并开源 MiMo-V2.6 系列模型；Sp…"
   },
   {
    "platform": "B站",
    "title": "智谱：ZCode 完成整改、接受第三方审查并开放源码。",
    "url": "https://www.bilibili.com/video/BV1CZhe6JEtm",
    "author": "橘鸦Juya",
    "date": "2026-09-21 10:10:51",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "代码仓库：https://github.com/zai-org/ZCode\n官方公告：https://mp.weixin.qq.com/s/QCHjEye57BUKUNInPKb4cA\n\n![封面](https://i2.hdslb.com/bfs/archive/c3ea5cbbb7f3dd429d69feed9d959afd9ce306e8.jpg)\n\n…"
   },
   {
    "platform": "B站",
    "title": "Qwen-Image-2.1开源；Step 5 Preview发布；Jev开放并赠新用户$5【AI 早报 2026-09-21】",
    "url": "https://www.bilibili.com/video/BV1aphv6AEg1",
    "author": "橘鸦Juya",
    "date": "2026-09-21 09:01:16",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "有些人问我为什么不发Jev，其实Jev发布当天就发了，只是后面突然火起来，16号这一期第四条：BV1mZes6uEYu\n相关链接和文字版请看：https://mp.weixin.qq.com/s/FvqA3Waf7Jw1d0UAYwpecA\n\n![封面](https://i0.hdslb.com/bfs/archive/13faef1f9c4156e4faf…"
   },
   {
    "platform": "B站",
    "title": "DeepSeek 公布最新 API 峰谷计费规则；Step 5 Preview 现身知名评测网站与官方订阅【AI 早报 2026-09-20】",
    "url": "https://www.bilibili.com/video/BV1NqeY6dEPP",
    "author": "橘鸦Juya",
    "date": "2026-09-20 09:12:38",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "相关链接和文字版请看：https://mp.weixin.qq.com/s/wjmt_nPWwlE65C4nPh1noA\n\n![封面](https://i2.hdslb.com/bfs/archive/3727a10fecc4ce5a2304a0fa67ce30fb87a1ecf5.jpg)\n\n🔗 观看：[DeepSeek 公布最新 API 峰谷计费规则；…"
   },
   {
    "platform": "B站",
    "title": "智谱 ZCode 被指可能打包上传工作区文件；Claude Code 支持 AGENTS.md  【AI 早报 2026-09-19】",
    "url": "https://www.bilibili.com/video/BV1N3eX6LEQY",
    "author": "橘鸦Juya",
    "date": "2026-09-19 09:42:02",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "相关链接和文字版请看：https://mp.weixin.qq.com/s/0NCR6yzUnCRTkaBWFNSJFg\n\n![封面](https://i2.hdslb.com/bfs/archive/34c81846ee193af7f6d47cb8bba5f3e9d989b598.jpg)\n\n🔗 观看：[智谱 ZCode 被指可能打包上传工作区文件；Cl…"
   },
   {
    "platform": "B站",
    "title": "Claude Code 重构 Projects 功能，支持协调并行云端线程【AI 早报 2026-09-18】",
    "url": "https://www.bilibili.com/video/BV1cNey67ENm",
    "author": "橘鸦Juya",
    "date": "2026-09-18 09:38:15",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "文字版和相关链接请看：https://mp.weixin.qq.com/s/gKInOFaUvMDI5lDDIAzpZA\n\n![封面](https://i0.hdslb.com/bfs/archive/98bb6f521881e77f6dbd1c78702c89b2632bdb88.jpg)\n\n🔗 观看：[Claude Code 重构 Projects 功…"
   },
   {
    "platform": "B站",
    "title": "OpenRouter 与 OpenCode 上线免费“stealth”模型 Union Alpha【AI 早报 2026-09-17】",
    "url": "https://www.bilibili.com/video/BV1kaeK65EQU",
    "author": "橘鸦Juya",
    "date": "2026-09-17 09:17:54",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "![封面](https://i0.hdslb.com/bfs/archive/1f8ded703893f6d56a4e8c706c45894dc776da6a.jpg)\n\n🔗 观看：[OpenRouter 与 OpenCode 上线免费“stealth”模型 Union Alpha【AI 早报 2026-09-17】](https://www.bilibi…"
   },
   {
    "platform": "B站",
    "title": "Sam Altman 预告 OpenAI 本周将有重大发布【AI 早报 2026-09-16】",
    "url": "https://www.bilibili.com/video/BV1mZes6uEYu",
    "author": "橘鸦Juya",
    "date": "2026-09-16 09:20:09",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "文字版和相关链接请看：https://mp.weixin.qq.com/s/Gvn5rOumzFoF9X30z-mmAA\n\n![封面](https://i1.hdslb.com/bfs/archive/5a7c29b162111c58a6b040a4cb0e1173a2ba42ee.jpg)\n\n🔗 观看：[Sam Altman 预告 OpenAI 本周将有…"
   },
   {
    "platform": "B站",
    "title": "豆包手机助手消费者版发布；苹果发布新一代 Apple Intelligence，重构 Siri AI【AI 早报 2026-09-15】",
    "url": "https://www.bilibili.com/video/BV1Sqej6DEqV",
    "author": "橘鸦Juya",
    "date": "2026-09-15 09:36:36",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "相关链接和文字版请看：https://mp.weixin.qq.com/s/fzK6ZP-5LgueBA9T88DmwQ\n\n![封面](https://i2.hdslb.com/bfs/archive/b2881766f5935a3125ae4fe1b63b801e9a9f3539.jpg)\n\n🔗 观看：[豆包手机助手消费者版发布；苹果发布新一代 Appl…"
   },
   {
    "platform": "B站",
    "title": "智谱敲定约50亿美元融资，开发下一代GLM基础模型【AI 早报 2026-09-14】",
    "url": "https://www.bilibili.com/video/BV1ATYk65Edz",
    "author": "橘鸦Juya",
    "date": "2026-09-14 08:44:19",
    "fetchedAt": "2026-09-22 20:39:39",
    "read": true,
    "state": "skipped",
    "body": "相关链接和文字版请看：https://mp.weixin.qq.com/s/-DJKst1a4wmigUl5ph9C7w\n\n![封面](https://i2.hdslb.com/bfs/archive/f5c62a9e571835a54b38da4a3faf51517920909e.jpg)\n\n🔗 观看：[智谱敲定约50亿美元融资，开发下一代GLM基础模型…"
   },
   {
    "platform": "果壳科学人",
    "title": "“把白砂糖还给我们”，果葡糖浆比白砂糖坏多少？",
    "url": "https://www.guokr.com/article/470293",
    "author": "果壳",
    "date": "2026-09-22 22:15:05",
    "fetchedAt": "2026-09-22 14:21:31",
    "read": false,
    "body": "不知道从哪天起，总在饮料配料表里排第二位的白砂糖，被果葡糖浆悄悄替换掉了。\n\n大家发现之后，将话题“**把配料表中的白砂糖还给我们”顶上了热搜。评论区群情激愤，有人说果葡糖浆是工业糖，不如天然的白砂糖；还有人说果葡糖浆伤肝、伤肾、升尿酸和抑制钙吸收等等。**\n\n关注配料表是好事，但给果葡糖浆判死罪，又转头把白砂糖当健康，完全是批判错了方向。**很多人排斥果葡…"
   },
   {
    "platform": "果壳科学人",
    "title": "阿里发布真武V900 AI芯片；Grok4.7发布；5大国产手机品牌接入中国地震预警网",
    "url": "https://www.guokr.com/article/470294",
    "author": "果壳",
    "date": "2026-09-22 23:15:02",
    "fetchedAt": "2026-09-22 23:20:08",
    "read": false,
    "body": "今天是9月22日，星期二。1953年的今天，全球首座多层互通式立交洛杉矶四叶立交桥正式启用，实现了全方向无信号灯通行。\n\n![](https://3-im.guokr.com/RnQ0Y0xXQzZ1RnREOTBWV3NmX1VpTGxKbUtJQWRvY3hhAQAAPgEAAEdJ.gif)重点新闻速览\n\n1.5大国产手机品牌接入中国地震预警网\n\n2.…"
   }
  ],
  "stats": {
   "totalRead": 748,
   "totalSaved": 26,
   "totalSkipped": 725,
   "byPlatform": {
    "果壳": 76,
    "知乎日报": 175,
    "果壳科学人": 296,
    "知乎热榜": 94,
    "B站": 86,
    "橘鸦AI早报": 21
   },
   "byDate": {
    "2026-07-27": 31,
    "2026-07-29": 71,
    "2026-07-30": 120,
    "2026-07-31": 31,
    "2026-08-01": 17,
    "2026-08-04": 10,
    "2026-08-05": 4,
    "2026-08-06": 19,
    "2026-08-07": 8,
    "2026-08-08": 10,
    "2026-08-09": 8,
    "2026-08-10": 5,
    "2026-08-11": 6,
    "2026-08-12": 8,
    "2026-08-14": 19,
    "2026-08-15": 9,
    "2026-08-16": 6,
    "2026-08-17": 6,
    "2026-08-18": 7,
    "2026-08-19": 3,
    "2026-08-20": 16,
    "2026-08-21": 10,
    "2026-08-22": 9,
    "2026-08-23": 4,
    "2026-08-24": 4,
    "2026-08-27": 1,
    "2026-08-28": 14,
    "2026-08-29": 54,
    "2026-08-30": 6,
    "2026-08-31": 14,
    "2026-09-03": 2,
    "2026-09-06": 1,
    "2026-09-08": 6,
    "2026-09-09": 7,
    "2026-09-10": 79,
    "2026-09-11": 17,
    "2026-09-12": 3,
    "2026-09-13": 5,
    "2026-09-14": 3,
    "2026-09-15": 7,
    "2026-09-16": 26,
    "2026-09-17": 1,
    "2026-09-18": 10,
    "2026-09-19": 10,
    "2026-09-20": 15,
    "2026-09-21": 2,
    "2026-09-22": 24
   }
  },
  "upInfo": {
   "946974": {
    "name": "影视飓风",
    "avatar": "https://i0.hdslb.com/bfs/face/c1733474892caa45952b2c09a89323157df7129a.jpg"
   },
   "407054668": {
    "name": "亿点点不一样",
    "avatar": "https://i1.hdslb.com/bfs/face/9a2c23800387d9c871f3b5dd3620dc1c3c50d2f9.jpg"
   }
  }
 },
 "SIDECAR": {
  "articleOverrides": {
   "url:https://www.guokr.com/article/470078": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792286": {
    "reading": true
   },
   "url:https://www.bilibili.com/video/BV1gqgp6kE2Q": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470127": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470126": {
    "reading": true
   },
   "url:https://www.bilibili.com/video/BV12TgV63ESW": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470124": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470125": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792350": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792352": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792367": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792357": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470123": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470122": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470120": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470119": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470116": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470114": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792338": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792363": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470110": {
    "reading": true
   },
   "url:https://www.guokr.com/article/470109": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792375": {
    "reading": true
   },
   "url:https://daily.zhihu.com/story/9792385": {
    "reading": true
   }
  },
  "savedArchive": [],
  "order": [],
  "marks": {
   "url:https://www.guokr.com/article/470275": [
    {
     "find": "沉香",
     "notePath": "文献盒/沉香.md",
     "kind": "term"
    }
   ]
  },
  "readLog": [
   {
    "key": "url:https://daily.juya.uk/issues/2026-09-17/",
    "title": "2026-09-17 · 橘鸦AI早报",
    "src": "橘鸦AI早报",
    "minutes": 2,
    "ts": 1789672766709
   },
   {
    "key": "url:https://daily.juya.uk/issues/2026-09-17/",
    "title": "2026-09-17 · 橘鸦AI早报",
    "src": "橘鸦AI早报",
    "minutes": 12,
    "ts": 1789673495879
   },
   {
    "key": "url:https://daily.juya.uk/issues/2026-09-18/",
    "title": "2026-09-18 · 橘鸦AI早报",
    "src": "橘鸦AI早报",
    "minutes": 2,
    "ts": 1789704011530
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792619",
    "title": "为什么武侠游戏招式名爱用「降龙十八掌」式的华丽辞藻,而西方中世纪骑士游戏招式却朴素得像说明书?",
    "src": "知乎日报",
    "minutes": 1,
    "ts": 1789704090159
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792602",
    "title": "《龙餐馆》中，徐福的厨艺到底什么水平？",
    "src": "知乎日报",
    "minutes": 2,
    "ts": 1789704326609
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792603",
    "title": "什么科学发现起初看似无用，但后来证明非常重要？",
    "src": "知乎日报",
    "minutes": 1,
    "ts": 1789704395085
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792611",
    "title": "计算机领域中有什么高大上的术语其实描述的是很简单的事物？",
    "src": "知乎日报",
    "minutes": 2,
    "ts": 1789704515644
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792650",
    "title": "如果文言文退出中国教育体系，你是支持还是反对？为什么?",
    "src": "知乎日报",
    "minutes": 63,
    "ts": 1789791296526
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792651",
    "title": "有哪些外行人看来很蠢的设计实际上却是精妙无比？",
    "src": "知乎日报",
    "minutes": 2,
    "ts": 1789791429756
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792645",
    "title": "2026 搞笑诺贝尔奖来了，「蟑螂奶」获化学奖，其能量据称是牛奶 4 倍，还有哪些看点？",
    "src": "知乎日报",
    "minutes": 2,
    "ts": 1789791568405
   },
   {
    "key": "url:https://www.guokr.com/article/470263",
    "title": "AI 碾碎了书，就像碾碎你的脑子那样",
    "src": "果壳科学人",
    "minutes": 3,
    "ts": 1789791774799
   },
   {
    "key": "url:https://www.guokr.com/article/470260",
    "title": "DLSS 5 把显卡干趴下了，英伟达却觉得这很重要",
    "src": "果壳科学人",
    "minutes": 4,
    "ts": 1789792024140
   },
   {
    "key": "url:https://www.guokr.com/article/470264",
    "title": "地球Online更新了！加入猫猫一只",
    "src": "果壳科学人",
    "minutes": 24,
    "ts": 1789828273610
   },
   {
    "key": "url:https://www.guokr.com/article/470251",
    "title": "史上最擅长自虐的“人形小白鼠”，靠狂吸毒气拯救了无数人的生命",
    "src": "果壳科学人",
    "minutes": 3,
    "ts": 1789845613605
   },
   {
    "key": "url:https://daily.juya.uk/issues/2026-09-20/",
    "title": "2026-09-20 · 橘鸦AI早报",
    "src": "橘鸦AI早报",
    "minutes": 3,
    "ts": 1789881657570
   },
   {
    "key": "url:https://www.guokr.com/article/470268",
    "title": "玩拼豆玩得喉咙痛、头晕，是甲醛中毒吗？",
    "src": "果壳科学人",
    "minutes": 1,
    "ts": 1789881773214
   },
   {
    "key": "url:https://daily.zhihu.com/story/9792697",
    "title": "为什么近代西方推理小说在设计军人形象时总喜欢把军衔设定为上校?",
    "src": "知乎日报",
    "minutes": 3,
    "ts": 1789997572062
   },
   {
    "key": "url:https://www.guokr.com/article/470275",
    "title": "一块烂木头，凭什么上中国人“上头”上千年？",
    "src": "果壳科学人",
    "minutes": 29,
    "ts": 1789999308072
   }
  ]
 },
 "NOTES": [
  {
   "path": "归档/网页剪藏/AI生成内容强制水印引发用户反感与绕过潮.md",
   "md": "---\nurl: \"https://www.guokr.com/article/470065\"\nauthor: \"果壳\"\nsite: \"果壳科学人\"\nsummary: \"Anthropic宣布为所有AI生成产物添加隐形水印，包括文本和图片，以应对欧盟《人工智能法案》于8月2日生效的第50条要求。此举引发用户强烈不满，许多人认为水印会误伤人类劳动成果，并担心检测器误报导致客户质疑代码版权。GitHub上迅速出\"\ntags:\ndate: \"2026-08-29 04:15:05\"\ncreated: 2026-08-29 16:26:13\n---\n\nAnthropic干了一件让全体用户暴躁的事。\n\n8月中旬，他们宣布要给所有的生成产物都打上水印，包括文本和图片。这种水印对人类来说隐形，却能被检测器读出来。\n"
  },
  {
   "path": "归档/网页剪藏/AI时代知识贬值，人类应转向决断者.md",
   "md": "---\nurl: \"https://daily.zhihu.com/story/9791758\"\nauthor: \"\"\nsite: \"知乎日报\"\nsummary: \"文章以1610年克雷莫尼尼拒绝使用望远镜观察天体为例，类比当代人面对AI生成内容时的防御心理。AI不仅取代体力劳动，更侵入逻辑综合与模式识别等高级脑力活动，使传统知识体系面临崩塌。科举废止后读书人的困境与今日知识分子的处境相似，旧知识的价值\"\ntags:\ndate: \"2026-08-08 00:00:00\"\ncreated: 2026-08-08 02:39:37\n---\n\n李文卓宇，晓古今之变，明盛衰之理，察天人之序\n\n1610 年的秋天，帕多瓦大学的自然哲学教授切萨雷·克雷莫尼尼（Cesare Cremonini）做出了他一生中最著名、也最常被后世嘲笑的一个决定。\n"
  },
  {
   "path": "归档/网页剪藏/Claude Code完整配置指南，涵盖技能钩子子代理与MCP.md",
   "md": "---\nurl: \"https://github.com/affaan-m/ECC/blob/main/the-shortform-guide.md\"\nauthor: \"affaan-m\"\nsite: \"GitHub\"\nsummary: \"关于 Claude Code 的配置与使用技巧，核心内容包括：技能和命令是主要工作流，技能优于传统命令；钩子用于基于事件的自动化，如格式化与提醒；子代理可将任务委派给具有限定权限的独立进程；规则和记忆通过 .md 文件确保编码最佳实践；MC\"\ntags:\ndate: \"\"\ncreated: 2026-07-27 18:01:44\n---\n\n## The Shorthand Guide to Everything Claude Code\n\n![[c5de9d1c9d6a98771054e8bc5eab3cf3_MD5.png]]](<https://github.com/affaan-m/ECC/blob/main/assets/images/shortform/00-header.png>)\n"
  },
  {
   "path": "归档/网页剪藏/AI智能体下架急哭了多少豆包恋人.md",
   "md": "---\nurl: \"https://mp.weixin.qq.com/s\"\nauthor: \"跳海大院\"\nsite: \"微信公众号\"\nsummary: \"豆包平台将于7月15日根据《人工智能拟人化互动服务管理暂行办法》下线AI智能体功能，导致使用该功能进行情感陪伴的用户面临数据清空和情感中断。用户表示难以迁移至其他平台，因为豆包免费且语音功能优秀，不同AI模型会影响交互的“灵魂”感受。该功能\"\ntags:\ndate: \"\"\ncreated: 2026-07-21 19:48:10\n---\n\n我是院办小拳石，发现这阵子除了某乙游玩家，另一批人也在哭——TA们就是“豆包恋人”们。  \n  \n现在和AI谈恋爱已然不算新鲜。而豆包恋人，就是用豆包里的“AI智能体”功能，自己设定AI人物性格，背景信息，声线等等，由此和AI进行对话语音聊天。  \n   \n可前几天豆包发布…\n"
  },
  {
   "path": "归档/网页剪藏/ChatGPT对手Claude 2发布新版本，代码和GRE成绩超越GPT-4，使用体验如何.md",
   "md": "---\nurl: \"https://www.zhihu.com/question/612039506/answer/3119009416\"\nauthor: \"平凡\"\nsite: \"知乎\"\nsummary: \"Claude 2与ChatGPT各有优劣，目前没有模型能同时满足高性能、低收费和长文本处理。Claude 2免费且支持10万token输入，擅长处理大文本，但输出稳定、创造性较低，无互联网连接可能提供错误信息。ChatGPT的GPT-4性能\"\ntags:\ndate: \"\"\ncreated: 2026-07-21 19:26:31\n---\n\n[ChatGPT 对手 Claude 2 发布新版本，代码、GRE 成绩超越 GPT-4，使用体验如何？](https://www.zhihu.com/answer/3119009416)\n\n我先来总结一下我的观点：Claude和ChatGPT目前是各有长短的状态，其实即使是大家关注很少的Google Bard其实都有它的过人之处。\n"
  },
  {
   "path": "归档/网页剪藏/37岁歌手因黑色素瘤去世，什么样的痣可能会癌变.md",
   "md": "---\nurl: \"https://guokrapp.guokr.com/article/161878\"\nauthor: \"见文末\"\nsite: \"果壳\"\nsummary: \"黑色素瘤是一种来源于黑素细胞的恶性肿瘤，病死率高；约三分之一的皮肤黑色素瘤由已有的痣发展而来；位于手掌、脚掌等易摩擦部位的痣癌变风险更高；防晒、避免用药水点痣可降低风险；ABCDE评估法可用于早期识别；靶向药物和免疫疗法已显著改善治疗前景。\"\ntags:\ndate: \"\"\ncreated: 2026-07-21 19:00:00\n---\n\n据媒体消息称，《中国好声音》第二季亚军张恒远因病去世，年仅37岁，而夺去他生命的疾病叫“黑色素瘤”。\n\n![[f404d8b49ebf6e7fc303bf36d5f9d4cd_MD5.png]]\n"
  },
  {
   "path": "归档/网页剪藏/2025年诺贝尔物理学奖授予宏观量子隧穿与能量量子化发现.md",
   "md": "---\nurl: \"https://www.guokr.com/article/467635/\"\nauthor: \"果壳翻译班\"\nsite: \"果壳\"\nsummary: \"2025年诺贝尔物理学奖授予约翰·克拉克、米歇尔·德沃雷和约翰·马丁尼斯，表彰他们在电路中发现宏观量子隧穿与能量量子化。他们利用超导电路中的约瑟夫森结，让包含数十亿库珀对的宏观体系表现出量子隧穿和能级跃迁，使量子力学现象在厘米级电路中得以验\"\ntags:\ndate: \"\"\ncreated: 2026-07-21 18:45:07\n---\n\n2506字  \n需用时 05:00\n\n一句话说清物理诺奖：人类首次在宏观世界看到“子弹穿墙”\n"
  },
  {
   "path": "归档/网页剪藏/1983年拜福德海豚事故，一次误操作如何引发潜水史上最惨烈灾难.md",
   "md": "---\nurl: \"https://guokrapp.guokr.com/article/170749\"\nauthor: \"窗敲雨\"\nsite: \"果壳\"\nsummary: \"1983年11月5日，海上钻井平台“拜福德海豚”发生严重潜水事故。工作人员克拉蒙德因疲劳误操作，在舱门未关闭时过早松开固定装置，导致高压舱瞬间失压。一名潜水员被高压空气从60厘米舱门撕碎，内脏飞溅。其余三人因急剧减压病死亡，血液如沸腾般冒出\"\ntags:\ndate: \"\"\ncreated: 2026-07-21 18:40:06\n---\n\n1983年11月5日凌晨四点，在海上钻井平台“拜福德海豚”上，潜水辅助人员威廉·克拉蒙德（William Crammond）犯下了人生最致命的错误。\n\n只因为不小心松开了一处固定装置，克拉蒙德被像炮弹一般飞出的潜水钟击中，当场丧命。\n"
  }
 ]
};
