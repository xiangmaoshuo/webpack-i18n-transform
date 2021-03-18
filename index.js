const path = require('path');
const RuleSet = require('webpack/lib/RuleSet');
const { isExistsPath, isAbsolutePath, isDev } = require('./utils');
const { name } = require('./package.json');

const PLUGIN_NAME = 'TransformI18nWebpackPlugin';
const MODULE_TYPE = `js-i18n/${PLUGIN_NAME}`;
const getRegExp = str => new RegExp(`${name}(\\/|\\\\)loader(\\/|\\\\)for-${str}.js$`);

const i18nModuleCache = new WeakMap();
const i18nDependencyCache = new WeakMap();
module.exports = class TransformI18nWebpackPlugin {
  static getI18nModule(webpack) {
    if (i18nModuleCache.has(webpack)) {
      return i18nModuleCache.get(webpack);
    }
    class I18nModule extends webpack.Module {
      constructor(dependency) {
        super(MODULE_TYPE, dependency.context);
        this.id = '';
        this._identifier = dependency.identifier;
        this._identifierIndex = dependency.identifierIndex;
        this.content = dependency.content;
        this.sourceMap = dependency.sourceMap;
      } // no source() so webpack doesn't do add stuff to the bundle

      size() {
        return this.content.length;
      }

      identifier() {
        return `i18n ${this._identifier} ${this._identifierIndex}`;
      }

      readableIdentifier(requestShortener) {
        return `i18n ${requestShortener.shorten(this._identifier)}${this._identifierIndex ? ` (${this._identifierIndex})` : ''}`;
      }

      nameForCondition() {
        const resource = this._identifier.split('!').pop();

        const idx = resource.indexOf('?');

        if (idx >= 0) {
          return resource.substring(0, idx);
        }

        return resource;
      }

      updateCacheModule(module) {
        this.content = module.content;
        this.sourceMap = module.sourceMap;
      }

      needRebuild() {
        return true;
      }

      build(options, compilation, resolver, fileSystem, callback) {
        this.buildInfo = {};
        this.buildMeta = {};
        callback();
      }

      updateHash(hash) {
        super.updateHash(hash);
        hash.update(this.content);
        hash.update(this.sourceMap ? JSON.stringify(this.sourceMap) : '');
      }
    }

    i18nModuleCache.set(webpack, I18nModule);

    return I18nModule;
  }

  static getI18nDependency(webpack) {
    if (i18nDependencyCache.has(webpack)) {
      return i18nDependencyCache.get(webpack);
    }
    class I18nDependency extends webpack.Dependency {
      constructor({
        identifier,
        content,
        sourceMap
      }, context, identifierIndex) {
        super();
        this.identifier = identifier;
        this.identifierIndex = identifierIndex;
        this.content = content;
        this.sourceMap = sourceMap;
        this.context = context;
      }

      getResourceIdentifier() {
        return `i18n-module-${this.identifier}-${this.identifierIndex}`;
      }

    }

    i18nDependencyCache.set(webpack, I18nDependency);

    return I18nDependency;
  }

  constructor(opts) {
    const options = Object.assign({
      locale: null, // 默认excel第一列（中文）
      i18nPath: null, // required
      parseObjectProperty: false,
      parseBinaryExpression: false
    }, opts);
    if (!options.i18nPath) {
      throw new Error('TransformI18nWebpackPlugin: i18nPath is required!');
    }
    this.options = options;
  }
  apply(compiler) {
    const webpack = compiler.webpack
      ? compiler.webpack
      : require('webpack');
    const generateZhPath = isDev();
    const rawRules = compiler.options.module.rules;
    const { rules } = new RuleSet(rawRules);
    const { i18nPath, locale, ...remainOptions } = this.options;

    const extraOptions = {
      generateZhPath,
      i18nPath: isExistsPath(isAbsolutePath(i18nPath) ? i18nPath : path.resolve(compiler.context, i18nPath))
    };

    setOptions(matcher(rules, getRegExp('js')), Object.assign(remainOptions, extraOptions));
    setOptions(matcher(rules, getRegExp('vue')), extraOptions);
    setOptions(matcher(rules, getRegExp('excel')), { locale });

    compiler.options.module.rules = rules;

    const I18nModule = TransformI18nWebpackPlugin.getI18nModule(webpack);
    const I18nDependency = TransformI18nWebpackPlugin.getI18nDependency(webpack);

    // 获取compilation
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      class I18nDependencyTemplate {
        apply() {}
      }
      class I18nModuleFactory {
        create({
          dependencies: [dependency]
        }, callback) {
          callback(null, new I18nModule(dependency));
        }
      }

      compilation.dependencyFactories.set(I18nDependency, new I18nModuleFactory());
      compilation.dependencyTemplates.set(I18nDependency, new I18nDependencyTemplate());
      compilation.hooks.normalModuleLoader.tap(
        PLUGIN_NAME,
        ctx => {
          ctx._I18nDependency = I18nDependency;
        }
      );
      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, async modules => {
        const i18nModules = modules.filter(m => m.constructor === I18nModule);
        const zhLocaleObj = i18nModules.reduce((pre, m) => ({ ...pre, ...(JSON.parse(m.content)) }), {});
        if (generateZhPath) {
          compiler.hooks.emit.tapPromise(PLUGIN_NAME, async compilation => {
            const { modules, assets } = compilation;
            let existI18nData = [];
            // 从modules中寻找当前项目是否使用excel来配置翻译文件
            const zhLocale = modules.find(m => /\.xlsx?\?lang=\w+?&default=1$/.test(m.id));
            // 如果有，则将已翻译的中文和当前项目中收集到的中文进行diff
            if (zhLocale) {
              existI18nData = Object.values(eval(`(() => {${zhLocale._source._value.trim().replace(/export default result;$/, 'return result')}})()`));
            }

            // 初始化， 默认每次都是新增
            const { add, reduce, common } = i18nDiff(Object.values(zhLocaleObj), existI18nData);

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
                  .add {
                    background-color: #ecfdf0;
                  }
                  .reduce {
                    background-color: #fbe9eb;
                  }
                  pre {
                    font-family: Microsoft YaHei;
                  }
                  .total-bar {
                    padding: 10px;
                    background-color: #000;
                    color: #fff;
                    user-select: none;
                  }
                  .total-bar span {
                    margin-left: 10px;
                    margin-right: 10px;
                  }
                </style>
                <p class="total-bar">
                  <span>新增数量：${add.length}</span>
                  <span>减少数量：${reduce.length}</span>
                  <span>${add.length || reduce.length ? '相同' : '总'}数量：${common.length}</span>
                </p>
                <ul>
                ${generateHtml(add, 'add')}
                ${generateHtml(reduce, 'reduce')}
                ${generateHtml(common, '')}
                </ul>
              </body>
            </html>
            `;

            assets['i18n.html'] = {
              source: () => i18nHtml,
              size: () => i18nHtml.length
            };
          });
        }
      });
    });
  }
};

function setOptions(rules, options = {}) {
  rules.forEach(rule => {
    rule.options = {
      ...(rule.options || {}),
      ...options
    };
  });
}

// 转义html
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 生成html
function generateHtml(array, className) {
  return array.map(str => `<li class="${className}"><pre>${escapeHTML(str)}</pre></li>`).join('');
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

// 根据两组数据，得到它们的交集差集
function i18nDiff(currentData = [], compareData = []) {
  const result = {
    reduce: [],
    common: [],
    add: []
  };

  // 如果比较数据为空数组，则当前数据全为新增
  if (!compareData.length) {
    result.add = currentData;
    return result;
  }

  // 如果当前数据为空，则比较数据全为减少的
  if (!currentData.length) {
    result.reduce = compareData;
    return result;
  }

  const commonData = result.common;
  const addData = result.add;
  const copyCompareData = [...compareData];

  for (let i = 0, len = currentData.length; i < len; i++) {
    const current = currentData[i];
    let index = -1;
    for (let j = 0, len2 = copyCompareData.length; j < len2; j++) {
      if (copyCompareData[j] === current) {
        index = j;
        break;
      }
    }
    // 如果两个数组中都有该项，则添加到commonData，并且删除copyCompareData中的对应项
    if (index > -1) {
      copyCompareData.splice(index, 1);
      commonData.push(current);
    } else {
      // 则表示当前项为新增项
      addData.push(current);
    }
  }

  // 最后如果copyCompareData还有剩余，则是减少的
  result.reduce = copyCompareData;
  return result;
}
