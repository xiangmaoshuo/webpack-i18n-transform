const t = require('@babel/types');
const { autoGenerateI18nNode } = require('../utils');
module.exports = function rule(path, { callback, parseBinaryExpression = true }) {
  // eg: var a = 'xx' + b;
  // 可以配置是否启用该规则
  if (!parseBinaryExpression) {return;}
  if (path.node.operator !== '+') {return;}
  if (!t.isStringLiteral(path.node.left) && !t.isStringLiteral(path.node.right)) {return;}
  autoGenerateI18nNode(flatBinaryExpression(path.node), path, callback);
};

function flatBinaryExpression(node, args = []) {
  args.unshift(node.right);
  if (t.isBinaryExpression(node.left, { operator: '+' })) {
    flatBinaryExpression(node.left, args);
  } else {
    args.unshift(node.left);
  }
  return args;
}

