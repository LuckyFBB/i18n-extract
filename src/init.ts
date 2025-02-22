import * as path from 'path';
import * as fs from 'fs';

import { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE } from './const';
import { success, error } from './utils';

const createDefaultConfig = (localeDir: string, extractDir: string) => {
    const configFile = path.resolve(process.cwd(), `${DEFAULT_CONFIG_FILE}`);
    const config = JSON.stringify(
        { ...DEFAULT_CONFIG, localeDir, extractDir },
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

const createLocaleFile = (localeDir: string) => {
    const fileDir = `${localeDir}/zh-CN`;
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
        fs.writeFile(`${fileDir}/index.json`, '{}', (err) => {
            if (err) {
                error('创建国际化文件失败');
                return;
            }
            success('创建国际化文件成功');
        });
    }
};

const init = (localeDir: string, extractDir: string) => {
    const createLocaleDir = localeDir || DEFAULT_CONFIG.localeDir;
    const createExtractDir = extractDir || DEFAULT_CONFIG.extractDir;
    if (!fs.existsSync(createLocaleDir)) {
        fs.mkdirSync(createLocaleDir);
    }
    createLocaleFile(createLocaleDir);
    createDefaultConfig(createLocaleDir, createExtractDir);
};

export default init;
