const path = require('path');
const fs = require('fs');
const qs = require('querystring');
const loaderUtils = require('loader-utils');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const { isExclude, btoa } = require('../utils');

const traversePath = path.resolve(__dirname, '../babel-traverse');
const traverseOptions = fs.readdirSync(traversePath, 'utf-8')
  .filter(p => /\.js$/.test(p))
  .reduce((pre, p) => {
    pre[p.replace(/\.js$/, '')] = require(path.resolve(traversePath, p));
    return pre;
  }, {});

// 有这个标记的代码块整个块都不会被i18n处理
const disableI18nRegExp = /transform-i18n-disable/;
// 文件路径匹配上以下正则时，对应文件不会被i18n处理
const excludeRegExp = /node_modules/;

// 核心loader，主要是将js中的中文进行ast语法分析，找出其中的中文并替换成$t('xxx', ...)语法
module.exports = function loader(source) {
  const {
    generateZhPath,
    i18nPath,
    exclude = excludeRegExp,
    disableRegExp = disableI18nRegExp,
  } = loaderUtils.getOptions(this);

  if (isExclude(this.resource, exclude) || disableRegExp.test(source)) {
    return source;
  }

  const isVue = /\.vue$/.test(this.resourcePath);
  const isVueTmpl = isVue && (qs.parse(this.resourceQuery.slice(1)).type === 'template');

  // vue文件也可以将transform-i18n-disable写在template或者script标签上
  if (isVue && disableRegExp.test(this.resourceQuery)) {
    return source;
  }

  const map = new Map();
  const ast = parse(source, { sourceType: 'module' });
  traverse(ast, traverseOptions, null, { callback: getCallback(map), isVueTmpl });
  const { code } = generate(ast, {}, source);
  if (!map.size) { return code; }

  let prifix = '';
  if (generateZhPath) {
    const query = {
      key: btoa(this.resource),
      val: btoa(JSON.stringify([...map.entries()]))
    };
    const loaderPath = this.loaders[this.loaderIndex].path.replace('for-js', 'for-generate-zh');
    prifix = `import ${loaderUtils.stringifyRequest(this, `!!${loaderPath}?${JSON.stringify(query)}!${this.resourcePath}`)};`;
  }

  return `
    ${prifix}
    import { $t } from ${loaderUtils.stringifyRequest(this, i18nPath)};
    ${code}
  `;
}

function getCallback(map) {
  return function cb(hash, value) {
    if (!map.has(hash)) {
      map.set(hash, value);
    }
  }
}
