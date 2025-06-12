import chalk from 'chalk';
import _ from 'lodash';
import slash from 'slash2';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as babelTypes from '@babel/types';
import generate from '@babel/generator';

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
 * 将对象转换为 AST 节点
 * @param obj 要转换的对象
 * @returns AST 节点
 */
export const objectToAst = (
    obj: Record<string, any> | string,
): babelTypes.ObjectExpression => {
    const data = typeof obj === 'string' ? JSON.parse(obj) : obj;
    const properties = Object.entries(data).map(([key, value]) => {
        let valueNode: babelTypes.Expression;
        if (value && typeof value === 'object') {
            valueNode = objectToAst(value);
        } else if (typeof value === 'string') {
            valueNode = babelTypes.stringLiteral(value);
        } else {
            valueNode = babelTypes.valueToNode(value);
        }
        return babelTypes.objectProperty(
            babelTypes.stringLiteral(key),
            valueNode,
        );
    });

    return babelTypes.objectExpression(properties);
};

/**
 * 创建或更新国际化资源文件
 * @param {string} content - 要写入的国际化内容
 */
export const updateLocaleContent = (
    content: Record<string, any>,
    filePath?: string,
) => {
    const { localeDir, type, sourceLocale } = getProjectConfig();
    const targetFilename =
        filePath || path.join(localeDir, `${sourceLocale}/index.${type}`);
    const directory = path.dirname(targetFilename);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    if ([LOCALE_FILE_TYPES.TS, LOCALE_FILE_TYPES.JS].includes(type)) {
        const newAst = objectToAst(content);

        const sourceCode = fs.readFileSync(targetFilename, 'utf-8');
        const ast = parse(sourceCode, {
            sourceType: 'module',
            plugins: type === LOCALE_FILE_TYPES.TS ? ['typescript'] : [],
        });

        let exportedIdentifier: string | null = null;

        traverse(ast, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                if (babelTypes.isIdentifier(declaration)) {
                    exportedIdentifier = declaration.name;
                }
                if (babelTypes.isObjectExpression(declaration)) {
                    path.node.declaration = newAst;
                }
                path.stop();
            },
        });

        if (exportedIdentifier) {
            traverse(ast, {
                VariableDeclarator(path) {
                    if (
                        babelTypes.isIdentifier(path.node.id) &&
                        path.node.id.name === exportedIdentifier
                    ) {
                        path.node.init = newAst;
                        path.stop();
                    }
                },
            });
        }

        const { code } = generate(ast, {
            jsescOption: {
                minimal: true,
            },
        });
        fs.writeFileSync(targetFilename, code, 'utf8');
        return;
    }

    fs.writeFileSync(targetFilename, JSON.stringify(content, null, 4), 'utf8');
};

/**
 * 获取语言目录下的所有语言文件夹
 * @param directoryPath 语言目录路径
 * @returns 返回语言文件夹数组，如 ['zh-CN', 'en-US']
 */
export const getSubDirectories = async (
    directoryPath: string,
): Promise<string[]> => {
    if (!fs.existsSync(directoryPath)) {
        return Promise.reject(`不存在 ${directoryPath} 文件夹`);
    }
    return fs
        .readdirSync(directoryPath)
        .filter((name) =>
            fs.statSync(path.join(directoryPath, name)).isDirectory(),
        );
};

/**
 * 解析语言模块文件并提取导出的对象
 * @param filePath 语言模块文件路径
 * @returns Record<string, any> 返回模块中导出的语言键值对对象
 */
export const parseLocaleModule = (filePath: string) => {
    const { type } = getProjectConfig();
    let exportData: Record<string, any> = {};
    if (!fs.existsSync(filePath)) {
        error(`${filePath} 文件不存在`);
        return Promise.reject();
    }

    const content = fs.readFileSync(filePath, 'utf-8') ?? '{}';
    if ([LOCALE_FILE_TYPES.JS, LOCALE_FILE_TYPES.TS].includes(type)) {
        const code = fs.readFileSync(filePath, 'utf-8');
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript'],
        });
        let exportIdentifier: string = '';
        traverse(ast, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                if (babelTypes.isIdentifier(declaration)) {
                    exportIdentifier = declaration.name;
                }
                if (babelTypes.isObjectExpression(declaration)) {
                    exportData = eval(
                        `(${code.slice(declaration.start ?? 0, declaration.end ?? 0)})`,
                    );
                }
            },
        });
        if (!exportIdentifier && !exportData) {
            return Promise.reject(`解析${filePath}文件失败`);
        }
        traverse(ast, {
            VariableDeclarator(path) {
                if (
                    path.node.id.type === 'Identifier' &&
                    path.node.id.name === exportIdentifier
                ) {
                    if (
                        path.node.init &&
                        path.node.init.type === 'ObjectExpression'
                    ) {
                        exportData = eval(
                            `(${code.slice(path.node.init.start ?? 0, path.node.init.end ?? 0)})`,
                        );
                    }
                }
            },
        });
    } else {
        exportData = JSON.parse(content);
    }

    return Promise.resolve(exportData);
};

