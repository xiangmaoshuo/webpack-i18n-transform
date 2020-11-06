const path = require('path');
const fs = require('fs');
const loaderUtils = require('loader-utils');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const { isExclude } = require('../utils');

const traversePath = path.resolve(__dirname, '../babel-traverse');
const traverseOptions = fs.readdirSync(traversePath, 'utf-8')
  .filter(p => /\.js$/.test(p))
  .reduce((pre, p) => {
    pre[p.replace(/\.js$/, '')] = require(path.resolve(traversePath, p));
    return pre;
  }, {});

const disableI18nRegExp = /transform-i18n-disable/;
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

  const ast = parse(source, {
    sourceType: 'module',
  });

  if (generateZhPath) {
    const map = new Map();
    traverse(ast, traverseOptions, null, { callback: getCallback(map) });
    const { code } = generate(ast, {}, source);

    if (!map.size) { return code; }

    const query = JSON.stringify({ key: this.resource, val: [...map.entries()] });
    const loaderPath = this.loaders[this.loaderIndex].path.replace('for-js', 'for-generate-zh');
    return `
      import ${loaderUtils.stringifyRequest(this, `!!${loaderPath}?${query}!${this.resourcePath}`)};
      import { $t } from ${loaderUtils.stringifyRequest(this, i18nPath)};
      ${code}
    `;
  }

  traverse(ast, traverseOptions);
  const { code } = generate(ast, {}, source);
  return code;
}

function getCallback(map) {
  return function cb(hash, value) {
    if (!map.has(hash)) {
      map.set(hash, value);
    }
  }
}
