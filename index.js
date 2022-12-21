const fs = require('fs');
const axios = require('axios');
const { exit } = require('process');

exports.getBrowser = async function (config) {
  if (!config) config = {};
  let puppeteer = require('puppeteer-core');
  let browser;
  if (config.chrome) {
    browser = await puppeteer.launch({
      headless: config.headless,
      executablePath: config.chrome,
      defaultViewport: null
    })
    console.log("Open chrome success!");
  } else {
    let browserWSEndpoint;
    if (config.port) {
      browserWSEndpoint = await new Promise(resolve => {
        const url = "http://127.0.0.1:" + config.port + "/json/version";
        axios.get(url).then((ret) => {
          resolve(ret.data.webSocketDebuggerUrl);
        }).catch(err => {
          console.log("Can not connect chrome.", url);
          resolve(undefined);
        })
      })
    }
    if (browserWSEndpoint) {
      browser = await puppeteer.connect({ browserWSEndpoint, defaultViewport: null });
      // 不需要关闭chrome
      browser.close = () => { };
      console.log("Connect chrome success!");
    } else {
      puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: config.headless,
        defaultViewport: null
      });
      console.log("Open chromium success!");
    }
  }
  return browser;
}

function toCSVString(str) {
  if (!str) return undefined;
  str = str.toString();
  const special = str.indexOf('\r') > 0 || str.indexOf('\n') > 0 || str.indexOf('\"') > 0 || str.indexOf(',') > 0;
  if (special) {
    str = str.replaceAll("\"", "\"\"");
    str = str.replaceAll("\r\n", "\n");
    str = str.replaceAll("\r", "\n");
    return '"' + str + '"';
  }
  else
    return str;
}
// 将数组内的对象数据保存成csv
// file: save file path
exports.saveCSV = (file, datas) => {
  if (!datas?.length) return;
  const array = [];
  const temp = [];
  for (const title in datas[0])
    temp.push(toCSVString(title));
  array.push(temp.join(','));
  for (const item of datas) {
    temp.length = 0;
    for (const t in item)
      temp.push(toCSVString(item[t]));
    array.push(temp.join(','));
  }
  const result = array.join("\r\n");
  fs.writeFileSync(file, result);
}
// 翻页爬行
exports.pageCrawl = async (config) => {
  // 翻页后确认已经获取到了数据则可以继续翻页
  let turning;
  // 爬取的所有数据
  const datas = [];
  let browser = await exports.getBrowser(config);
  let page;
  if (config.port)
    page = (await browser.pages()).find(p => p.url().startsWith(config.url));
  if (!page)
    page = await browser.newPage();
  let pageCount = 0;
  if (config.json) {
    page.on("response", async (r) => {
      if (r.request().resourceType() != "xhr")
        return;
      // 根据url找到接口
      if (r.url().indexOf(config.request) < 0)
        return;
      // 获取数据
      const data = await r.json();
      // 将获取到的数组数据存起来
      datas.push(...config.json(data));
      console.log("Crawling", datas.length);
      // 通知可以翻页
      turning();
      pageCount++;
    });
  }
  // 去到你要的网页
  page.goto(config.url, { timeout: 0 });
  while (true) {
    if (config.json)
      // 等待获取数据
      await new Promise(resolve => turning = resolve);
    
    if (config.wait)
      await page.waitForSelector(config.wait);
    
    if (config.dom) {
      // 从页面获取数据
      const data = await page.evaluate(config.dom);
      datas.push(...data);
      console.log("Crawling", datas.length);
      pageCount++;
    }
    
    // 翻页 | 结束
    const over = await page.evaluate((next) => {
      // 获取下一页按钮
      const button = next && document.querySelector(next);
      // 不能翻页则结束
      if (!button || button.disabled)
        return true;
      else
        // 点击翻页
        button.click();
    }, typeof (config.next) == 'string' ? config.next : config.next(pageCount, page))
    // 不能下一页，结束爬行
    if (over)
      break;
  }

  console.log("Complete!");
  // 拉取完毕，将数据写入文件
  let file = config.output;
  if (file) {
    file.substring(0, file.indexOf('.'));
    if (config.csv) {
      file += ".csv";
      exports.saveCSV(file, datas);
    } else {
      file += ".json";
      fs.writeFileSync(file, JSON.stringify(datas));
    }
    console.log("Save ->", file);
  }

  await browser.close();
  // exit();
}