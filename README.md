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