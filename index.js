const path = require('path');
const fs = require('fs');
const loaderUtils = require('loader-utils');
const RuleSet = require('webpack/lib/RuleSet');
const { isExistsPath, isAbsolutePath, isDev } = require('./utils');
const { name } = require('./package.json');

const PLUGIN_NAME = 'TransformI18nWebpackPlugin';
const getRegExp = (str) => new RegExp(`${name}(\\\/|\\\\)loader(\\\/|\\\\)for-${str}.js$`);

module.exports = class TransformI18nWebpackPlugin {
  constructor(opts) {
    const options = Object.assign({
      i18nPath: null, // required
      parseObjectProperty: false,
      parseBinaryExpression: false
    }, opts);
    if (!options.i18nPath) {
      throw new Error('TransformI18nWebpackPlugin: i18nPath is required!');
    }
    this.options = options;
    this.i18nList = new Map();
  }
  apply(compiler) {
    const generateZhPath = isDev();
    const rawRules = compiler.options.module.rules;
    const { rules } = new RuleSet(rawRules);
    const { i18nPath, ...remainOptions } = this.options;

    const extraOptions = {
      generateZhPath,
      i18nPath: isExistsPath(isAbsolutePath(i18nPath) ? i18nPath : path.resolve(compiler.context, i18nPath)),
    };
    
    setOptions(matcher(rules, getRegExp('js')), Object.assign(remainOptions, extraOptions));
    setOptions(matcher(rules, getRegExp('vue')), extraOptions);

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

    if (generateZhPath) {
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
            <style>
            * {
                padding: 0;
                margin: 0;
              }
              ul {
                list-style: none;
              }
              li {
                border-bottom: 1px dashed #ccc;
                padding-left: 10px;
                line-height: 24px;
                font-size: 14px;
              }
              pre {
                font-family: Microsoft YaHei;
              }
            </style>
            <ul>
            ${[...finalI18nList.values()].map(str => `<li><pre>${str}</pre></li>`).join('')}
            </ul>
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