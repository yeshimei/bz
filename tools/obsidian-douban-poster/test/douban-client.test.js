import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearchResults, parseSubjectMeta, parseCelebrities } from '../douban-client.js';

// 豆瓣搜索页 HTML 模拟（基于真实结构）
const SEARCH_HTML = `
<html><body>
<div class="result">
  <div class="pic">
    <a class="nbg" href="https://www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F1292052%2F&amp;query=test" title="The Shawshank Redemption"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p480747492.jpg"></a>
  </div>
  <div class="title"><a href="https://movie.douban.com/subject/1292052/">肖申克的救赎</a></div>
</div>
<div class="result">
  <div class="pic">
    <a class="nbg" href="https://www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F1292053%2F&amp;query=test" title="Shawshank Sequel"><img src="https://img3.doubanio.com/view/photo/s_ratio_poster/public/p123456789.jpg"></a>
  </div>
  <div class="title"><a href="https://movie.douban.com/subject/1292053/">肖申克的救赎：纪念版</a></div>
</div>
</body></html>
`;

const SEARCH_HTML_EMPTY = `<html><body><div class="search-result">没有找到</div></body></html>`;

// 豆瓣桌面版详情页 HTML 模拟（基于真实 id="info" 结构）
const MOVIE_HTML = `
<html><head>
<meta property="og:description" content="一场谋杀案使银行家安迪蒙冤入狱。肖申克监狱的首次现身就让监狱“大哥”瑞德另眼相看。"/>
</head><body>
<div class="rating_wrap clearbox">
  <strong class="rating_num" property="v:average">9.7</strong>
</div>
<div id="info">
  <span><span class='pl'>导演</span>: <span class='attrs'><a>弗兰克·德拉邦特</a></span></span><br/>
  <span><span class='pl'>编剧</span>: <span class='attrs'><a>弗兰克·德拉邦特</a> / <a>斯蒂芬·金</a></span></span><br/>
  <span><span class='pl'>主演</span>: <span class='attrs'><a>蒂姆·罗宾斯</a> / <a>摩根·弗里曼</a> / <a>鲍勃·冈顿</a> / <a>威廉·赛德勒</a> / <a>克兰西·布朗</a> / <a>吉尔·贝罗斯</a> / <a>马克·罗斯顿</a></span></span><br/>
  <span class="pl">类型:</span> <span property="v:genre">剧情</span> / <span property="v:genre">犯罪</span><br/>
  <span class="pl">制片国家/地区:</span> 美国<br/>
  <span class="pl">语言:</span> 英语<br/>
  <span class="pl">上映日期:</span> <span property="v:initialReleaseDate" content="2026(中国大陆)">2026(中国大陆)</span> / <span property="v:initialReleaseDate" content="1994-09-10(多伦多电影节)">1994-09-10(多伦多电影节)</span><br/>
  <span class="pl">片长:</span> <span property="v:runtime" content="142">142分钟</span><br/>
  <span class="pl">又名:</span> 月黑高飞(港) / 刺激1995(台)<br/>
  <span class="pl">IMDb:</span> tt0111161<br>
</div>
</body></html>
`;

// 电视剧页面：首播/单集片长 + 多地区
const TV_HTML = `
<html><head>
<meta property="og:description" content="《权力的游戏》是一部中世纪史诗奇幻题材的电视连续剧。"/>
</head><body>
<div class="rating_wrap clearbox">
  <strong class="ll rating_num" property="v:average">9.5</strong>
</div>
<div id="info">
  <span><span class='pl'>导演</span>: <span class='attrs'><a>蒂莫西·范·帕腾</a> / <a>布莱恩·柯克</a></span></span><br/>
  <span class="pl">类型:</span> <span property="v:genre">剧情</span> / <span property="v:genre">奇幻</span><br/>
  <span class="pl">制片国家/地区:</span> 美国 / 英国<br/>
  <span class="pl">语言:</span> 英语 / 多斯拉克语<br/>
  <span class="pl">首播:</span> 2011-04-17(美国)<br/>
  <span class="pl">单集片长:</span> 60分钟<br/>
  <span class="pl">又名:</span> 冰与火之歌：权力的游戏 第一季<br/>
  <span class="pl">IMDb:</span> tt0944947<br>
</div>
</body></html>
`;

describe('parseSearchResults', () => {
  it('解析搜索结果返回第一条详情页URL', () => {
    const results = parseSearchResults(SEARCH_HTML);
    assert.ok(results.length > 0);
    assert.equal(results[0].title, '肖申克的救赎');
    assert.ok(results[0].detailUrl.includes('1292052'));
  });

  it('搜索结果为空时返回空数组', () => {
    const results = parseSearchResults(SEARCH_HTML_EMPTY);
    assert.equal(results.length, 0);
  });

  it('解析多条结果', () => {
    const results = parseSearchResults(SEARCH_HTML);
    assert.ok(results.length >= 2);
  });
});

describe('parseSubjectMeta', () => {
  it('电影：解析全部字段', () => {
    const meta = parseSubjectMeta(MOVIE_HTML);
    assert.equal(meta.rating, '9.7');
    assert.equal(meta.directors, '弗兰克·德拉邦特');
    assert.equal(meta.writers, '弗兰克·德拉邦特 / 斯蒂芬·金');
    assert.equal(meta.casts, '蒂姆·罗宾斯 / 摩根·弗里曼 / 鲍勃·冈顿 / 威廉·赛德勒 / 克兰西·布朗 / 吉尔·贝罗斯');
    assert.equal(meta.genre, '剧情 / 犯罪');
    assert.equal(meta.region, '美国');
    assert.equal(meta.lang, '英语');
    assert.equal(meta.date, '1994-09-10');
    assert.equal(meta.runtime, '142分钟');
    assert.equal(meta.aka, '月黑高飞(港) / 刺激1995(台)');
    assert.equal(meta.imdb, 'tt0111161');
    assert.ok(meta.intro.includes('肖申克监狱'));
  });

  it('电视剧：首播/单集片长映射到 date/runtime', () => {
    const meta = parseSubjectMeta(TV_HTML);
    assert.equal(meta.rating, '9.5');
    assert.equal(meta.date, '2011-04-17');
    assert.equal(meta.runtime, '60分钟');
    assert.equal(meta.region, '美国 / 英国');
    assert.equal(meta.lang, '英语 / 多斯拉克语');
  });

  it('主演截取前6位', () => {
    const meta = parseSubjectMeta(MOVIE_HTML);
    assert.equal(meta.casts.split(' / ').length, 6);
  });

  it('无评分时 rating 为 null', () => {
    const meta = parseSubjectMeta('<html><body><div id="info"></div></body></html>');
    assert.equal(meta.rating, null);
    assert.equal(meta.region, '');
  });
});

describe('parseCelebrities', () => {
  it('解析导演和主演', () => {
    const data = {
      directors: [{ name: '韩杰' }],
      actors: [{ name: '王宝强' }, { name: '谭卓' }, { name: '何洁' }],
    };
    const c = parseCelebrities(data);
    assert.equal(c.directors, '韩杰');
    assert.equal(c.casts, '王宝强 / 谭卓 / 何洁');
  });

  it('无数据时返回空', () => {
    assert.deepEqual(parseCelebrities(null), { directors: '', writers: '', casts: '' });
  });
});
