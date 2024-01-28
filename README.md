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