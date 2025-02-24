import * as path from 'path';
import * as fs from 'fs';
import _ from 'lodash';
import { parse, ParserOptions } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';

import {
    generateLocaleKey,
    getFilteredFiles,
    getProjectConfig,
    getSubDirectories,
    parseLocaleModule,
    success,
    updateLocaleContent,
} from '../utils';

const {
    importStatement,
    type,
    localeDir,
    extractDir,
    excludeDir,
    excludeFile,
} = getProjectConfig();

const importVariable = importStatement
    .replace(/^import\s+|\s+from\s+/g, ',')
    .split(',')?.[1];

const extractI18nFromScript = (
    fileName: string,
    extractMap: Record<string, any>,
) => {
    const sourceCode = fs.readFileSync(fileName, 'utf-8');
    const plugins: ParserOptions['plugins'] = [
        'decorators-legacy',
        'typescript',
    ];
    if (fileName.endsWith('jsx') || fileName.endsWith('tsx')) {
        plugins.push('jsx');
    }
    const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins,
    });

    const fileKey = generateLocaleKey(fileName);
    const currObj = _.get(extractMap, fileKey);
    if (!currObj) return 0;
    const keySet = new Set<string>();

    babelTraverse(ast, {
        Program: {
            enter(path) {
                const hasImport = path.node.body.some((node) => {
                    if (babelTypes.isImportDeclaration(node)) {
                        return node.specifiers.some(
                            (spec) =>
                                babelTypes.isImportDefaultSpecifier(spec) &&
                                spec.local.name === importVariable,
                        );
                    }
                    return false;
                });
                if (!hasImport) {
                    path.stop();
                }
            },
            exit() {},
        },
        MemberExpression(path) {
            let node = path.node;
            const identifiers = [];
            while (babelTypes.isMemberExpression(node)) {
                identifiers.unshift(
                    (node.property as babelTypes.Identifier).name,
                );
                node = node.object as babelTypes.MemberExpression;
            }
            if (babelTypes.isIdentifier(node)) {
                identifiers.unshift((node as babelTypes.Identifier).name);
            }
            if (identifiers.at(0) === importVariable) {
                keySet.add(identifiers[identifiers.length - 1]);
            }
            path.skip();
        },
    });

    const newObj: Record<string, any> = {};
    keySet.forEach((key) => {
        newObj[key] = currObj[key];
    });
    _.set(extractMap, fileKey, newObj);

    const amount = Object.keys(currObj).length - Object.keys(newObj).length;
    return amount;
};

const extractI18nByFileType = (
    fileName: string,
    extractMap: Record<string, any>,
) => {
    if (['.js', '.ts', '.jsx', '.tsx'].some((ext) => fileName.endsWith(ext))) {
        return extractI18nFromScript(fileName, extractMap);
    }
    return 0;
};

const clear = async () => {
    const allFiles = getFilteredFiles(extractDir, excludeDir, excludeFile);
    const subDirs = await getSubDirectories(localeDir);

    subDirs.map((lang) => {
        const filePath = path.join(localeDir, `${lang}/index.${type}`);
        parseLocaleModule(filePath).then((extractMap) => {
            const amount = allFiles.reduce((amount, file) => {
                try {
                    const curr = extractI18nByFileType(file, extractMap);
                    return amount + curr;
                } catch (error: any) {
                    updateLocaleContent(extractMap, filePath);
                    throw new Error(
                        `${filePath} 移除文案失败, ${error.message}`,
                    );
                }
            }, 0);
            success(`${filePath} 共移除${amount}个文案！`);
            updateLocaleContent(extractMap, filePath);
        });
    });
};

export default clear;
