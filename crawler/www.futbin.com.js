const { pageCrawl, download } = require('../index');
const fs = require('fs');
const path = require('path');

/** 一种背景卡
 * @typedef {object} card
 * @property {number} id - 1 ~ 200
 * @property {string} version - 版本名，例如 gold | eoae_icon | futties 等
 * @property {string} hd - 高清卡图
 * @property {string} tiny - 小卡图
 * @property {boolean} special - 球员卡头像是否是特殊的
 * @property {string} color1 - 球员卡文字颜色
 * @property {string} color2 - 球员卡线条颜色
 * @property {string} color3 - 球员卡背景辉光颜色
 * @property {string} color4 - 球员卡国籍背景颜色
 * @property {string} color5 - 球员列表头像卡数值文字颜色
 * @property {string} color6 - 球员列表头像卡背景颜色
 * @property {string} color7 - 球员卡副位置背景颜色
 * @property {string} color8 - 球员卡球风边框颜色
 */

/** fifa 版本
 * @typedef {object} version
 * @property {string} url - 采集的 url
 * @property {string} [name] - 版本名，用于输出 css 和 json 的文件名
 * @property {string} dir - 采集后数据保存的本地目录
 * @property {function(Record<string, card>):string} css - 根据采集的数据生成球员卡的 css 字符串
 */

/** 采集数据
 * @param {version} version - 版本
 */
