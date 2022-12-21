const { pageCrawl } = require('../index');

pageCrawl({
  output: __filename,
  // 在浏览器中打开
  port: 9222,
  // 接口地址
  request: "offer/search?",
  // json数据
  json: (i) => i.payload.results,
  // 采集地址
  url: "https://www.g2g.com/categories/wow-boosting-service?sort=most_recent",
  // 下一页按钮
  next: (i) => {
    // 测试只采集2页
    if (i == 2)
      return;
    return '.q-pagination>button:last-child';
  },
})