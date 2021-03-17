const loaderUtils = require('loader-utils');
const { atob } = require('../utils');
const { name } = require('../package.json');
const TransformI18nWebpackPlugin = require('../index');

module.exports = function loader() {};

module.exports.pitch = function pitch() {
  const webpack = this._compiler.webpack || require('webpack');
  const options = loaderUtils.getOptions(this);

  const opts = {
    identifier: this.resource,
    content: JSON.parse(atob(options.val))
  };
  const I18nDependency = TransformI18nWebpackPlugin.getI18nDependency(webpack);
  this._module.addDependency(new I18nDependency(opts, this.context, 0));
  return `// extracted by ${name}`;
};
