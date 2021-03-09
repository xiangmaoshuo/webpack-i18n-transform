const severity = process.env.NODE_ENV === 'development' ? 1 : 2;

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true
  },
  parser: 'babel-eslint',
  extends: "eslint:recommended",
  parserOptions: {
    ecmaVersion: 2016,
    sourceType: 'module'
  },
  rules: {
    'comma-dangle': [2, "never"],
    // 驼峰
    camelcase: [2, { properties: 'always' }],
    // 数组和对象键值对最后一个逗号， never参数：不能带末尾的逗号, always参数：必须带末尾的逗号，
    // always-multiline：多行模式必须带逗号，单行模式不能带逗号
    // 所有控制语句都执行大括号规则（all）
    curly: [2, 'all'],
    // parsetInt
    radix: [2, 'as-needed'],
    // 不统一换行符
    // 'linebreak-style': [0],
    'func-names': [2, 'as-needed'],
    'max-len': [2, { 'code': 300 }],
    // 立即调用函数表达式强制总是包装函数表达式
    'wrap-iife': [2, 'inside', { functionPrototypeMethods: false }],
    // this的别名统一使用that
    'consistent-this': [2, 'that'],
    // jsx 双引号
    'jsx-quotes': [2, 'prefer-double'],
    // 箭头函数单个参数允许省略括号
    "arrow-parens": ["error", "as-needed"],
    'no-console': severity,
    'no-debugger': severity,
    // 禁止在条件中使用常量表达式
    'no-constant-condition': 2,
    // 最多连续一个空行
    'no-multiple-empty-lines': [2, { max: 1 }],
    // 禁止重复模块引入
    'no-duplicate-imports': 2,
    // 禁止对参数进行改变，除了可以改变属性
    'no-param-reassign': [1, { props: false }],
    // ++ --
    'no-plusplus': [2, { allowForLoopAfterthoughts: true }],
    // 强制分号
    semi: [2, 'always']
  }
};
