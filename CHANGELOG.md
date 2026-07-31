# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.6.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.5.0...v1.6.0) (2026-07-31)


### Features

* [#19](https://github.com/LuckyFBB/i18n-extract/issues/19) register restore and check fix commands ([#20](https://github.com/LuckyFBB/i18n-extract/issues/20)) ([a32ce3a](https://github.com/LuckyFBB/i18n-extract/commit/a32ce3acd253b7942e2d026add94dcbba5691f3f))

## [1.5.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.4.0...v1.5.0) (2026-06-16)


### Features

* 🎸 add i18n reference prefix validation and optimize detection logic ([#18](https://github.com/LuckyFBB/i18n-extract/issues/18)) ([8dbf871](https://github.com/LuckyFBB/i18n-extract/commit/8dbf8715e4883bb959bf9038bd22fedcf33f2891))
* 🎸 support [@i18n-file-ignore](https://github.com/i18n-file-ignore) ([#16](https://github.com/LuckyFBB/i18n-extract/issues/16)) ([0ac2157](https://github.com/LuckyFBB/i18n-extract/commit/0ac2157bc9acf0f014b5167ee4fe8a8a745e068b))

## [1.4.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.3.0...v1.4.0) (2025-06-09)


### Features

* 🎸 support [@i18n-ignore](https://github.com/i18n-ignore) ([#12](https://github.com/LuckyFBB/i18n-extract/issues/12)) ([e495d23](https://github.com/LuckyFBB/i18n-extract/commit/e495d23c75504c686fa49bf6a97e47506aac7e27))
* 🎸 support extract chinese to all localeDir ([#14](https://github.com/LuckyFBB/i18n-extract/issues/14)) ([037f4f1](https://github.com/LuckyFBB/i18n-extract/commit/037f4f156ec21c583c50d417acac3ac45c259cd7))
* 🎸 support I18N to local ([#9](https://github.com/LuckyFBB/i18n-extract/issues/9)) ([243d462](https://github.com/LuckyFBB/i18n-extract/commit/243d4624c207f91bc1cb673836dad4968280c9bd))

## [1.3.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.2.0...v1.3.0) (2025-04-16)


### Features

* 🎸 I18N.xxx not exist or file is deleted, delete the key in locales ([#7](https://github.com/LuckyFBB/i18n-extract/issues/7)) ([04022d0](https://github.com/LuckyFBB/i18n-extract/commit/04022d067da8665bd73f152d53b9a864daadefee)), closes [#6](https://github.com/LuckyFBB/i18n-extract/issues/6)
* 🎸 support clear unused text in locale file ([#3](https://github.com/LuckyFBB/i18n-extract/issues/3)) ([5025e83](https://github.com/LuckyFBB/i18n-extract/commit/5025e831ae7888b006c01892526d466af5e3b2bd)), closes [#2](https://github.com/LuckyFBB/i18n-extract/issues/2)
* 🎸 support fileType and sourceLocale in config.json ([#5](https://github.com/LuckyFBB/i18n-extract/issues/5)) ([270bffa](https://github.com/LuckyFBB/i18n-extract/commit/270bffaf36d3819f38a0c9e8b7e2e1723f123707)), closes [#4](https://github.com/LuckyFBB/i18n-extract/issues/4)


### Bug Fixes

* 🐛 change init locale config content by fileType ([947c8b5](https://github.com/LuckyFBB/i18n-extract/commit/947c8b53ef9cb8e41fe295aba41f3976833ef113))

## [1.2.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.1.0...v1.2.0) (2025-02-20)


### Features

* 🎸 support zh check by regex ([#1](https://github.com/LuckyFBB/i18n-extract/issues/1)) ([c244dc6](https://github.com/LuckyFBB/i18n-extract/commit/c244dc6b359af70cbd6046e3df091778c8369edf))


### Bug Fixes

* 🐛 add info for check and change judge console ([e6e7046](https://github.com/LuckyFBB/i18n-extract/commit/e6e704604a91a39b150d399c62094c917700079c))
* 🐛 change default type to ts ([3ad8cfd](https://github.com/LuckyFBB/i18n-extract/commit/3ad8cfdc3469b2f713a60c1957b13f67e782bdaa))
* 🐛 change reg not replace ([4cf4c3f](https://github.com/LuckyFBB/i18n-extract/commit/4cf4c3f5e9bbd03c1f530966bc54406d72eaaebb))
* 🐛 handle line breaks in text, perttier expression line breaks ([37a10d4](https://github.com/LuckyFBB/i18n-extract/commit/37a10d4496ffffce6252286541a47091db02d31d))
* 🐛 reserve ([297352d](https://github.com/LuckyFBB/i18n-extract/commit/297352dd194761f0ef776313a65ff7e5759eaf94))
* 🐛 use JsxText replace JsxElement ([55cd7fb](https://github.com/LuckyFBB/i18n-extract/commit/55cd7fb4a514959ecea5b0a118941c86a82ee53d))
* 🐛 zh check include string and exit when zh exist ([9584b99](https://github.com/LuckyFBB/i18n-extract/commit/9584b9966bed11c76139432f5c3185a857a75074))

## [1.1.0](https://github.com/LuckyFBB/i18n-extract/compare/v1.0.2...v1.1.0) (2025-01-15)


### Features

* 🎸 support ts/js type and use json5 to parse when ts/js ([a6a8f65](https://github.com/LuckyFBB/i18n-extract/commit/a6a8f65f12f6f277bf6d5e7b7d11d80b5bdafca9))


### Bug Fixes

* 🐛 add node_modules into excludeDir and add files ([73118e7](https://github.com/LuckyFBB/i18n-extract/commit/73118e72924417a626fcdc684c33559b856e85c5))

### [1.0.2](https://github.com/LuckyFBB/i18n-extract/compare/v1.0.1...v1.0.2) (2025-01-14)


### Bug Fixes

* 🐛 just remove /n and /s for jsx ([04a3f89](https://github.com/LuckyFBB/i18n-extract/commit/04a3f89165e366b8affe466784f872546baf46b7))

### [1.0.1](https://github.com/LuckyFBB/i18n-extract/compare/v1.0.0...v1.0.1) (2025-01-13)


### Bug Fixes

* 🐛 not remove space when write into locales ([10aa3a4](https://github.com/LuckyFBB/i18n-extract/commit/10aa3a4dc040fa4304e43606cb8a523277d5bdfb))

## 1.0.0 (2025-01-06)


### Features

* 🎸 add extract command, support pick chinese ([0a19c41](https://github.com/LuckyFBB/i18n-extract/commit/0a19c4195c353870d19b14d61b7b1b6bf0fc3eb0))
* 🎸 init project ([4fd51ad](https://github.com/LuckyFBB/i18n-extract/commit/4fd51ad71085044e5e5efdfd4d23ac469f09d50f))
* 🎸 init project ([13f12af](https://github.com/LuckyFBB/i18n-extract/commit/13f12af2fa89827cc6c3b80469a4b42f311cb0ae))
* 🎸 support i18n init ([a382b85](https://github.com/LuckyFBB/i18n-extract/commit/a382b85d056702a5e4b28c1dc4f43b83c900b61d))
* 🎸 support inquirer localesDir and extractDir ([233481e](https://github.com/LuckyFBB/i18n-extract/commit/233481eb001af99377b69700b97201c8fdcb91e8))


### Bug Fixes

* 🐛 add bin/env and add fieldKey in ast ([1c7ae99](https://github.com/LuckyFBB/i18n-extract/commit/1c7ae99e88a06251cf0b5f4cadf4f3b74efbbd24))
