const loaderUtils = require('loader-utils');
const { atob } = require('../utils');
const { name } = require('../package.json');
// const TransformI18nWebpackPlugin = require('../index');

module.exports = function loader() {};

module.exports.pitch = function pitch() {
  // const webpack = this._compiler.webpack || require('webpack');
  const options = loaderUtils.getOptions(this);
  const val = JSON.parse(atob(options.val)).reduce((pre, [a, b]) => {
    pre[a] = b;
    return pre;
  }, {});
  const opts = {
    identifier: this.resource,
    content: JSON.stringify(val)
  };
  const I18nDependency = this._I18nDependency;
  this._module.addDependency(new I18nDependency(opts, this.context, 0));
  return `// extracted by ${name}`;
};
