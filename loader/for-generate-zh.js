const loaderUtils = require('loader-utils');
const { atob } = require('../utils');

module.exports = function loader() {
  this.clearDependencies();
  const options = loaderUtils.getOptions(this);
  const key = atob(options.key);
  const val = JSON.parse(atob(options.val));
  this.i18nList.set(key, val);
  return '';
}