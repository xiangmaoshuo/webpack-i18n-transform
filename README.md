# webpack-i18n-transform
该插件用于自动将代码中的中文转换成$t('hash', [...]);

### 用法
```
  plugins: [
    new TransformI18nWebpackPlugin({
      i18nPath: 'src/i18n/index.js',
    }),
  ]
```
|属性|类型|默认值|说明|
|:-|:-|:-|:-|
|i18nPath|String|-|i18n地址，该文件需要向外暴露一个$t接口，类似 export { $t }|
|locale|String|excel第一列（中文）|如果你使用了插件自带的for-excel.js loader，该字段表示默认的构建语言|
|async|Boolean|true|同locale，表示除了主资源包，是否异步加载剩余的资源包|

|parseObjectProperty|Boolean|false|是否启用babel的ObjectProperty规则，默认对vue文件的template启用，该规则主要是让i18n不处理vue文件编译后生成的expression字段|
|parseBinaryExpression|Boolean|false|是否启用babel的BinaryExpression规则，默认不启用，该规则将处理形如'a' + b,'a' + 'b'这种表达式为一个i18n语句|

### 代码说明
插件内提供了三个loader：
1. for-vue: 用于处理vue文件中的template; 支持自定义属性`vueTmplRegExp`;

  |属性|类型|说明|
  |:-|:-|:-|
  |vueTmplRegExp|RegExp|匹配处理.vue文件中的template的loader|

2. for-excel: 如果你的国际化是基于excel文件来管理的，那么可以使用该loader来自动解析;

|属性|类型|默认值|说明|
|:-|:-|:-|:-|
|async|Boolean|true|是否异步加载lang资源|
|locale|String|excel第一列第一行|默认语言|

3. for-js: 核心loader，该loader中会基于babel的ast语法树来对代码进行转换; 

|属性|类型|默认值|说明|
|:-|:-|:-|:-|
|exclude|Boolean|/node_modules/|用以过滤，规则支持正则、字符串、函数，校验对象是资源的路径`resource`|
|disableRegExp|RegExp|/transform-i18n-disable/|该配置的匹配目标为`source`，需要注意的是，如果需要在`.vue`文件中禁用transformI18n，使用方式如下：（`template`和`script`模块都需要标注）|
```
<template transform-i18n-disable>
  <div>
    我是内容
  </div>
</template>
<script transform-i18n-disable>
export default {
  data() {
    return {...};
  },
};
<script>
```


### ast替换规则
目前主要处理了4类字符串情况，形如：
1. 'xxx'; // 单独的一个字符串
2. 'xxx'.concat(num).concat('xxx'); // 模板字符串被babel转换后的格式
3. 'xxx' + num; // 字符串拼接
4. \`xxx${num}`; // 模板字符串

### 说明
 1. 以上的字符串中必须包含有中文才会被替换；`num`可以是一个变量或其他任何js表达式；
 2. 在使用上述loader时，需要注意loader的先后顺序，最好是先等babel之类的loader先处理完js，然后再进行国际化替换;
 3. 该插件在提取字符串后会`对字符串做trim处理`，请开发者注意可能带来的影响
 4. 该插件会把所有的中文字符串都提取出来，这样会导致形如new RegExp('中文') 这种代码被替换，最终在其他语言环境下可能会出现逻辑错误
 5. `您的项目路径中不能有中文（千万注意，不然掉坑了半天找不到原因）`
 6. 如果当前module中发现了中文，for-js loader会在该module的source最前面加上一句`import { $t } from 'xxx'`语句，这在某些时候可能会报错，比如：
    1. 当前module中已经有$t变量了；解决方法： 修改既有的$t为其他变量
    2. 某些场景下，你可能不想让该语句放在第一行；解决方法：将当前source中的中文逻辑提取到单独的文件中，然后引入；或者添加禁用i18n注释。

### 其他
如果你的项目是使用的vue-cli3，可以直接使用[@xtg/vue-cli-plugin-i18n](https://github.com/xiangmaoshuo/vue-cli-plugin-i18n).

