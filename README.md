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

```json
{
    localeDir: 'locales',
    extractDir: './',
    importStatement: 'import I18N from @/utils/i18n',
    excludeFile: [],
    excludeDir: [],
}
```
## 提取中文
```shell
i18n extract
```
提取 `extractDir` 目录下所有的中文，存储到 `localeDir/zh-CN/index.json` 下