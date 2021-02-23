const  xlsx = require('xlsx');
const qs = require('querystring');
const hash = require('hash-sum');
const loaderUtils = require('loader-utils');

const excelMap = {};

// 经过实践，使用excel来维护国际化文本是比较好的实践方案
// 通过该loader可以将国际化loader转换成 { zh_cn: {...}, en-us: {...} }
module.exports = function loader(source) {
  const { resourcePath } = this;
  const query = qs.parse(this.resourceQuery.slice(1));
  if (query.lang) {
    return `
      var result = ${JSON.stringify(excelMap[resourcePath][query.lang])};
      export default result;
    `;
  }
  const { result, langs } = analyzeExcel(source, resourcePath);
  const options = loaderUtils.getOptions(this);
  const { async = true } = options;
  const locale = options.locale || langs[0]; // 默认中文

  const asyncLangs = langs.filter(l => l !== locale); // 异步加载的语言
  const getLangPath = (l) => loaderUtils.stringifyRequest(this, `${resourcePath}?lang=${l}`);

  if (async) {
    return `
      import result from ${getLangPath(locale)};
      var locale = '${locale}';
      var messages = { '${locale}': result };
      var asyncLangs = {
        ${asyncLangs.map(l => `${JSON.stringify(l)}: function() { return import(${getLangPath(l)}); }`).join(',')}
      };
      export default messages;
      export { locale, asyncLangs };
    `;
  }
  
  return `
    var locale = '${locale}';
    var messages = ${JSON.stringify(result)};
    var asyncLangs = {};
    export default messages;
    export { locale, asyncLangs };
  `;
}

// 解析excel
function analyzeExcel(source, resourcePath) {
  const workBook = xlsx.read(source);
  const { SheetNames, Sheets } = workBook;
  const firstSheet = Sheets[SheetNames[0]];
  const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const index = letter.indexOf(firstSheet['!ref'].match(/^A1:([A-Z]+)\d+$/)[1]);

  // 只支持最多26种语言
  if (index < 0) {
   throw new Error('excel解析失败: 列数不能超过26列'); 
  }

  const keys = Object.keys(firstSheet);
  const langs = []; // 收集语言集合
  const result = keys.filter(k => /^[A-Z]1$/.test(k))
    .reduce((pre, k) => {
      let { v } = firstSheet[k];
      v = v && v.trim();
      if (!v) {
        throw new Error('excel解析失败: 第一行不能有空值'); 
      }
      langs.push({ key: k.match(/[A-Z]/)[0], val: v });
      pre[v] = {};
      return pre;
    }, {});

  // 根据中文填充对象
  keys.filter(k => /^A\d+$/.test(k)).forEach((k) => {
    if (k === 'A1') {
      return;
    }
    const i = k.match(/\d+/)[0];
    let { v } = firstSheet[k];
    v = v && v.trim();
    const hashValue = hash(v);
    langs.forEach(({ key, val }) => {
      const target = firstSheet[`${key}${i}`];
      if (target) {
        result[val][hashValue] = target.v && target.v.trim();
      }
    });
  });

  excelMap[resourcePath] = result;

  return {
    result,
    langs: langs.map(l => l.val),
  };
}

module.exports.raw = true;