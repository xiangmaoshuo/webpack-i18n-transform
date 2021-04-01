// 判断是否有excel依赖
module.exports = function rule(path, { addExcelPath }) {
  // eg: import abc from '../aaa.xlsx'
  if (!/\.xls(x)?$/.test(path.node.source.value)) { return; }
  addExcelPath(path.node.source.value);
};
