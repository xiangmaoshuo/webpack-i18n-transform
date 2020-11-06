const loaderUtils = require('loader-utils');

module.exports = function loader() {
  const { key, val } = loaderUtils.getOptions(this);
  this.i18nList.set(key, val);
  return '';
}