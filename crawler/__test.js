const { getBrowser, pageCrawl } = require('../index');
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
exports.example3 = async () => {

}

// 示例4: 在你已经打开的Chrome浏览器的某个页签里操作
// 这需要你的浏览器开启远程调试功能，开启方法如下
// 假如你是Windows系统，Chrome浏览器位于C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
// CMD: 打开控制台(Win + R, 输入cmd回车)，输入"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
// 快捷方式: 鼠标右键 -> 新建 -> 快捷方式，输入"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222，双击打开
// 代码开启：require('child_process').exec('"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222')
// 开启远程调试功能后，爬取代码稍作修改即可getBrowser({ port: 9222 });

// 示例5: 一边拉取数据一边保存，下次从上次拉取到的位置继续
exports.example5 = async () => {

}

// 其它操作3: 数据不保存成json而是保存成Excel数据表格(.csv文件)

// 测试
// require('./www.g2g.com');
// require('./futcoin.net');

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