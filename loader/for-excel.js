const xlsx = require('xlsx');
const qs = require('querystring');
const hash = require('hash-sum');
const loaderUtils = require('loader-utils');
const { name } = require('../package.json');

const errorMsgPrefix = `[${name}][for-excel]: `;

const excelMap = {};

// 经过实践，使用excel来维护国际化文本是比较好的实践方案
// 通过该loader可以将国际化loader转换成 { zh_cn: {...}, en-us: {...} }
module.exports = function loader(source) {
  const { resourcePath } = this;
  const query = qs.parse(this.resourceQuery.slice(1));
  // 这个输出的结构也不要随便改，插件的emit事件中会去使用该result
  if (query.lang) {
    return `
      var result = ${JSON.stringify(excelMap[resourcePath][query.lang])};
      export default result;
    `;
  }
  const { langs } = analyzeExcel(source, resourcePath);
  const loaderOptions = loaderUtils.getOptions(this);

  const locale = getLocale(loaderOptions.locale, langs); // 默认中文，也可自定义

  // 除了主语言，其他的语言都异步加载
  const asyncLangs = langs.filter(l => l !== locale); // 异步加载的语言
  // 该方法不要随便改，在插件的emit方法中会使用该path去匹配module
  const getLangPath = l => loaderUtils.stringifyRequest(this, `${resourcePath}?lang=${l}${l === locale ? '&default=1': ''}`);

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
};

// 确定默认locale
function getLocale(locale, langs) {
  if (!locale) {return langs[0];}
  if (langs.includes(locale)) {return locale;}
  throw new Error(`${errorMsgPrefix}the locale is not exist in excel`);
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
   throw new Error(`${errorMsgPrefix}The number of columns cannot exceed 26`);
  }

  const keys = Object.keys(firstSheet);
  const langs = []; // 收集语言集合
  const result = keys.filter(k => /^[A-Z]1$/.test(k))
    .reduce((pre, k) => {
      let { w } = firstSheet[k];
      w = w && w.trim();
      if (!w) {
        throw new Error(`${errorMsgPrefix}The first line cannot have a null value`);
      }
      langs.push({ key: k.match(/[A-Z]/)[0], val: w });
      pre[w] = {};
      return pre;
    }, {});

  // 默认excel第一列的每一项为hash计算的输入值（即中文值）
  keys.filter(k => /^A\d+$/.test(k)).forEach(k => {
    if (k === 'A1') {
      return;
    }
    const i = k.match(/\d+/)[0];
    let { w } = firstSheet[k];
    w = w && w.trim();
    // 作为key
    const hashValue = hash(w);
    langs.forEach(({ key, val }) => {
      const target = firstSheet[`${key}${i}`];
      if (target) {
        result[val][hashValue] = target.w && target.w.trim();
      }
    });
  });

  excelMap[resourcePath] = result;

  return {
    result,
    langs: langs.map(l => l.val)
  };
}

module.exports.raw = true;
