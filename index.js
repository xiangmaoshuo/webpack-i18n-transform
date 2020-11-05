const path = require('path');
const fs = require('fs');
const loaderUtils = require('loader-utils');
const RuleSet = require('webpack/lib/RuleSet');
const { isExistsPath } = require('./utils');
const { name } = require('./package.json');

const PLUGIN_NAME = 'TransformI18nWebpackPlugin';
const getRegExp = (str) => new RegExp(`${name}(\\\/|\\\\)loader(\\\/|\\\\)for-${str}.js$`);

module.exports = class TransformI18nWebpackPlugin {
  constructor({
    i18nPath,
    generateZhPath = false
  } = {}) {
    this.i18nPath = i18nPath;
    this.i18nList = new Map();
    this.generateZhPath = true;

    // 如果采用的是默认的$tPath，则excel必须存在
    if (!this.i18nPath) {
      throw new Error('TransformI18nWebpackPlugin: i18nPath is required!');
    }
  }
  apply(compiler) {
    const rawRules = compiler.options.module.rules;
    const { rules } = new RuleSet(rawRules);

    let ctxI18nPath = null;

    // 这里只处理了for-js，因为excel和vue都是可选的
    setOptions(matcher(rules, getRegExp('js')), {
      generateZhPath: this.generateZhPath,
      getI18nPath: (ctx) => {
        if (ctxI18nPath) { return ctxI18nPath; }
        const rc = ctx.rootContext;
        const i18nPath = isExistsPath(path.resolve(rc, this.i18nPath));
        ctxI18nPath = loaderUtils.stringifyRequest(ctx, i18nPath);
        return ctxI18nPath;
      },
    });

    compiler.options.module.rules = rules;

    // 获取compilation
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // 给ctx添加变量，以便loader能够获取它
      compilation.hooks.normalModuleLoader.tap(
        PLUGIN_NAME,
        (ctx) => {
          ctx.i18nList = this.i18nList;
        },
      );
    });

    if (this.generateZhPath) {
      // 目前收cache-loader影响，导致收集中文时不全面
      // 现阶段在开启生成中文Map时，先将缓存清空
      // 所以在启动项目时肯定会比较慢
      const cacheDir = path.resolve(compiler.context, 'node_modules/.cache');
      deleteFolderRecursive(cacheDir);
      compiler.hooks.emit.tapPromise(PLUGIN_NAME, async (compilation) => {
        const { modules, assets } = compilation;
        const { i18nList } = this;
        const resourceObj = modules.reduce((pre, { resource }) => {
          if (resource) {
            pre[resource] = true;
          }
          return pre;
        }, {});
        const effectiveResource = [...i18nList.keys()].filter(k => resourceObj[k]);
  
        // 该项目中收集到的中文及其hash
        const finalI18nList = effectiveResource.reduce((map, k) => {
          i18nList.get(k).forEach(([key, value]) => {
            map.set(key, value);
          });
          return map;
        }, new Map());

        const i18nHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width,initial-scale=1.0">
            <title>i18n中文列表</title>
          </head>
          <body>
            <pre>${[...finalI18nList.values()].join('\n')}</pre>
          </body>
        </html>
        `;
  
        assets['i18n.html'] = {
          source: () => i18nHtml,
          size: () => i18nHtml.length,
        };
      });
    }
  }
}

function setOptions(rules, options = {}) {
  rules.forEach((rule) => {
    rule.options = {
      ...(rule.options || {}),
      ...options,
    }
  });
}

function matcher(rules, regExp) {
  return rules.reduce((pre, { use, oneOf }) => {
    if (oneOf) {
      pre.push(...matcher(oneOf, regExp));
    } else if (use) {
      const loader = use.find(u => regExp.test(u.loader));
      if (loader) {
        pre.push(loader);
      }
    }
    return pre;
  }, []);
}

function deleteFolderRecursive(dir) {
  if( fs.existsSync(dir) ) {
    fs.readdirSync(dir).forEach(function(file) {
      const curPath = path.resolve(dir, file);
      if(fs.statSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
};