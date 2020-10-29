const t = require('@babel/types');
const fs = require('fs');
const hash = require('hash-sum');

function hasChinese(str) {
  return /[\u4E00-\u9FA5]/.test(str);
}

function generateI18nNode(value, cb, args = []) {
  const hashText = hash(value);
  cb(hashText, value);
  if (args.length) {
    return t.callExpression(t.identifier('$t'), [t.stringLiteral(hashText), t.arrayExpression(args)]);
  }
  return t.callExpression(t.identifier('$t'), [t.stringLiteral(hashText)]);
}

// 根据数组生成对应的i18n格式的字符串及其参数
function generateI18nString(args) {
  let i = 0;
  const params = [];
  const str = args.reduce((pre, childNode) => {
    if (t.isStringLiteral(childNode)) {
      pre += childNode.value;
    } else {
      params.push(childNode);
      pre += `{${i++}}`;
    }
    return pre;
  }, '');
  return { str, params };
}

// 根据生成的str和params自动判断是否应该生成节点
function autoGenerateI18nNode(args, path, cb) {
  const { str, params } = generateI18nString(args);
  // 只处理有中文的字符串
  if (hasChinese(str)) {
    path.replaceWith(generateI18nNode(str, cb, params));
  }
}

exports.hasChinese = hasChinese;
exports.generateI18nNode = generateI18nNode;
exports.generateI18nString = generateI18nString;
exports.autoGenerateI18nNode = autoGenerateI18nNode;

/**
 * @description 检查路径是否存在
 */
exports.isExistsPath = function(path, msg) {
  if (!fs.existsSync(path)) {
    if (msg) {
      throw new Error(msg);
    }
    throw new Error(`${path} is not exist!`);
  }
  return path;
}

const rules = {
  '[object RegExp]': (reg, v) => reg.test(v),
  '[object Function]': (fn, v) => fn(v),
  '[object String]': (str, v) => v.includes(str),
}

exports.isExclude = function(resource, exclude = []) {
  const array = Array.isArray(exclude) ? exclude : [exclude];
  for (let i = 0, len = array.length; i < len; i++) {
    const rule = array[i];
    const type = Object.prototype.toString.call(rule);
    const fn = rules[type] || (() => false);
    if (fn(rule, resource)) {
      return true;
    }
  }
  return false;
}

exports.isDev = () => process.env.NODE_ENV === 'development';