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
// 将一个对象转换成一行CSV格式的字符串数据(末尾包含换行)
exports.writeCSVLine = (data) => {
  const temp = [];
  for (const t in data)
    temp.push(toCSVString(data[t]));
  return temp.join(',') + "\r\n";
}
// 将一个对象数组转换成多行CSV格式的字符串数据(末尾包含换行)，传入array:string[]可以让数据往array末尾追加
exports.writeCSVLines = (datas, array) => {
  if (!array)
    array = [];
  for (const item of datas)
    array.push(exports.writeCSVLine(item));
  return array.join("");
}
// 将数组内的对象数据保存成csv
exports.saveCSV = (file, datas) => {
  if (!datas?.length) return;
  const array = [];
  const temp = [];
  // 表头
  for (const title in datas[0])
    temp.push(toCSVString(title));
  array.push(temp.join(',') + "\r\n");
  const result = exports.writeCSVLines(datas, array);
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
      const json = await r.json();
      const data = config.json(json);
      if (config.ondata)
        config.ondata(data, r.url());
      // 将获取到的数组数据存起来
      datas.push(...data);
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
      if (config.ondata)
        config.ondata(data, page.url());
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

  crawlover(config, datas);

  await browser.close();
  // exit();
}
// 接口爬行
exports.xhrCrawl = async (config) => {
  config = Object.assign({
    method: "GET",
    queue: 4,
  }, config);
  const queue = [];
  const datas = [];
  const all = [];
  let on = 0;
  let i = 0;
  let handle;
  const query = (j) => {
    if (i >= config.datas.length)
      return;
    queue[j] = {
      promise: new Promise(resolve => {
        axios({
          method: config.method,
          url: config.url,
          headers: config.headers,
          params: config.method == "GET" ? config.datas[i] : undefined,
          data: config.method == "GET" ? undefined : config.datas[i],
        }).then(i => {
          datas[queue[j].i] = i.data;
          if (queue[j].i == on) {
            // 按页数顺序回调接口
            while (datas[on]) {
              const temp = config.json(datas[on]);
              all.push(...temp);
              if (config.ondata)
                config.ondata(temp, config.datas[on]);
              console.log("Crawling", all.length);
              on++;
            }
            if (on == config.datas.length)
              handle();
          }
          query(j);
        }).finally(() => {
          resolve();
        })
      }),
      i: i,
    };
    i++;
  };

  for (let j = 0; j < config.queue; j++)
    query(j);

  await new Promise(resolve => handle = resolve);

  crawlover(config, all);
}
function crawlover(config, datas) {
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
}