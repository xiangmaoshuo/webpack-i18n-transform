const t = require('@babel/types');
const { autoGenerateI18nNode } = require('../utils');
module.exports = function (path, { callback }) {
  // eg: var a = 'xx' + b;
  if (path.node.operator === '+') {
    autoGenerateI18nNode(flatBinaryExpression(path.node), path, callback);
  }
}

function flatBinaryExpression(node, args = []) {
  args.unshift(node.right);
  if (t.isBinaryExpression(node.left, { operator: '+' })) {
    flatBinaryExpression(node.left, args);
  } else {
    args.unshift(node.left);
  }
  return args;
}