/**
 * 获取对象的叶子节点数
 * @param obj 对象
 * @returns number
 */
export const getObjectLeafCount = (obj: Record<string, any>): number =>
    _.isObject(obj) ? _.sum(_.map(obj, getObjectLeafCount)) : 1;

/**
 * 检查节点是否应该被忽略（通过 @i18n-ignore 注释）
 */
export const shouldIgnoreNode = (
    path: NodePath,
    sourceCode: string,
): boolean => {
    const { node } = path;

    // 检查当前节点的前置注释
    if (node.leadingComments) {
        const hasIgnoreComment = node.leadingComments.some(
            (comment: any) => comment.value.trim() === '@i18n-ignore',
        );
        if (hasIgnoreComment) return true;
    }

    // 检查父节点的前置注释（处理某些语法结构，如变量声明）
    let currentPath = path.parentPath;
    while (currentPath) {
        const parentNode = currentPath.node;
        if (parentNode.leadingComments) {
            const hasIgnoreComment = parentNode.leadingComments.some(
                (comment: any) => comment.value.trim() === '@i18n-ignore',
            );
            if (hasIgnoreComment) return true;
        }

        // 只检查直接相关的父节点，避免过度检查
        if (
            babelTypes.isVariableDeclarator(parentNode) ||
            babelTypes.isVariableDeclaration(parentNode) ||
            babelTypes.isObjectProperty(parentNode) ||
            babelTypes.isObjectExpression(parentNode) ||
            babelTypes.isJSXElement(parentNode) ||
            babelTypes.isSpreadElement(parentNode) ||
            babelTypes.isArrayExpression(parentNode) ||
            babelTypes.isCallExpression(parentNode)
        ) {
            currentPath = currentPath.parentPath;
        } else {
            break;
        }
    }

    const lines = sourceCode.split('\n');

    // 特殊处理JSX文本节点：检查前一个兄弟节点是否包含 @i18n-ignore 的JSX注释
    if (babelTypes.isJSXText(node)) {
        const prevSibling = path.getPrevSibling();
        if (
            prevSibling &&
            babelTypes.isJSXExpressionContainer(prevSibling.node)
        ) {
            const expression = prevSibling.node.expression;
            if (babelTypes.isJSXEmptyExpression(expression)) {
                const prevSiblingLine = prevSibling.node.loc?.start.line;
                if (sourceCode && prevSiblingLine) {
                    const commentLineIndex = prevSiblingLine - 1;
                    if (commentLineIndex >= 0) {
                        const commentLine = lines[commentLineIndex];
                        if (
                            commentLine &&
                            commentLine.includes('@i18n-ignore')
                        ) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    // 检查上一行是否包含 @i18n-ignore 注释
    const nodeLine = node.loc?.start.line;
    if (sourceCode && nodeLine) {
        const previousLineIndex = nodeLine - 2; // 行号从1开始

        if (previousLineIndex >= 0) {
            const previousLine = lines[previousLineIndex];
            if (
                previousLine &&
                (previousLine.includes('// @i18n-ignore') ||
                    previousLine.includes('/* @i18n-ignore') ||
                    previousLine.includes('{/* @i18n-ignore'))
            ) {
                return true;
            }
        }
    }

    return false;
};

/**
 * 递归合并两个语言包对象，保持目标对象中已有的翻译不变，只添加新的 key
 * @param {Object} source - 源语言包对象，包含所有需要同步的 key
 * @param {Object} target - 目标语言包对象，需要同步新 key 的对象
 */
export const mergeLocaleMap = (source: any, target: any) => {
    Object.keys(source).forEach((key) => {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) {
                target[key] = {};
            }
            mergeLocaleMap(source[key], target[key]);
        } else {
            if (!target[key]) {
                target[key] = source[key];
            }
        }
    });
};
