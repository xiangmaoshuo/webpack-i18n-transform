const t = require('@babel/types');
const { hasChinese, generateI18nNode } = require('../utils');
module.exports = function (path, { callback }) {
  // eg: var a = 'xx'
  if (hasChinese(path.node.value)) {
    path.replaceWith(generateI18nNode(path.node.value, callback));
  }
}