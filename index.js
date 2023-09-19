const fs = require('fs');
const axios = require('axios');
const { exit } = require('process');
const { Browser } = require('puppeteer');

/**
 * @typedef {object} config
 * @property {string} [chrome] - 使用本地浏览器
 * @property {number} [port] - 使用已经打开的 chrome 浏览器的远程调试端口
 * @property {boolean} [headless] - 不显示浏览器
 * @property {string} output - 采集的数据输出的文件名，不配置会不输出文件
 * @property {boolean} [csv] - 输出.csv文件，不配置默认输出.json文件
 * @property {string} url - 采集数据的目标网站url，地址打开应该可以采集到数据的第一页
 * @property {string | function(number):(string | undefined)} next - 翻页按钮的DOM元素selector或下一页的URL，如果页面没有按钮或按钮禁用就会结束爬行，返回空时可以结束爬行
 * @property {function(Record[], string):(Promise | undefined)} [ondata] - 每采集到一页数据时回调
 * @property {string} request - 接口的url，包含部分即可，例如api/test
 * @property {function(any):Record[]} json - 请根据接口返回的json数据，返回最终的数据数组
 * @property {string} [wait] - 等待数据渲染完成的关键DOM元素的selector
 * @property {function(any):Record[]} dom - 从页面采集数据，JS的DOM操作，最终返回数据数组(你应该到浏览器的调试工具控制台中先写好再粘贴到这里)
 * @property {any} [pass] - dom 操作方法因为是在浏览器层面执行，pass 为需要传递的 node 变量
 */

/**
 * 获取可操作的浏览器实例
 * @param {config} config 
 * @returns {Browser}
 */
exports.getBrowser = async function (config) {
  if (!config) config = {};
  let puppeteer = require('puppeteer-core');
  let browser;
  if (config.chrome) {
    browser = await puppeteer.launch({
      headless: config.headless,
      executablePath: config.chrome,
      timeout: 0,
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
        timeout: 0,
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
/** 将一个对象转换成一行CSV格式的字符串数据(末尾包含换行)
 * @param {Record<string, string>} data
 * @returns {string} - CSV 格式的一行字符串
 */
exports.writeCSVLine = (data) => {
  const temp = [];
  for (const t in data)
    temp.push(toCSVString(data[t]));
  return temp.join(',') + "\r\n";
}
/** 将一个对象数组转换成多行CSV格式的字符串数据(末尾包含换行)
 * @param {Record<string, string>} datas 
 * @param {string[]} [array] -可以让数据往数组末尾追加
 * @returns {string} - CSV 格式的字符串
 */
exports.writeCSVLines = (datas, array) => {
  if (!array)
    array = [];
  for (const item of datas)
    array.push(exports.writeCSVLine(item));
  return array.join("");
}
/** 将数组内的对象数据保存成csv
 * @param {string} file 
 * @param {Record<string, string>} datas 
 */
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
/**
 * 翻页爬行
 * @param {config} config
 */
exports.pageCrawl = async (config) => {
  // 翻页后确认已经获取到了数据则可以继续翻页
  let turning;
  // 爬取的所有数据
  const datas = [];
  let browser = await exports.getBrowser(config);
  let page;
  if (config.port && !config.headless)
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
      if (data) {
        if (config.ondata)
          await config.ondata(data, r.url());
        // 将获取到的数组数据存起来
        datas.push(...data);
        console.log("Crawling", datas.length);
      }
      // 通知可以翻页
      turning();
      pageCount++;
    });
  }
  // 去到你要的网页
  page.goto(config.url, { timeout: 0 });
  while (true) {
    if (config.json) {
      console.log("Wait response data")
      // 等待获取数据
      await new Promise(resolve => turning = resolve);
    }
    
    if (config.wait) {
      while (true) {
        let timeout = 0;
        console.log("Wait page selector", config.wait)
        try {
          const result = page.evaluate(async (wait) => {
            await new Promise(r => {
              const timer = setInterval(() => {
                if (document.querySelector(wait)) {
                  r();
                  clearInterval(timer);
                }
              }, 200);
            })
          }, config.wait).catch(() => { });
          // 防止超时卡住
          timeout = setTimeout(() => {
            Promise.reject(result);
          }, 5000);
          await result;
        } catch {
          continue;
        }
        clearTimeout(timeout);
        break;
      }
      // await page.waitForSelector(config.wait);
    }
    
    if (config.dom) {
      console.log("Crawling page data");
      // 从页面获取数据
      const data = await page.evaluate(config.dom, config.pass);
      if (data) {
        if (config.ondata)
          await config.ondata(data, page.url());
        datas.push(...data);
        console.log("Crawling", datas.length);
        pageCount++;
      }
    }
    
    // 翻页 | 结束
    console.log("Turn the next page");
    const href = page.url();
    const over = await page.evaluate((next) => {
      // 直接返回
      if (next?.indexOf('/')) {
        location.href = next;
        return;
      }
      // 获取下一页按钮
      const button = next && document.querySelector(next);
      // 不能翻页则结束
      if (!button || button.disabled)
        return true;
      else
        // 点击翻页
        button.click();
    }, (typeof (config.next) == 'string') ? config.next : config.next(pageCount, page))
    // 不能下一页，结束爬行
    if (over)
      break;

    // 等待翻页完成
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 2000);
      const timer = setInterval(() => {
        if (href != page.url()) {
          resolve();
          clearInterval(timer);
          clearTimeout(timeout);
        }
      }, 200);
    });
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
  if (file && datas) {
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
/** 下载一个网络资源到本地
 * @param {string} url - 网络资源
 * @param {string} filename - 本地保存路径
 * @param {boolean} [exists=true] - 本地已经存在文件则不重复下载文件
 * @returns {Promise<string>} 成功后 resolve 文件名，失败时 reject URL
 */
exports.download = async (url, filename, exists = true) => {
  if (!fs.existsSync(filename)) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      fs.writeFileSync(filename, buffer);
      console.log('download completed!', url);
    } catch (error) {
      console.log('download error!', url, error);
      return Promise.reject(url);
    }
  }
  return Promise.resolve(filename);
}