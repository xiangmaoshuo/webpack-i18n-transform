const t = require('@babel/types');
const { hasChinese, generateI18nNode } = require('../utils');
module.exports = function (path, { callback }) {
  // eg: var a = `abc${de}f${g}h`;
  const { expressions, quasis } = path.node;

  const str = quasis.reduce((pre, { value: { raw }, tail }, index) => {
    pre += `${raw}${tail ? '' : `{${index}}`}`;
    return pre;
  }, '');

  if (hasChinese(str)) {
    path.replaceWith(generateI18nNode(str, callback, expressions));
  }
}
