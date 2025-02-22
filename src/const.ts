export enum LOCALE_FILE_TYPES {
    TS = 'ts',
    JS = 'js',
    JSON = 'json',
}

export const SOURCE_LOCALE = 'zh-CN';

export const DEFAULT_CONFIG_FILE = 'i18n.config.json';

export const DEFAULT_CONFIG = {
    localeDir: './locales',
    extractDir: './',
    importStatement: 'import I18N from @/utils/i18n',
    excludeFile: [],
    excludeDir: ['node_modules', 'locales'],
    type: LOCALE_FILE_TYPES.TS,
    sourceLocale: SOURCE_LOCALE,
};
