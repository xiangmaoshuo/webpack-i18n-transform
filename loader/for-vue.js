const qs = require('querystring');
const loaderUtils = require('loader-utils');
const i18nLoaderPath = require.resolve('./for-js');
module.exports = source => source;

// 为了能够在vue-loader对template内容编译后进行i18n转换
module.exports.pitch = function pitch() {
  // 由于vue-loader内部的一系列骚操作
  // 该loader最好直接在vue-cli3中的vue对应的rule中使用
  // 但是由于该rule本身只匹配.vue文件，所以这里需要过滤
  const query = qs.parse(this.resourceQuery.slice(1));
  if (query.type !== 'template') {
    return;
  }
  const { loaders } = this;
  const options = loaderUtils.getOptions(this);
  const preLoaders = loaders.filter(l => !l.pitchExecuted);
  const postLoaders = loaders.filter(l => l.pitchExecuted);

  // 跳过pitch回路上的loader
  postLoaders.forEach(l => { l.normalExecuted = true; });

  // 删除自己
  postLoaders.pop();

  // 匹配处理.vue文件中的template的loader，可以通过options覆盖
  const vueTmplRegExp = options.vueTmplRegExp || /vue\-loader.+templateLoader.js$/;
  const vueTmplLoaderIndex = postLoaders.findIndex(l => vueTmplRegExp.test(l.path));
  const vueTmplLoader = postLoaders[vueTmplLoaderIndex];

  const genRequest = loaders => {
    const loaderStrings = loaders.map(loader => typeof loader === 'string' ? loader : loader.request);

    return loaderUtils.stringifyRequest(this, '-!' + [
      ...loaderStrings,
      this.resourcePath + this.resourceQuery
    ].join('!'));
  }

  const i18nLoaderQuery = JSON.stringify({ generateZhPath: options.generateZhPath, i18nPath: options.i18nPath });

  // 修改request中的loader顺序，在template编译后调用for-js.js
  const request = genRequest([
    ...postLoaders.slice(0, vueTmplLoaderIndex),
    `${i18nLoaderPath}?${i18nLoaderQuery}`,
    ...postLoaders.slice(vueTmplLoaderIndex),
    ...preLoaders
  ]);
  return `export * from ${request}`;
}
