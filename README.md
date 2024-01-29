# 准准的nodejs+ts启动器

## 创建过程
```
// 初始化 npm 项目
npm init -y

// 安装 TypeScript
npm install typescript --save-dev

// 初始化 TypeScript 配置
npx tsc --init

// 创建src/index.ts文件

//安装 ts-node 和 TypeScript 类型定义
yarn add ts-node @types/node --dev

//更新 package.json
"scripts": {
  "start": "ts-node src/index.ts"
}

//运行
yarn start

```

## 增加测试工具jest
```
// 1.安装 Jest
npm install --save-dev jest @types/jest ts-jest
# 或者
yarn add --dev jest @types/jest ts-jest

// 2.配置 Jest,根目录新建 jest.config.js 
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

// 3.编写测试文件 test.ts 用npx命令执行
# npx jest --testNamePattern="test1"
test('test1', () => {
    // 您的测试逻辑
    console.log(888);
    
    // expect().toBe();//断言 两个值是否相等
});


```