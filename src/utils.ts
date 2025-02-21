import chalk from 'chalk';
import _ from 'lodash';
import slash from 'slash2';
import * as fs from 'fs';
import * as path from 'path';
import * as json5 from 'json5';

import {
    DEFAULT_CONFIG,
    DEFAULT_CONFIG_FILE,
    LOCALE_FILE_TYPES,
} from './const';

/** unicode cjk 中日韩文 范围 */
export const DOUBLE_BYTE_REGEX = /[\u4E00-\u9FFF]/g;

/**
 * @param message 需要打印的信息
 */
export const success = (message: string) => {
    console.log(chalk.green(message));
};

/**
 * @param message 需要打印的信息
 */
export const info = (message: string) => {
    console.log(chalk.gray(message));
};

/**
 * @param message 需要打印的信息
 */
export const error = (message: string) => {
    console.log(chalk.red(message));
};

/**
 * @returns 返回项目的配置项信息
 */
export const getProjectConfig = () => {
    const configFile = `${process.cwd()}/${DEFAULT_CONFIG_FILE}`;
    let default_config = DEFAULT_CONFIG;
    if (configFile && fs.existsSync(configFile)) {
        default_config = {
            ...default_config,
            ...JSON.parse(fs.readFileSync(configFile, 'utf-8')),
        };
    }
    return default_config;
};

/**
 * 返回类似 excel 头部的标识
 * @param n number
 * @returns string
 */
export const getSortKey = (n: number, extractMap = {}): string => {
    let label = '';
    let num = n;
    while (num > 0) {
        num--;
        label = String.fromCharCode((num % 26) + 65) + label;
        num = Math.floor(num / 26);
    }
    const key = `${label}`;
    if (_.get(extractMap, key)) {
        return getSortKey(n + 1, extractMap);
    }
    return key;
};

/**
 * 判断是文件夹
 * @param path
 */
export function isDirectory(path: string) {
    return fs.statSync(path).isDirectory();
}

function excludeLocaleFiles(files: string[]) {
    const langsDir = path.resolve(process.cwd(), getProjectConfig().extractDir);
    return files.filter((file) => {
        const completeFile = path.resolve(process.cwd(), file);
        return !completeFile.includes(langsDir);
    });
}

/**
 * 获取文件夹满足要求的所有文件
 * @param dir 目标文件夹
 * @param ignoreDirs 忽略的文件夹
 * @param ignoreFiles 忽略的文件
 */
export const getFilteredFiles = (
    dir: string,
    ignoreDirs: string[] = [],
    ignoreFiles: string[] = [],
): string[] => {
    const first = dir.split(',')[0];
    let files: string[] = [];
    if (isDirectory(first)) {
        const dirPath = path.resolve(process.cwd(), dir);
        files = fs
            .readdirSync(dirPath)
            .reduce((files: string[], file: string) => {
                const filePath = path.join(dirPath, file);
                const isDirectory = fs.statSync(filePath).isDirectory();
                const isFile = fs.statSync(filePath).isFile();
                const isIgnoreDirectory =
                    !!ignoreDirs.length &&
                    ignoreDirs.some((ignoreDir) =>
                        filePath.split(path.sep).join('/').includes(ignoreDir),
                    );
                const isIgnoreFile =
                    !!ignoreFiles.length &&
                    ignoreFiles.some((ignoreFile) =>
                        filePath.split(path.sep).join('/').includes(ignoreFile),
                    );
                if (isDirectory && !isIgnoreDirectory) {
                    return files.concat(
                        getFilteredFiles(filePath, ignoreDirs, ignoreFiles),
                    );
                }

                if (isFile && !isIgnoreDirectory && !isIgnoreFile) {
                    return files.concat(filePath);
                }

                return files;
            }, []);
    } else {
        files = excludeLocaleFiles(dir.split(','));
    }
    return files;
};

/**
 * 获取当前文件对应 key 值
 * @param filePath 当前文件绝对路径
 * @returns array
 */
export const generateLocaleKey = (filePath: string) => {
    const extractDir = getProjectConfig().extractDir;

    const basePath = path.resolve(process.cwd(), extractDir);

    const relativePath = path.relative(basePath, filePath);

    const names = slash(relativePath).split('/');
    const fileName = _.last(names) as any;
    let fileKey = fileName.split('.').slice(0, -1).join('.');
    const dir = names.slice(0, -1).join('.');
    if (dir) fileKey = names.slice(0, -1).concat(fileKey).join('.');
    return fileKey.replace(/-/g, '_');
};

export const setLocaleValue = (extractMap = {}, key: string, value: string) => {
    _.set(
        extractMap,
        key,
        value.replace(/\\n/gm, '\n').replace(/(?<!\n)\n(?!\n)\s+|^\n\s+/g, ''),
    );
};

/**
 * 创建或更新国际化资源文件
 * @param {string} content - 要写入的国际化内容
 */
export const updateLocaleFile = (content = '') => {
    const { localeDir, type, sourceLocale } = getProjectConfig();
    const fileType = type || LOCALE_FILE_TYPES.TS;
    const targetFilename = path.join(
        localeDir,
        `${sourceLocale}/index.${fileType}`,
    );
    const directory = path.dirname(targetFilename);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    if ([LOCALE_FILE_TYPES.TS, LOCALE_FILE_TYPES.JS].includes(fileType)) {
        fs.writeFileSync(targetFilename, `export default ${content}`, 'utf8');
        return;
    }

    fs.writeFileSync(targetFilename, content, 'utf8');
};

/**
 * 解析 locale 文件
 * @param targetFilename string
 * @param fileType string
 * @returns Record<string, any>
 */
export const parseLocaleFile = (targetFilename: string, fileType: string) => {
    let extractMap = {};
    if (fs.existsSync(targetFilename)) {
        const content = fs.readFileSync(targetFilename, 'utf-8') ?? '{}';
        if (['ts', 'js'].includes(fileType)) {
            const modifiedContent = content.replace(
                /^export default\s*({[\s\S]*})\s*;?/,
                '$1',
            );
            extractMap = json5.parse(modifiedContent);
        } else {
            extractMap = JSON.parse(content);
        }
    }
    return extractMap;
};
