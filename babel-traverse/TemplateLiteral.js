const { hasChinese, generateI18nNode } = require('../utils');
module.exports = function rule(path, { callback }) {
  // eg: var a = `abc${de}f${g}h`;
  const { expressions, quasis } = path.node;

  const str = quasis.reduce((pre, { value: { raw }, tail }, index) => {
    return `${pre}${raw}${tail ? '' : `{${index}}`}`;
  }, '');

  if (hasChinese(str)) {
    path.replaceWith(generateI18nNode(str, callback, expressions));
  }
};
