const path = require('path');
const fs = require('fs');
const qs = require('querystring');
const loaderUtils = require('loader-utils');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const { isExclude, btoa } = require('../utils');

const getTraverseOptions = traversePath => {
  return fs.readdirSync(traversePath, 'utf-8')
  .filter(p => /\.js$/.test(p))
  .reduce((pre, p) => {
    pre[p.replace(/\.js$/, '')] = require(path.resolve(traversePath, p));
    return pre;
  }, {});
};
const traverseOptions = getTraverseOptions(path.resolve(__dirname, '../babel-traverse'));

// 有这个标记的代码块整个块都不会被i18n处理
const disableI18nRegExp = /transform-i18n-disable/;
// 文件路径匹配上以下正则时，对应文件不会被i18n处理
const excludeRegExp = /node_modules/;

// 核心loader，主要是将js中的中文进行ast语法分析，找出其中的中文并替换成$t('xxx', ...)语法
module.exports = function loader(source) {
  /**
   * {
        i18nPath,
        exclude = excludeRegExp,
        disableRegExp = disableI18nRegExp,
        hmr,
        parseObjectProperty,
        parseBinaryExpression
      }
   */
  const loaderOptions = loaderUtils.getOptions(this);
  const exclude = loaderOptions.exclude || excludeRegExp;
  const disableRegExp = loaderOptions.disableRegExp || disableI18nRegExp;
  const hmr = loaderOptions.hmr;

  if (isExclude(this.resource, exclude) || disableRegExp.test(source)) {
    return getHmrCode(source, hmr);
  }

  const isVue = /\.vue$/.test(this.resourcePath);
  const isVueTmpl = isVue && (qs.parse(this.resourceQuery.slice(1)).type === 'template');

  // vue文件也可以将transform-i18n-disable写在template或者script标签上
  if (isVue && disableRegExp.test(this.resourceQuery)) {
    return getHmrCode(source, hmr);
  }

  const map = new Map();
  const ast = parse(source, { sourceType: 'module' });
  const options = {
    callback: getCallback(map),
    parseObjectProperty: loaderOptions.parseObjectProperty || isVueTmpl,
    parseBinaryExpression: loaderOptions.parseBinaryExpression
  };
  traverse(ast, traverseOptions, null, options);
  const { code } = generate(ast, {}, source);
  if (!map.size) { return getHmrCode(code, hmr, ast); }

  const query = {
    val: btoa(JSON.stringify([...map.entries()]))
  };
  const loaderPath = this.loaders[this.loaderIndex].path.replace('for-js', 'for-generate-zh');
  const prifix = `import ${loaderUtils.stringifyRequest(this, `!!${loaderPath}?${JSON.stringify(query)}!${this.resource}`)};`;

  const result = `
    ${prifix}
    import { $t } from ${loaderUtils.stringifyRequest(this, loaderOptions.i18nPath)};
    ${code}
  `;

  return getHmrCode(result, hmr, ast);
};

function getCallback(map) {
  return function cb(hash, value) {
    if (!map.has(hash)) {
      map.set(hash, value);
    }
  };
}

function getHmrCode(source, hmr, ast) {
  if (!hmr || (typeof hmr !== 'string')) {
    return source;
  }
  const excelPathList = []; // for hmr
  const traverseHmrOptions = getTraverseOptions(path.resolve(__dirname, '../babel-traverse/hmr'));
  const _ast = ast || parse(source, { sourceType: 'module' });
  traverse(_ast, traverseHmrOptions, null, {
    addExcelPath: p => excelPathList.push(p)
  });
  if (!excelPathList.length) {
    return source;
  }
  return `
    ${source}
    if (module.hot) {
      module.hot.accept(${JSON.stringify(excelPathList)}, ${hmr})
    }
  `;
}
