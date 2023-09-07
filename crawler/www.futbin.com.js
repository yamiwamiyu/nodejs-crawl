const { pageCrawl, download } = require('../index');
const fs = require('fs');

const DIR = "crawler/fifa-23/";
if (!fs.existsSync(DIR))
  fs.mkdirSync(DIR, { recursive: true });
const RECORD = DIR + "_fifa-23.json";
/** 一种背景卡
 * @typedef {object} version
 * @property {number} id - 1 ~ 200
 * @property {string} version - 版本名，例如 gold | eoae_icon | futties 等
 * @property {string} hd - 高清卡图
 * @property {string} tiny - 小卡图
 * @property {string} color1 - 球员卡文字颜色
 * @property {string} color2 - 球员卡线条颜色
 * @property {string} color3 - 球员卡背景辉光颜色
 * @property {string} color4 - 球员卡国籍背景颜色
 * @property {string} color5 - 球员列表头像卡数值文字颜色
 * @property {string} color6 - 球员列表头像卡背景颜色
 */
/** 上次采集的存档，避免重复采集样式
 * @type {Record<string, version>}
 */
let previous = {};
if (fs.existsSync(RECORD))
  previous = JSON.parse(fs.readFileSync(RECORD));
/** 本次需要采集的内容
 * @type {version[]}
 */
const current = [];

/** 采集 fifa23 数据 */
exports.fifa23crawl = function () {
  pageCrawl({
    port: 9222,
    headless: true,
    url: "https://www.futbin.com/players",
    wait: ".modal-versions-row",
    /** @param {version} v */
    async dom(v) {
      // bug: 可能出现 404 的情况
      if (v) {
        // 鼠标 Hover 一个的球员以获取卡片的样式信息
        const element = document.querySelector("tr[data-url] a");
        // 可能出现一个球员都没有的情况（无法采集到样式信息）
        // 或者下载卡片背景失败（无法采集到卡片背景）
        if (!element || !v.hd || !v.tiny)
          return [v];
        const event = new MouseEvent('mouseenter', {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);

        // 等待球员卡显示出来
        await new Promise(r => {
          const timer = setInterval(() => {
            if (document.getElementById("Player-card")) {
              r();
              clearInterval(timer);
            }
          }, 200);
        })

        // 获取球员卡样式
        var dom = document.getElementById("Player-card");
        var style = getComputedStyle(dom);
        var _color = function (color) {
          color = color.substring(4, color.length - 1);
          var rgb = color.split(',');
          var r = parseInt(rgb[0]);
          var g = parseInt(rgb[1]);
          var b = parseInt(rgb[2]);
          return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        var color = _color(style['color']);

        // 线条颜色
        var bgcolor = getComputedStyle(document.getElementsByClassName("horz-line-bottom")[0])['background-color'];
        bgcolor = _color(bgcolor);

        // 辉光颜色
        var glcolor = style.filter;
        var glindex = glcolor.indexOf('rgba(') + 5;
        glcolor = glcolor.substring(glindex, glcolor.lastIndexOf(','));

        // 球员列表球员卡数值渐变色
        var e = $(".player_tr_1")[0].children[2].children[0]
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

        v.color1 = color;
        v.color2 = bgcolor;
        v.color3 = glcolor;
        v.color4 = getComputedStyle(dom.querySelector(".top-overlay")).backgroundImage;
        v.color5 = _color(style.color);
        v.color6 = bg;

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
    /** @param {version[]} versions */
    async ondata(versions) {
      if (current.length) {
        const v = versions[0];
        if (v.color1) {
          // todo: 成功
          previous[v.version] = v;
          console.log("新卡片类型：", v.version);
        }
        current.shift();
        if (!current.length) {
          exports.fifa23css();
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
          await download(v.tiny, DIR + "tiny_" + name);
          await download(v.hd, DIR + name);
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
        return "https://www.futbin.com/players?page=1&version=" + current[0].version;
      }
    }
  })
}

/** 将 fifa23 采集的数据生成 css */
exports.fifa23css = function () {
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
  const css =
    `
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
  const output = DIR + "_fifa-23.css";
  console.log("写入 css 样式：", output);
  fs.writeFileSync(output, css);
}