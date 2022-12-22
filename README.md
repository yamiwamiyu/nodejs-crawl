# nodejs-crawl

#### 介绍
使用puppeteer的网页数据爬虫

#### 可爱的爬虫
- 魔兽世界代练 https://www.g2g.com/categories/wow-boosting-service?sort=most_recent
- FIFA金币站评论 https://futcoin.net/en/reviews

#### 获取爬虫
1. 获取已有爬虫可关注git源码库
- https://gitee.com/yamiwamiyu/nodejs-crawl
- https://github.com/yamiwamiyu/nodejs-crawl

2. 定制爬虫和学习，可联系作者
- QQ: 359602182
- 微信: yamiwamiyu

#### 安装教程

```
npm i @yamiwamiyu/nodejs-crawl
```

#### 使用和参数说明

```
const { pageCrawl } = require('@yamiwamiyu/nodejs-crawl');

pageCrawl({
    // 配置信息，'*' 开头表示必须


    // 浏览器相关设置 ↓

    // 使用你本地安装的浏览器进行操作
    chrome: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    // 在你已经打开的Chrome浏览器的某个页签里操作(开发时推荐使用)
    // 这需要你的浏览器开启远程调试功能，开启方法如下
    // 假如你是Windows系统，Chrome浏览器位于C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
    // - CMD: 打开控制台(Win + R, 输入cmd回车)，输入"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
    // - 快捷方式: 鼠标右键 -> 新建 -> 快捷方式，输入"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222，双击打开
    // - 代码开启：require('child_process').exec('"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222')
    port: 9222,
    // 不显示浏览器
    headless: true,


    // 采集器相关设置 ↓

    // * 采集的数据输出的文件名，不配置会不输出文件
    output: __filename,
    // 输出.csv文件，不配置默认输出.json文件
    csv: true,

    // * 采集数据的目标网站url，地址打开应该可以采集到数据的第一页
    url: "https://www.npmjs.com/package/@yamiwamiyu/nodejs-crawl",
    // * 翻页按钮的DOM元素selector，如果页面没有按钮或按钮禁用就会结束爬行
    // selector可参考教程https://www.runoob.com/cssref/css-selectors.html
    // 可以直接是字符串例如next: ".next-button-selector"
    // 可以是function(已经采集的页数)，返回空时可以结束爬行
    next: (pageCount) => {
      // 采集10页后结束
      if (pageCount == 10)
        return;
      return ".next-button-selector";
    },
    // 每采集到一页数据时回调
    ondata: (data, url) => {
      console.log("当前页", url, "采集到的数据", data);
    },

    // 接口采集 ↓ (接口必须是返回json格式数据，否则请简单修改源码部分)

    // * 接口的url，包含部分即可
    request: 'api/test?',
    // * 请根据接口返回的json数据，返回最终的数据数组
    // 例如数据格式为 { code: 0, msg: null, results: [{},{},{},{}] }
    json: (i) => i.results,

    // 页面采集 ↓
    // 等待数据渲染完成的关键DOM元素的selector
    wait: ".all-datas-selector",
    // * 从页面采集数据，JS的DOM操作，最终返回数据数组
    // 你应该到浏览器的调试工具控制台中先写好再粘贴到这里
    dom: () => {
      var data = [];
      var comments = document.querySelectorAll(".all-datas-selector");
      for (var c of comments) {
        data.push({
          'key1': c.querySelector(".value1").innerText,
          'key2': c.querySelector(".value2").dataset.id,
          'key3': c.querySelector(".value3").src,
        })
      }
      return data;
    },
  })
```

#### 实战使用示例

1.  通过接口获取数据

```
const { pageCrawl } = require('@yamiwamiyu/nodejs-crawl');

pageCrawl({
  output: __filename,
  // 接口地址
  request: "offer/search?",
  // json数据
  json: (i) => i.payload.results,
  url: "https://www.g2g.com/categories/wow-boosting-service?sort=most_recent",
  next: (i) => {
    // 测试只采集2页
    if (i == 2)
      return;
    return '.q-pagination>button:last-child';
  },
})
```

2.  通过页面获取数据
```
const { pageCrawl } = require('@yamiwamiyu/nodejs-crawl');

pageCrawl({
  output: __filename,
  url: "https://futcoin.net/en/reviews",
  // 等待页面渲染完成的关键DOM元素的selector
  wait: ".fc-comment .uk-first-column .uk-text-left",
  // 从页面采集数据
  dom: () => {
    var array = [];
    var comments = document.querySelectorAll(".fc-comment");
    for (var c of comments) {
      array.push({
        'user': c.querySelector(".uk-first-column .uk-text-left").innerText,
        'nation': ((i) => {
          var index = i.lastIndexOf('/') + 1;
          return i.substring(index, index + 2).toUpperCase();
        })(c.querySelector(".uk-first-column [data-uk-img]").dataset.src),
        'time': c.querySelector(".uk-first-column .uk-text-muted").innerText,
        'coin': ((i) => {
          return i = i.substring(1, i.indexOf(' ', 1)).replaceAll(',', '');
        })(c.querySelector(".uk-width-expand .uk-first-column").innerText),
        'platform': c.querySelector(".uk-width-expand .uk-text-nowrap").innerText,
        'star': c.querySelector(".fc-comment-rating").querySelectorAll(".fc-icon-star").length,
        'content': c.querySelector(".uk-card>.uk-text-left").innerText,
      })
    }
    return array;
  },
  next: (i) => {
    // 测试只采集2页
    if (i == 2)
      return;
    return '[data-uk-icon="arrow-right"]';
  },
  // 输出成csv
  csv: true,
})
```

3.  一边拉取数据一边保存，下次从上次拉取到的位置继续
```
const { pageCrawl, writeCSVLines } = require('@yamiwamiyu/nodejs-crawl');
const fs = require('fs');

const file = __dirname + "/data.csv"
// 没有数据文件则先创建数据文件
if (!fs.existsSync(file))
  fs.writeFileSync(file, "");
pageCrawl({
  // ... 其它参数设置

  // 不再对最终采集到的所有数据进行文件输出
  output: '',
  // 采集到一页数据后就追加到数据文件末尾
  ondata(data) {
    fs.appendFileSync(file, writeCSVLines(data));
  },
})

```