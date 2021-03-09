const { hasChinese, generateI18nNode } = require('../utils');
module.exports = function rule(path, { callback }) {
  // eg: var a = 'xx'
  // 目前该属性是在ObjectProperty.js中设置的，表示是否跳过该字符串的i18n转译
  if (path.node.__ignore) {return;}
  if (!hasChinese(path.node.value)) {return;}
  path.replaceWith(generateI18nNode(path.node.value, callback));
};
