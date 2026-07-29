# i18n-extract

used to extract chinese in a project

# 安装

```shell
pnpm install i18n-extract-cli -g
yarn install i18n-extract-cli -g
npm install i18n-extract-cli -g
```

# 使用
## 创建配置文件
```shell
i18n init
```
创建一份默认的配置文件

```js
{
    "localeDir": "locales",
    "extractDir": "./",
    "importStatement": "import I18N from @/utils/i18n",
    "excludeFile": [],
    "excludeDir": [
        "node_modules"
    ],
    "type": "ts"
}
```

## 提取中文
```shell
i18n extract

// 或者直接使用下列命令
npx i18n-extract-cli extract
```
提取 `extractDir` 目录下所有的中文，存储到 `localeDir/zh-CN/index.json` 下

## 检查中文
```shell
i18n extract:check
```
检查项目中是否存在未提取的中文以及非法的 i18n 变量引用

## 修复非法 i18n 引用
```shell
i18n extract:check --fix
```
将 `extract:check` 检测到的非法 i18n 变量引用还原回中文，并清理语言包中的废弃 key。修复后可重新执行 `i18n extract` 生成正确的引用。

## 清理未使用的 key
```shell
i18n extract:clear
```
清理语言包中未被引用的 key

## 还原 I18N 引用为中文
```shell
// 还原单个文件
i18n restore src/pages/demo.tsx

// 还原整个项目
i18n restore
```
将源码中的 `I18N.*` 引用还原回中文文本，并清理语言包中对应的 key。常用于文件迁移场景：先还原中文，移动文件后重新执行 `i18n extract`。
