const t = require('@babel/types');
const { autoGenerateI18nNode } = require('../utils');

module.exports = function (path, { callback }) {
  const args = [];
  // eg: var a = 'xx'.concat(bb).concat(cc);
  if (isCompiledTmplString(path.node, args)) {
    autoGenerateI18nNode(args, path, callback);
  }
}

// 是否为编译后的模板字符串
function isCompiledTmplString(node, args) {
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee)) {
    args.unshift(...node.arguments);
    return isStringMemberExpression(node.callee, args);
  }
  return false;
}

// eg: 'xx'.concat(y)
function isStringMemberExpression({ object, property }, args) {
  if (!t.isIdentifier(property, { name: 'concat' })) {
    return false;
  }
  if (t.isStringLiteral(object)) {
    args.unshift(object);
    return true;
  }
  return isCompiledTmplString(object, args);
}