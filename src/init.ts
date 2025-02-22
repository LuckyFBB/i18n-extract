import * as path from 'path';
import * as fs from 'fs';
import { input, select } from '@inquirer/prompts';

import {
    DEFAULT_CONFIG,
    DEFAULT_CONFIG_FILE,
    LOCALE_FILE_TYPES,
} from './const';
import { success, error } from './utils';

interface InitOptions {
    localeDir: string;
    extractDir: string;
    type: LOCALE_FILE_TYPES;
    sourceLocale: string;
}

const createDefaultConfig = ({
    localeDir,
    extractDir,
    sourceLocale,
    type,
}: InitOptions) => {
    const configFile = path.resolve(process.cwd(), `${DEFAULT_CONFIG_FILE}`);
    const config = JSON.stringify(
        { ...DEFAULT_CONFIG, localeDir, extractDir, sourceLocale, type },
        null,
        4,
    );

    if (!fs.existsSync(configFile)) {
        fs.writeFile(configFile, config, (err) => {
            if (err) {
                error('创建 i18n.config.json 失败');
                return;
            }
            success('创建 i18n.config.json 成功');
        });
    }
};

const createLocaleFile = ({
    localeDir,
    sourceLocale,
    type,
}: Omit<InitOptions, 'extractDir'>) => {
    const fileDir = `${localeDir}/${sourceLocale}`;
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
        fs.writeFile(`${fileDir}/index.${type}`, '{}', (err) => {
            if (err) {
                error('创建国际化文件失败');
                return;
            }
            success('创建国际化文件成功');
        });
    }
};

const init = async () => {
    const localeDir = await input({
        default: DEFAULT_CONFIG.localeDir,
        message: '请输入国际化文件夹',
    });
    const extractDir = await input({
        default: DEFAULT_CONFIG.extractDir,
        message: '请输入提取中文的文件夹',
    });
    const sourceLocale = await input({
        default: DEFAULT_CONFIG.sourceLocale,
        message: '请输入源语言',
    });
    const type = await select({
        message: '请选择语言文件类型',
        default: LOCALE_FILE_TYPES.TS,
        choices: [
            { name: 'ts', value: LOCALE_FILE_TYPES.TS },
            { name: 'js', value: LOCALE_FILE_TYPES.JS },
            { name: 'json', value: LOCALE_FILE_TYPES.JSON },
        ],
    });

    const createLocaleDir = localeDir || DEFAULT_CONFIG.localeDir;
    const createExtractDir = extractDir || DEFAULT_CONFIG.extractDir;
    if (!fs.existsSync(createLocaleDir)) {
        fs.mkdirSync(createLocaleDir);
    }
    createLocaleFile({ localeDir: createLocaleDir, sourceLocale, type });
    createDefaultConfig({
        localeDir: createLocaleDir,
        extractDir: createExtractDir,
        sourceLocale,
        type,
    });
};

export default init;
