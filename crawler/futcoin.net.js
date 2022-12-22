const { pageCrawl } = require('../index');

pageCrawl({
  output: __filename,
  // 在浏览器中打开
  port: 9222,
  // 采集地址
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
  // 下一页按钮
  next: (i) => {
    // 测试只采集2页
    if (i == 2)
      return;
    return '[data-uk-icon="arrow-right"]';
  },
  // 输出成csv
  csv: true,
})