exports.crawl = function (version) {
  const DIR = version.dir;
  if (!fs.existsSync(DIR))
    fs.mkdirSync(DIR, { recursive: true });
  const RECORD = DIR + getVersionName(version) + ".json";
  /** 上次采集的存档，避免重复采集样式
   * @type {Record<string, card>}
   */
  let previous = {};
  if (fs.existsSync(RECORD))
    previous = JSON.parse(fs.readFileSync(RECORD));
  /** 本次需要采集的内容
   * @type {card[]}
   */
  const current = [];
  pageCrawl({
    port: 9222,
    headless: true,
    url: version.url,
    wait: ".modal-versions-row .modal-version-col",
    /** @param {card} v */
    async dom(v) {
      // bug: 可能出现 404 的情况
      if (v) {
        // 鼠标 Hover 一个的球员以获取卡片的样式信息
        const element = document.querySelector("tr[data-url] a");
        // 可能出现一个球员都没有的情况（无法采集到样式信息）
        // 或者下载卡片背景失败（无法采集到卡片背景）
        if (!element || !v.hd || !v.tiny)
          return [v];

        var _color = function (color) {
          color = color.substring(4, color.length - 1);
          var rgb = color.split(',');
          var r = parseInt(rgb[0]);
          var g = parseInt(rgb[1]);
          var b = parseInt(rgb[2]);
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        // 球员列表球员卡数值渐变色
        var e = $(".player_tr_1")[0].children[2].children[0];
        var split = e.className.split(' ');
        var c = [];
        for (var i = split.length - 1; i >= 0 && c.length < 3; i--) {
          if (!split[i]) continue;
          c.unshift(split[i]);
        }
        var style = getComputedStyle(e);
        var bg = style.backgroundImage;
        while (true) {
          var index = bg.indexOf("rgb(");
          if (index == -1) break;
          var index2 = bg.indexOf(")", index) + 1;
          var rgb = bg.substring(index, index2);
          bg = bg.replace(rgb, _color(rgb));
        }

        v.color5 = _color(style.color);
        v.color6 = bg;

        // const event = new MouseEvent('mouseenter', {
        //   bubbles: true,
        //   cancelable: true,
        // });
        // element.dispatchEvent(event);

        // 打开一个球员详情页来采集数据
        // bug: URL 切换之后，puppeteer 的 page.evaluate 将失效无法继续执行后面代码
        // 解决方案：用 iframe 动态加载页面来采集数据
        // location.href = element.href;

        // 等待用于替换的 iframe 显示出来
        // await new Promise(r => {
        //   const timer = setInterval(() => {
        //     if (document.querySelector("#vmv3-frm")) {
        //       r();
        //       clearInterval(timer);
        //     }
        //   }, 200);
        // })

        const iframe = document.createElement('iframe');
        var dom = undefined;
        iframe.id = '_iframe';
        // 检查 iframe 是否已经加载完成
        iframe.addEventListener('load', function () {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          dom = iframeDoc.getElementById('Player-card');
        });
        iframe.src = element.href;
        // 网站会将添加的 iframe 全部替换掉，所以这里替换一个原本网站加载好的没被替换的 iframe
        document.querySelector("#vmv3-frm").replaceWith(iframe);

        // 等待球员卡显示出来
        await new Promise(r => {
          const timer = setInterval(() => {
            if (dom) {
              r();
              clearInterval(timer);
            }
          }, 200);
        })

        console.log('已经出现球员卡信息', dom)

        // 获取球员卡样式
        // var dom = document.getElementById("Player-card");
        var style = getComputedStyle(dom);

        // 球员卡头像是否特殊
        v.special = dom.querySelector('.pcdisplay-picture.special-img') ? true : undefined;

        var color = _color(style['color']);

        // 线条颜色
        var bgcolor = getComputedStyle(dom.getElementsByClassName("horz-line-bottom")[0])['background-color'];
        bgcolor = _color(bgcolor);

        // 辉光颜色
        var glcolor = style.filter;
        var glindex = glcolor.indexOf('rgba(') + 5;
        glcolor = glcolor.substring(glindex, glcolor.lastIndexOf(','));

        // todo: fc-24 副位置和球风暂时只能打开球员卡才能采集到

        // 副位置背景色
        var sub = dom.querySelector(".pcdisplay-alt-pos > div");
        if (sub)
          sub = _color(getComputedStyle(sub).backgroundColor);

        // 球风边框色
        var playstyle = dom.querySelector(".pcdisplay-playstyles > .playstyle-plus-border");
        if (playstyle)
          playstyle = _color(getComputedStyle(playstyle).backgroundColor);

        v.color1 = color;
        v.color2 = bgcolor;
        v.color3 = glcolor;
        v.color4 = getComputedStyle(dom.querySelector(".top-overlay")).backgroundImage;
        if (sub)
          v.color7 = sub;
        if (playstyle)
          v.color8 = playstyle;

        return [v];
      } else {
        const all = [];
        // 首次先采集所有 version 并下载卡图
        const versions = document.querySelectorAll(".modal-versions-row [data-value]");
        for (const item of versions) {
          const version = item.dataset.value;
          const tiny = item.querySelector('img').src;
          const hd = tiny.replace("tiny/", "hd/");
          const name = tiny.substring(tiny.lastIndexOf('/') + 1);
          const id = name.substring(0, name.indexOf('_'));
          all.push({ id, version, tiny, hd });
        }
        return all;
      }
    },
    /** @param {card[]} versions */
    async ondata(versions) {
      if (current.length) {
        const v = versions[0];
        if (v.color1) {
          // 成功
          previous[v.version] = v;
          console.log("新卡片类型：", v.version);
        }
        current.shift();
        if (!current.length) {
          exports.css(version, previous);
          fs.writeFileSync(RECORD, JSON.stringify(previous));
          return Object.values(previous);
        } else {
          // 每写入一个都存档
          fs.writeFileSync(RECORD, JSON.stringify(previous));
        }
      } else {
        for (const v of versions) {
          if (previous[v.version])
            continue;
          const name = v.tiny.substring(v.tiny.lastIndexOf('/') + 1);
          if (!current.length)
            console.log("正在下载卡牌图片...");
          await download(v.tiny, DIR + "tiny_" + name).catch(() => {});
          await download(v.hd, DIR + name).catch(() => { });
          current.push(v);
        }
        if (current.length) {
          console.log("新类型卡片", current);
        } else {
          console.log("没有新类型卡片");
        }
        versions.length = 0;
      }
    },
    next() {
      if (current.length) {
        this.pass = current[0];
        return version.url + "?page=1&version=" + current[0].version;
      }
    },
  })
}

/** 采集的数据生成 css
 * @param {version} version - 版本
 * @param {Record<string, card>} previous - 采集的数据
 */
exports.css = function (version, previous) {
  const name = getVersionName(version);
  if (!previous)
    previous = JSON.parse(fs.readFileSync(version.dir + name + ".json"));
  const output = version.dir + name + ".css";
  const css = version.css(previous);
  console.log("写入 css 样式：", output);
  fs.writeFileSync(output, css);
}

exports.versions = {
  /** @type {version} */
  fifa23: {
    url: "https://www.futbin.com/23/players",
    dir: "crawler/fifa-23/",
    css: function (previous) {
      const array = [];
      const result = Object.values(previous);
      result.sort((a, b) => a.id - b.id)
      for (const item of result) {
        array.push(
          `
.card_${item.id}_${item.version} {
  --bg: url(./${item.hd.substring(item.hd.lastIndexOf('/') + 1)});
  --line: ${item.color2};
  --mask: ${item.color4};
  color: ${item.color1};
}
.ut-item_tiny.card_${item.id}_${item.version} {
  --bg: url(./tiny_${item.hd.substring(item.hd.lastIndexOf('/') + 1)});
}
.rating_${item.id}_${item.version} {
  color: ${item.color5};
  background: ${item.color6};
}
`)
      }
      return `
@font-face {
  font-family: DINPro-Cond;
  src: url(https://cdn.futbin.com/design/css/fonts/DINPro/design/css/fonts/DINPro/DINPro-Cond.woff) format("truetype");
}

@font-face {
  font-family: DINPro-Cond-Med;
  src: url(https://cdn.futbin.com/design/css/fonts/DINPro/design/css/fonts/DINPro/DINPro-CondMedium.woff) format("truetype");
}

@font-face {
  font-family: DINPro-Cond-Bold;
  src: url(https://cdn.futbin.com/design/css/fonts/DINPro/design/css/fonts/DINPro/DINPro-CondBold.woff) format("truetype");
}

/* 一个球员最外层div，可通过font-size(建议)和transform:scale(字很小时使用)来控制大小 */
.ut-item {
  font-size: 1.5em;
  display: -ms-flexbox;
  display: flex;
  flex-direction: column;
  -ms-flex-wrap: wrap;
  flex-wrap: wrap;
  padding: 1em 1.4em 1.4em;
  position: relative;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 110% 105%;
  width: 8.27em;
  height: 11.55em;
  flex: none;
  transform-origin: left;
  transition: all .25s;

  --line: #645215;

  background-image: var(--bg);
}

.ut-item_glow {
  animation: ut-item_glow 3s infinite;
  --glow: 243, 146, 0;
}

@keyframes ut-item_glow {
  0%, 100% {
    filter: drop-shadow(1px -3px 15px rgba(var(--glow), .2));
  }
  50% {
    filter: drop-shadow(1px -3px 15px rgba(var(--glow), .8));
  }
}

/* 球员左上角 数值，位置，俱乐部，国家 信息 */
.ut-item_meta {
  -ms-flex-align: center;
  align-items: center;
  display: -ms-flexbox;
  display: flex;
  -ms-flex-direction: column;
  flex-direction: column;
  width: 1.375em;
  height: 4.35em;
  margin-top: 0.5em;
  margin-left: 0.25em;
  line-height: 0;
  position: relative;
}

/* 有些球员信息部分有个半透明条幅 */
.ut-item_mask {
  position: absolute;
  background: var(--mask);
  width: 100%;
  height: 180%;
  top: 0.25em;
}

/* 数值 */
.ut-item_rating {
  font-family: DINPro-Cond-Med;
  font-size: 1.04em;
  letter-spacing: -.55px;
  line-height: 1;
  font-weight: 700;
  position: relative;
}

/* 位置 */
.ut-item_position {
  font-family: DINPro-Cond;
  font-size: .5em;
  font-weight: 700;
  letter-spacing: -.35px;
  line-height: 1;
  margin-top: -.125em;
  position: relative;
}

/* 其它位置 */
.alt-pos {
  position: absolute;
  line-height: 1;
  transform: translateX(-100%) scale(.75);
  font-size: .5em;
  font-family: DINPro-Cond-Med;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}

.alt-pos > div {
  background-image: var(--bg);
  border-radius: 50%;
  background-size: 275px;
  background-position-y: -206px;
  background-position-x: -38px;
  width: 2em;
  height: 2em;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 俱乐部 */
.ut-item_crest {
  height: 1.125em;
  width: 1.125em;
  margin: auto;
  position: relative;
}

/* 国家 */
.ut-item_flag {
  margin: auto;
  width: 1.25em;
  position: relative;
  border-top: 2px solid var(--line);
  border-bottom: 2px solid var(--line);
  padding: 0.15em 0;
}

/* 球员头像 */
.ut-item_headshot {
  width: auto;
  height: 6.85em;
  object-fit: contain;
  max-width: 100%;
  position: absolute;
  bottom: 3.55em;
  right: 1em;
}

/* 球员头像半身像 */

/* 下方球员名 */
.ut-item_name {
  font-family: DINPro-Cond-Bold;
  font-size: .8em;
  letter-spacing: -.4px;
  text-indent: 0;
  transition: text-indent .5s ease;
  white-space: nowrap;
  word-break: break-all;
  text-align: center;
  text-transform: uppercase;
  width: 100%;
  height: fit-content;
  position: relative;
  font-weight: 400;
  margin-top: 0.3em;
  display: flex;
  justify-content: center;
}

/* 下方属性值 */
.ut-item_status {
  width: 100%;
  /* 上横线 */
  border-top: solid .08em var(--line);
  position: relative;
  line-height: 0;
  display: flex;
  flex-wrap: wrap;
}

/* 中竖线 */
.ut-item_status::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateX(-50%) translateY(-50%);
  width: 0.08em;
  height: 1.8em;
  background-color: var(--line);
}

/* 下横线 */
.ut-item_status::after {
  content: '';
  position: absolute;
  bottom: -0.12em;
  left: 50%;
  transform: translateX(-50%);
  width: 1em;
  height: 0.08em;
  background-color: var(--line);
}

.ut-item_value {
  width: 45%;
  margin: 0.05em auto;
}

/* 属性值 */
.ut-item_attr {
  font-size: .67em;
  line-height: 1;
  font-family: DINPro-Cond-Bold;
  padding-left: 0.1em;
  font-weight: 700;
}

/* 属性标题 */
.ut-item_title {
  font-family: DINPro-Cond;
  font-size: .58em;
  line-height: 1;
}

/* 使用模板如下 */
/*
<div class="ut-item ut-item_glow card_153_shapeshifters_icon">
  <img class="ut-item_headshot" src="https://cdn.futbin.com/content/fifa23/img/players/p50568715.png?v=23">
  <div class="ut-item_meta">
    <div class="ut-item_mask"></div>
    <div class="alt-pos">
      <div>RM</div>
      <div>LM</div>
      <div>RW</div>
    </div>
    <span class="ut-item_rating">91</span>
    <span class="ut-item_position">LW</span>
    <img class="ut-item_flag" src="https://cdn.futbin.com/content/fifa23/img/nation/54.png">
    <img class="ut-item_crest" src="https://cdn.futbin.com/content/fifa23/img/clubs/112658.png">
  </div>
  <div class="ut-item_name">Pelé</div>
  <div class="ut-item_status">
    <div class="ut-item_value">
      <span class="ut-item_attr">96</span>
      <span class="ut-item_title">PAC</span>
    </div>

    <div class="ut-item_value">
      <span class="ut-item_attr">99</span>
      <span class="ut-item_title">DRI</span>
    </div>

    <div class="ut-item_value">
      <span class="ut-item_attr">97</span>
      <span class="ut-item_title">SHO</span>
    </div>

    <div class="ut-item_value">
      <span class="ut-item_attr">61</span>
      <span class="ut-item_title">DEF</span>
    </div>

    <div class="ut-item_value">
      <span class="ut-item_attr">94</span>
      <span class="ut-item_title">PAS</span>
    </div>

    <div class="ut-item_value">
      <span class="ut-item_attr">78</span>
      <span class="ut-item_title">PHY</span>
    </div>
  </div>
</div>
*/


/* 简单版，没有数值 */
.ut-item_tiny {
  background-size: 100%;
  height: 9.74em;
  padding-left: 1.2em;
  padding-right: 1.2em;
}

.ut-item_tiny .alt-pos {
  display: none;
}

.ut-item_tiny .ut-item_mask {
  height: 100%;
}

.ut-item_tiny .ut-item_meta {
  margin-top: .65em;
  font-size: 1.16em;
}

.ut-item_tiny .ut-item_name {
  margin: auto auto 0.1em;
  font-size: 1em;
}

.ut-item_tiny .ut-item_headshot {
  bottom: .9em;
}

.ut-item_tiny .ut-item_status {
  display: none;
}
${array.join('\r\n')}`;
    }
  },
  /** @type {version} */
  fc24: {
    url: "https://www.futbin.com/24/players",
    dir: "crawler/fc-24/",
    css: function (previous) {
      const array = [];
      const result = Object.values(previous);
      result.sort((a, b) => a.id - b.id)
      for (const item of result) {
        array.push(
          `
.card_${item.id}_${item.version} {
  --bg: url(./${item.hd.substring(item.hd.lastIndexOf('/') + 1)});
  --line: ${item.color2};
  --mask: ${item.color4};
  --sub: ${item.color7};
  --ps: ${item.color8};
  color: ${item.color1};
}
.ut-item_tiny.card_${item.id}_${item.version} {
  --bg: url(./tiny_${item.hd.substring(item.hd.lastIndexOf('/') + 1)});
}
.rating_${item.id}_${item.version} {
  color: ${item.color5};
  background: ${item.color6};
}
`)
      }
      return `
/* 球风图标 */
@font-face {
  font-family: 'Playstyles';
  src: url("https://cdn.futbin.com/design/img/icons/playstyles/24/font/fonts/playstyles.eot?#iefix") format("embedded-opentype"),url("https://cdn.futbin.com/design/img/icons/playstyles/24/font/fonts/playstyles.woff") format("woff"),url("https://cdn.futbin.com/design/img/icons/playstyles/24/font/fonts/playstyles.ttf") format("truetype"),url("https://cdn.futbin.com/design/img/icons/playstyles/24/font/fonts/playstyles.svg#Glyphter") format("svg");
  font-weight: normal;
  font-style: normal
}
[class*='fb-icon-']:before {
  display: inline-block;
  font-family: 'Playstyles';
  font-style: normal;
  font-weight: normal;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale
}
.fb-icon-ballcontrol-firsttouch:before { content: '\\0042' }
.fb-icon-ballcontrol-flair:before { content: '\\0043' }
.fb-icon-ballcontrol-pressproven:before { content: '\\0044' }
.fb-icon-ballcontrol-rapid:before { content: '\\0045' }
.fb-icon-ballcontrol-technical:before { content: '\\0046' }
.fb-icon-ballcontrol-trickster:before { content: '\\0047' }
.fb-icon-defending-anticipate:before { content: '\\0048' }
.fb-icon-defending-block:before { content: '\\0049' }
.fb-icon-defending-bruiser:before { content: '\\004a' }
.fb-icon-defending-intercept:before { content: '\\004b' }
.fb-icon-defending-jockey:before { content: '\\004c' }
.fb-icon-defending-slidetackle:before { content: '\\004d' }
.fb-icon-gk-crosscatcher:before { content: '\\004e' }
.fb-icon-gk-farreach:before { content: '\\004f' }
.fb-icon-gk-farthrow:before { content: '\\0050' }
.fb-icon-gk-footwork:before { content: '\\0051' }
.fb-icon-gk-quickreflexes:before { content: '\\0052' }
.fb-icon-gk-rushout:before { content: '\\0053' }
.fb-icon-passing-incisivepass:before { content: '\\0054' }
.fb-icon-passing-longballpass:before { content: '\\0055' }
.fb-icon-passing-pingedpass:before { content: '\\0056' }
.fb-icon-passing-tikitaka:before { content: '\\0057' }
.fb-icon-passing-whippedcrosser:before { content: '\\0058' }
.fb-icon-physical-acrobatic:before { content: '\\0059' }
.fb-icon-physical-aerial:before { content: '\\005a' }
.fb-icon-physical-longthrow:before { content: '\\0061' }
.fb-icon-physical-quickstep:before { content: '\\0062' }
.fb-icon-physical-relentless:before { content: '\\0063' }
.fb-icon-physical-trivela:before { content: '\\0064' }
.fb-icon-scoring-chipshot:before { content: '\\0065' }
.fb-icon-scoring-deadball:before { content: '\\0066' }
.fb-icon-scoring-finesseshot:before { content: '\\0067' }
.fb-icon-scoring-powerheader:before { content: '\\0068' }
.fb-icon-scoring-powershot:before { content: '\\0069' }
/* 总能力值 */
@font-face {
  font-family: Cruyff-Bold;
  src: url(https://cdn.futbin.com/design/css/fonts/cruyff/CruyffSans-Bold.ttf) format("truetype");
}
/* 位置 名字 属性值 */
@font-face {
  font-family: Cruyff-Medium;
  src: url(https://cdn.futbin.com/design/css/fonts/cruyff/CruyffSans-Medium.ttf) format("truetype");
}
/* 属性名 */
@font-face {
  font-family: Cruyff-Regular;
  src: url(https://cdn.futbin.com/design/css/fonts/cruyff/CruyffSans-Regular.ttf) format("truetype");
}

/* 一个球员最外层div，可通过font-size(建议)和transform:scale(字很小时使用)来控制大小 */
.ut-item {
  font-size: max(14px, 1em);
  display: inline-flex;
  flex-direction: column;
  -ms-flex-wrap: wrap;
  flex-wrap: wrap;
  position: relative;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 105%;
  width: 13.75em;
  height: 19.0625em;
  flex: none;
  transform-origin: left;
  transition: all .25s;
  background-image: var(--bg);
  font-family: Cruyff-Medium;
  line-height: 1;
}

.ut-item > *:not(.ut-item_headshot) {
  position: relative;
}

.ut-item_glow {
  animation: ut-item_glow 3s infinite;
  --glow: 243, 146, 0;
}

@keyframes ut-item_glow {
  0%, 100% {
    filter: drop-shadow(1px -3px 15px rgba(var(--glow), .2));
  }
  50% {
    filter: drop-shadow(1px -3px 15px rgba(var(--glow), .8));
  }
}

/* 球员左上角 数值，位置 */
.ut-item_meta {
  -ms-flex-align: center;
  align-items: center;
  display: -ms-flexbox;
  display: flex;
  -ms-flex-direction: column;
  flex-direction: column;
  width: 1.375em;
  height: 9.75em;
  margin-top: 2.5em;
  margin-left: 3em;
}

/* 数值 */
.ut-item_rating {
  font-family: Cruyff-Bold;
  font-size: 1.875em;
}

/* 位置 */
.ut-item_position {
  font-size: .875em;
}

/* 副位置 & 球风 */
.ut-item_left {
  position: absolute;
  left: -180%;
  top: 1.4em;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ut-item_left .alt-pos {
  font-size: .75em;
  font-family: Cruyff-Medium;
}

.ut-item_left .alt-pos > div {
  background-color: var(--sub);
  border-radius: 50%;
  width: 2.5em;
  height: 2.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: .15em
}

.ut-item_left .playstyle {
  position: absolute;
  top: 5.5em;
}

.ut-item_left .playstyle > div {
  background-color: var(--ps);
  clip-path: polygon(25% 0, 75% 0%, 100% 40%, 50% 100%, 0 40%);
  width: 1.875em;
  height: 1.875em;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: .15em;
}

.ut-item_left .playstyle > div:before {
  background-color: var(--sub);
  clip-path: polygon(25% 0, 75% 0%, 100% 40%, 50% 100%, 0 40%);
  font-size: 1.625em;
  margin-top: -1px;
}

/* 球员头像 */
.ut-item_headshot {
  position: absolute;
  width: 67%;
  left: 25%;
  top: 14.5%;
}

/* 例如英雄卡等超出边框的头像 */
.ut-item_headshot.special {
  width: 104.1%;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.ut-item_headshot.special.tiny {
  width: 80%;
}

/* 下方球员名 */
.ut-item_name {
  font-size: 1.375em;
  letter-spacing: -.2px;
  white-space: nowrap;
  text-align: center;
  max-width: 100%;
}

/* 下方属性值 */
.ut-item_status {
  display: flex;
  margin: 0 auto;
  gap: 0.25em;
}

.ut-item_status > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 属性值 */
.ut-item_status > div > span:last-child {
  font-size: 1em;
}

/* 属性标题 */
.ut-item_status > div > span:first-child {
  font-family: Cruyff-Regular;
  font-size: .75em;
}

/* 国旗 俱乐部 机构 */
.ut-item_ccl {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1em;
  gap: 0.25em;
}

.ut-item_ccl > img {
  height: auto;
  width: 1em;
  object-fit: contain;
}

/* 使用模板如下 */
/* 特殊大头像卡
<div class="ut-item ut-item_glow card_7300_ucl_hero">
  <img class="ut-item_headshot special" src="https://cdn.futbin.com/content/fifa24/img/players/p999503.png?v=23">
  <div class="ut-item_meta">
    <span class="ut-item_rating">91</span>
    <span class="ut-item_position">LW</span>
    <div class="ut-item_left">
      <div class="alt-pos">
        <div>RM</div>
        <div>LM</div>
      </div>
      <div class="playstyle">
        <div class="fb-icon-physical-acrobatic"></div>
      </div>
    </div>
  </div>
  <div class="ut-item_name">Pelé</div>
  <div class="ut-item_status">
    <div>
      <span>PAC</span>
      <span>96</span>
    </div>
    <div>
      <span>SHO</span>
      <span>97</span>
    </div>
    <div>
      <span>PAS</span>
      <span>94</span>
    </div>
    <div>
      <span>DRI</span>
      <span>99</span>
    </div>
    <div>
      <span>DEF</span>
      <span>61</span>
    </div>
    <div>
      <span>PHY</span>
      <span>78</span>
    </div>
  </div>
  <div class="ut-item_ccl">
    <img class="ut-item_flag" src="https://cdn.futbin.com/content/fifa24/img/nation/27.png">
    <img class="ut-item_club" src="https://cdn.futbin.com/content/fifa24/img/clubs/114605.png">
    <img class="ut-item_crest" src="https://cdn.futbin.com/content/fifa24/img/league/31.png">
  </div>
</div>

普通小头像卡
<div class="ut-item ut-item_glow card_1_gold">
  <img class="ut-item_headshot" src="https://cdn.futbin.com/content/fifa24/img/players/239085.png?v=23">
  <div class="ut-item_meta">
    <span class="ut-item_rating">91</span>
    <span class="ut-item_position">ST</span>
    <div class="ut-item_left">
      <div class="alt-pos">
        <div>CF</div>
      </div>
      <div class="playstyle">
        <div class="fb-icon-physical-acrobatic"></div>
        <div class="fb-icon-passing-incisivepass"></div>
      </div>
    </div>
  </div>
  <div class="ut-item_name">Haaland</div>
  <div class="ut-item_status">
    <div>
      <span>PAC</span>
      <span>96</span>
    </div>
    <div>
      <span>DRI</span>
      <span>99</span>
    </div>
    <div>
      <span>SHO</span>
      <span>97</span>
    </div>
    <div>
      <span>DEF</span>
      <span>61</span>
    </div>
    <div>
      <span>PAS</span>
      <span>94</span>
    </div>
    <div>
      <span>PHY</span>
      <span>78</span>
    </div>
  </div>
  <div class="ut-item_ccl">
    <img class="ut-item_flag" src="https://cdn.futbin.com/content/fifa24/img/nation/27.png">
    <img class="ut-item_club" src="https://cdn.futbin.com/content/fifa24/img/clubs/114605.png">
    <img class="ut-item_crest" src="https://cdn.futbin.com/content/fifa24/img/league/31.png">
  </div>
</div>
*/


/* 简单版，没有数值 */
.ut-item_tiny {
  background-size: 100%;
}

.ut-item_tiny .ut-item_meta {
  height: 8.5em;
  margin-top: 5em;
}

.ut-item_tiny .ut-item_headshot {
  top: 30%;
  width: 54%;
  left: 33%;
}

.ut-item_tiny .ut-item_headshot.special {
  top: 53%;
  width: 82%;
  left: 50%;
}

.ut-item_tiny .ut-item_status,
.ut-item_tiny .ut-item_left {
  display: none;
}

.ut-item_tiny .ut-item_ccl {
  position: absolute;
  top: 8em;
  left: 3em;
  flex-direction: column;
  height: auto;
}

.ut-item_tiny .ut-item_ccl > img {
  width: 1.5em;
}
${array.join('\r\n')}`;
    }
  },
}

/** @param {version} version */
function getVersionName(version) {
  return version.name || ('_' + path.basename(version.dir));
}