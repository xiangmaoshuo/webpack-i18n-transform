const path = require('path');
const RuleSet = require('webpack/lib/RuleSet');
const Module = require('webpack/lib/Module');
const Dependency = require('webpack/lib/Dependency');
const { isExistsPath, isAbsolutePath, isDev } = require('./utils');
const { name } = require('./package.json');

const PLUGIN_NAME = 'TransformI18nWebpackPlugin';
const JS_MODULE_TYPE = `js-i18n/${PLUGIN_NAME}`;
const EXCEL_MODULE_TYPE = `excel-i18n/${PLUGIN_NAME}`;

const getRegExp = str => new RegExp(`${name}(\\/|\\\\)loader(\\/|\\\\)for-${str}.js$`);

const i18nModuleCache = new WeakMap();
const i18nDependencyCache = new WeakMap();
const excelModuleCache = new WeakMap();
const excelDependencyCache = new WeakMap();

class I18nBaseModule extends Module {
  constructor(type, dependency) {
    super(type, dependency.context);
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
    return `${this.type} ${this._identifier} ${this._identifierIndex}`;
  }

  readableIdentifier(requestShortener) {
    return `${this.type} ${requestShortener.shorten(this._identifier)}${this._identifierIndex ? ` (${this._identifierIndex})` : ''}`;
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

class I18nBaseDependency extends Dependency {
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
}

module.exports = class TransformI18nWebpackPlugin {
  static getI18nModule(webpack) {
    if (i18nModuleCache.has(webpack)) {
      return i18nModuleCache.get(webpack);
    }
    class I18nModule extends I18nBaseModule {
      constructor(dependency) {
        super(JS_MODULE_TYPE, dependency);
      }
    }

    i18nModuleCache.set(webpack, I18nModule);

    return I18nModule;
  }

  static getI18nDependency(webpack) {
    if (i18nDependencyCache.has(webpack)) {
      return i18nDependencyCache.get(webpack);
    }
    class I18nDependency extends I18nBaseDependency {
      getResourceIdentifier() {
        return `js-i18n-module-${this.identifier}-${this.identifierIndex}`;
      }
    }

    i18nDependencyCache.set(webpack, I18nDependency);

    return I18nDependency;
  }

  static getExcelModule(webpack) {
    if (excelModuleCache.has(webpack)) {
      return excelModuleCache.get(webpack);
    }

    class ExcelModule extends I18nBaseModule {
      constructor(dependency) {
        super(EXCEL_MODULE_TYPE, dependency);
      }
    }

    excelModuleCache.set(webpack, ExcelModule);

    return ExcelModule;
  }

  static getExcelDependency(webpack) {
    if (excelDependencyCache.has(webpack)) {
      return excelDependencyCache.get(webpack);
    }
    class ExcelDependency extends I18nBaseDependency {
      getResourceIdentifier() {
        return `excel-i18n-module-${this.identifier}-${this.identifierIndex}`;
      }
    }

    excelDependencyCache.set(webpack, ExcelDependency);

    return ExcelDependency;
  }

  constructor(opts) {
    const options = Object.assign({
      locale: null, // 默认excel第一列（中文）
      async: true, // 异步加载语言文件
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
    const { i18nPath, locale, async, ...remainOptions } = this.options;

    const extraOptions = {
      generateZhPath,
      i18nPath: isExistsPath(isAbsolutePath(i18nPath) ? i18nPath : path.resolve(compiler.context, i18nPath))
    };

    setOptions(matcher(rules, getRegExp('js')), Object.assign(remainOptions, extraOptions));
    setOptions(matcher(rules, getRegExp('vue')), extraOptions);
    setOptions(matcher(rules, getRegExp('excel')), { locale, async });

    compiler.options.module.rules = rules;

    const I18nModule = TransformI18nWebpackPlugin.getI18nModule(webpack);
    const I18nDependency = TransformI18nWebpackPlugin.getI18nDependency(webpack);
    const ExcelModule = TransformI18nWebpackPlugin.getExcelModule(webpack);
    const ExcelDependency = TransformI18nWebpackPlugin.getExcelDependency(webpack);

    class I18nCommonDependencyTemplate {
      apply() {}
    }
    class I18nCommonModuleFactory {
      constructor(Module) {
        this._Module = Module;
      }
      create({
        dependencies: [dependency]
      }, callback) {
        callback(null, new this._Module(dependency));
      }
    }

    let collectedZhLocale = {};
    let excelTranslatedZhLocale = {};

    // 获取compilation
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      compilation.dependencyFactories.set(I18nDependency, new I18nCommonModuleFactory(I18nModule));
      compilation.dependencyTemplates.set(I18nDependency, new I18nCommonDependencyTemplate());
      compilation.dependencyFactories.set(ExcelDependency, new I18nCommonModuleFactory(ExcelModule));
      compilation.dependencyTemplates.set(ExcelDependency, new I18nCommonDependencyTemplate());
      compilation.hooks.normalModuleLoader.tap(
        PLUGIN_NAME,
        ctx => {
          ctx._I18nDependency = I18nDependency;
          ctx._ExcelDependency = ExcelDependency;
        }
      );
      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, modules => {
        const i18nModules = modules.filter(m => m.constructor === I18nModule);
        const excelModules = modules.filter(m => m.constructor === ExcelModule);
        collectedZhLocale = i18nModules.reduce((pre, m) => {
          return { ...pre, ...(JSON.parse(m.content)) };
        }, {});

        excelTranslatedZhLocale = {};

        const excelAnalyzeResult = excelModules.reduce((pre, m) => {
          const { result, langs, locale } = JSON.parse(m.content);
          const originalValue = { ...result };
          // 收集翻译了的中文
          Object.assign(excelTranslatedZhLocale, result[langs[0]]);
          // 将已翻译内容和当前页面中已收集的中文进行merge，已翻译内容优先
          result[locale] = Object.assign({}, collectedZhLocale, result[locale]);
          pre[m._identifier] = { result, langs, originalValue };
          return pre;
        }, {});

        compilation.hooks.normalModuleLoader.tap(`${PLUGIN_NAME} finishModules`, ctx => {
          ctx._i18nExcelAnalyzeResult = excelAnalyzeResult;
        });

        const originExcelModules = modules.filter(m => m.dependencies.some(d => d.constructor === ExcelDependency));

        const promises = originExcelModules.map(eModule => {
          return new Promise((resolve, reject) => {
            try {
              compilation.rebuildModule(eModule, resolve);
            } catch(err) {
              reject(err);
            }
          });
        });

        return Promise.all(promises);
      });
    });
    if (generateZhPath) {
      compiler.hooks.emit.tapPromise(PLUGIN_NAME, async compilation => {
        const { assets } = compilation;
        const { add, reduce, common } = i18nDiff(
          Object.values(collectedZhLocale),
          Object.values(excelTranslatedZhLocale)
        );

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
