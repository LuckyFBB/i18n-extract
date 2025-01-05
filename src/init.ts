import * as path from 'path';
import * as fs from 'fs';

import { DEFAULT_CONFIG, DEFAULT_CONFIG_FILE } from './const';
import { successLog, errorLog } from './utils';

const createDefaultConfig = () => {
    const configFile = path.resolve(process.cwd(), `${DEFAULT_CONFIG_FILE}`);
    const config = JSON.stringify({ ...DEFAULT_CONFIG }, null, 4);

    if (!fs.existsSync(configFile)) {
        fs.writeFile(configFile, config, (err) => {
            if (err) {
                errorLog('创建 i18n.config.json 失败');
                return;
            }
            successLog('创建 i18n.config.json 成功');
        });
    }
};

const createLocaleFile = () => {
    const fileDir = `${DEFAULT_CONFIG.localeDir}/zh-CN`;
    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir);
        fs.writeFile(`${fileDir}/index.json`, '{}', (err) => {
            if (err) {
                errorLog('创建国际化文件失败');
                return;
            }
            successLog('创建国际化文件成功');
        });
    }
};

const init = () => {
    if (!fs.existsSync(DEFAULT_CONFIG.localeDir)) {
        fs.mkdirSync(DEFAULT_CONFIG.localeDir);
    }
    createLocaleFile();
    createDefaultConfig();
};

export default init;
