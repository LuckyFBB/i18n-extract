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
    parseLocaleFile,
    success,
    updateLocaleFile,
} from '../utils';

const projectConfig = getProjectConfig();

const importStatement = projectConfig.importStatement;

const importVariable = importStatement
    .replace(/^import\s+|\s+from\s+/g, ',')
    .split(',')?.[1];

const processI18nKeys = (fileName: string, extractMap: Record<string, any>) => {
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

const processSourceFile = (
    fileName: string,
    extractMap: Record<string, any>,
) => {
    if (
        fileName.endsWith('.js') ||
        fileName.endsWith('.ts') ||
        fileName.endsWith('.jsx') ||
        fileName.endsWith('.tsx')
    ) {
        return processI18nKeys(fileName, extractMap);
    }
    return 0;
};

const clear = () => {
    const fileType = projectConfig.type || 'ts';
    const targetFilename = path.join(
        projectConfig.localeDir,
        `${projectConfig.sourceLocale}/index.${fileType}`,
    );
    const extractMap = parseLocaleFile(targetFilename, fileType);
    const allFiles = getFilteredFiles(
        projectConfig.extractDir,
        projectConfig.excludeDir,
        projectConfig.excludeFile,
    );

    const amount = allFiles.reduce((amount, file) => {
        try {
            const curr = processSourceFile(file, extractMap);
            return amount + curr;
        } catch (error: any) {
            updateLocaleFile(`${JSON.stringify(extractMap, null, 4)}`);
            throw new Error(`${file} 移除文案失败, ${error.message}`);
        }
    }, 0);
    success(`共移除${amount}个文案！`);
    updateLocaleFile(`${JSON.stringify(extractMap, null, 4)}`);
};

export default clear;
