const t = require('@babel/types');

// 特殊处理vue文件中的template被编译后生成的expression字段中包含中文时，会被i18n提取
/**
 * 形如：
  {
    directives: [
      {
        name: "show",
        rawName: "v-show",
        value: "张三",
        expression: "'张三'"  <---- 主要是过滤它
      }
    ]
  }
 */
module.exports = function rule(path, { parseObjectProperty = true }) {
  if (!parseObjectProperty) {return;}
  const node = path.node;
  if (node.key.name !== 'directives') {return;}
  if (!t.isArrayExpression(node.value)) {return;}
  const { elements } = node.value;
  if (elements.find(el => !t.isObjectExpression(el))) {return;}

  const bool = !!elements.find(el => {
    const keyObj = {};
    el.properties.forEach(p => {
      keyObj[p.key.name] = true;
    });
    return !(keyObj.name && keyObj.rawName && keyObj.value && keyObj.expression);
  });

  // 判断是否为 { name, rawName, value, expression } 类型结构
  if (bool) {return;}

  // 到这里我们就认为此处的expression就是vue指令所对应的属性，而不是我们业务中使用的变量名
  elements.forEach(el => {
    const expressNode = el.properties.find(p => p.key.name === 'expression');
    // 给StringLiteral设置一个忽略标记
    expressNode.value.__ignore = true;
  });
};
