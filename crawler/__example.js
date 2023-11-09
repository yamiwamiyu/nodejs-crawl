const { getBrowser, pageCrawl, writeCSVLines, xhrCrawl } = require('../index');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 示例1: 翻页从接口获取数据
exports.example1 = async () => {
  // 翻页后确认已经获取到了数据则可以继续翻页
  let turning;
  // 爬取的所有数据
  const datas = [];
  let browser = await getBrowser();
  const page = await browser.newPage();
  page.on("response", async (r) => {
    if (r.request().resourceType() != "xhr")
      return;
    // todo: 根据url找到接口
    if (r.url().indexOf("") < 0)
      return;
    // todo: 获取数据
    const data = await r.json();
    // todo: 将获取到的数组数据存起来
    datas.push(...data);
    console.log("正在拉取数据", datas.length, "条");
    // 通知可以翻页
    turning();
  });
  // todo: 去到你要的网页
  page.goto("", { timeout: 0 });
  while (true) {
    // 等待获取数据
    await new Promise(resolve => turning = resolve);
    // 翻页 | 结束
    const over = await page.evaluate(() => {
      // todo: 获取下一页按钮
      const button = document.querySelectorAll('.next-button');
      // 不能翻页则结束
      if (!button || button.disabled)
        return true;
      else
        // 点击翻页
        button.click();
    })
    // 不能下一页，结束爬行
    if (over)
      break;
  }

  // 拉取完毕，将数据写入文件
  const file = __filename.substring(0, __filename.indexOf('.'));
  console.log("拉取数据完成! 保存数据文件 -> '" + file + ".json'");
  fs.writeFileSync(file + ".json", JSON.stringify(datas));

  await browser.close();
}

// 实例2: 翻页从页面获取数据
exports.example2 = async () => {
  // 爬取的所有数据
  const datas = [];
  let browser = await getBrowser();
  const page = await browser.newPage();
  // todo: 去到你要的网页
  page.goto("", { timeout: 0 });
  while (true) {
    // todo: 等待页面展示数据
    await page.waitForSelector(".all-datas", { timeout: 0 });

    // 从页面获取数据
    const data = await page.evaluate(() => {
      // todo: 获取数据标签列表
      var items = document.querySelectorAll(".all-datas");
      const data = [];
      for (const item of items) {
        // todo: 从DOM元素获取一条数据
        data.push({
          key1: item.querySelector('.data1').innerText,
          key2: item.querySelector('.data2').dataset.src,
          key3: item.querySelector('.data3').attributes.src,
        })
      }
      return data;
    })
    datas.push(...data);
    console.log("正在拉取数据", datas.length, "条");

    // 翻页 | 结束
    const over = await page.evaluate(() => {
      // todo: 获取下一页按钮
      const button = document.querySelectorAll('.next-button');
      // 不能翻页则结束
      if (!button || button.disabled)
        return true;
      else
        // 点击翻页
        button.click();
    })
    // 不能下一页，结束爬行
    if (over)
      break;
  }

  // 拉取完毕，将数据写入文件
  const file = __filename.substring(0, __filename.indexOf('.'));
  console.log("拉取数据完成! 保存数据文件 -> '" + file + ".json'");
  fs.writeFileSync(file + ".json", JSON.stringify(datas));

  await browser.close();
}

// 示例3: 直接发接口获取数据
exports.example3 = async (config) => {
  // 循环构建每页的接口参数
  const datas = [];
  for (let i = 1; i <= 2; i++) {
    datas.push({
      service_id: 'lgc_service_18',
      brand_id: 'lgc_game_2299',
      sort: 'most_recent',
      page: i,
      page_size: 48,
      currency: 'CNY',
      country: 'CN',
    })
  }
  // 发起接口拉取数据
  await xhrCrawl({
    // 接口并发的数量，默认4
    queue: 4,
    // GET或POST，默认GET
    method: "GET",
    // HTTP请求头
    headers: {
      header1: "value1",
      header2: "value2",
    },
    // * 需要采集的每页的接口参数
    datas: datas,

    // 以下参数均和 pageCrawl 方法的参数一致

    // * 接口地址
    url: "https://sls.g2g.com/offer/search",
    // * 请根据接口返回的json数据，返回最终的数据数组
    json: (i) => i.payload.results,
    // 每采集到一页数据时回调
    ondata: (data, param) => {
      console.log("当前接口参数", param, "采集到了数据", data.length, "条");
    },
    // * 采集的数据输出的文件名，不配置会不输出文件
    output: __filename,
    // 输出.csv文件，不配置默认输出.json文件
    csv: true,
  });
}

// 示例4: 使用封装好的翻页爬虫
exports.example4 = async () => {
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
      console.log("当前页", url, "采集到了数据", data.length, "条");
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
}

// 示例5: 一边拉取数据一边保存，下次从上次拉取到的位置继续
exports.example5 = async () => {
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
}

// 测试
// require('./www.g2g.com');
// require('./futcoin.net');
// exports.example3();

// 下载css里的图片文件
// axios.get("https://cdn.jsdelivr.net/gh/lipis/flag-icons@6.6.6/css/flag-icons.min.css").then(ret => {
//   ret = ret.data;
//   const sign = 'background-image:url(../';
//   let index = 0;
//   let index2 = 0;
//   while (true) {
//     index = ret.indexOf(sign, index);
//     if (index == -1)
//       break;
//     index2 = ret.indexOf(')', index);
//     const svg = ret.substring(index + sign.length, index2);
//     const file = path.resolve(__dirname, svg);
//     if (!fs.existsSync(file)) {
//       axios.get("https://cdn.jsdelivr.net/gh/lipis/flag-icons@6.6.6/" + svg).then(ret => {
//         fs.writeFileSync(file, ret.data);
//         console.log("下载svg", svg);
//       })
//     }
//     index = index2;
//   }
// })

const futbin = require('./www.futbin.com');
futbin.crawl(futbin.versions.fc24mt);
