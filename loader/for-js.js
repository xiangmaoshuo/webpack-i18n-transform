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

const disableAutoI18nRegExp = /auto-i18n-disable/;
const excludeRegExp = /node_modules/;

// 核心loader，主要是将js中的中文进行ast语法分析，找出其中的中文并替换成$t('xxx', ...)语法
module.exports = function loader(source) {

  const {
    exclude = excludeRegExp,
    disableRegExp = disableAutoI18nRegExp
  } = loaderUtils.getOptions(this);

  if (isExclude(this.resource, exclude) || disableRegExp.test(source)) {
    return source;
  }

  const i18nList = new Map();

  function i18nCollect(hash, value) {
    if (!i18nList.has(hash)) {
      i18nList.set(hash, value);
    }
  }

  const ast = parse(source, {
    sourceType: 'module',
  });

  traverse(ast, traverseOptions, null, { callback: i18nCollect });

  const { code } = generate(ast, {}, source);

  this.i18nList.set(this.resource, i18nList);

  if (!i18nList.size) {
    return code;
  }

  return `import { $t } from ${this.i18nPath};\n${code}`;
}
