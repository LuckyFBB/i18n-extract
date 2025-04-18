import * as path from 'path';
import * as fs from 'fs';
import _ from 'lodash';
import { parse, ParserOptions } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import generate from '@babel/generator';

import {
    generateLocaleKey,
    getFilteredFiles,
    getObjectLeafCount,
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
    let removeI18N = false;

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
            exit(path) {
                removeI18N =
                    keySet.size === 0 &&
                    keySet.size !== Object.keys(currObj).length;
                if (removeI18N) {
                    path.node.body = path.node.body.filter((node) => {
                        if (babelTypes.isImportDeclaration(node)) {
                            return !node.specifiers.some(
                                (spec) =>
                                    babelTypes.isImportDefaultSpecifier(spec) &&
                                    spec.local.name === importVariable,
                            );
                        }
                        return true;
                    });
                }
            },
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
            if (
                identifiers.at(0) === importVariable &&
                !(
                    identifiers.at(1) === 'get' &&
                    babelTypes.isCallExpression(path.parentPath.node)
                )
            ) {
                keySet.add(identifiers[identifiers.length - 1]);
                path.skip();
            }
        },
    });

    Object.keys(currObj).forEach((key) => {
        if (!keySet.has(key)) {
            delete currObj[key];
        }
    });

    if (_.isEmpty(currObj)) {
        let currKey = fileKey;
        do {
            _.unset(extractMap, currKey);
            currKey = currKey.split('.').slice(0, -1).join('.');
        } while (currKey && _.isEmpty(_.get(extractMap, currKey)));
    } else {
        _.set(extractMap, fileKey, currObj);
    }

    if (removeI18N) {
        const { code } = generate(ast, {
            retainLines: true,
            comments: true,
        });
        fs.writeFileSync(fileName, code);
    }
};

const extractI18nByFileType = (
    fileName: string,
    extractMap: Record<string, any>,
) => {
    if (['.js', '.ts', '.jsx', '.tsx'].some((ext) => fileName.endsWith(ext))) {
        extractI18nFromScript(fileName, extractMap);
    }
};

const clear = async () => {
    const allFiles = getFilteredFiles(extractDir, excludeDir, excludeFile);
    const subDirs = await getSubDirectories(localeDir);

    subDirs.map((lang) => {
        const filePath = path.join(localeDir, `${lang}/index.${type}`);
        parseLocaleModule(filePath).then((extractMap) => {
            const newExtractMap: Record<string, any> = {};
            allFiles
                .filter((file) => _.has(extractMap, generateLocaleKey(file)))
                .forEach((file) => {
                    const fileKey = generateLocaleKey(file);
                    _.set(newExtractMap, fileKey, _.get(extractMap, fileKey));
                    try {
                        extractI18nByFileType(file, newExtractMap);
                    } catch (error: any) {
                        updateLocaleContent(newExtractMap, filePath);
                        throw new Error(
                            `${filePath} 移除文案失败, ${error.message}`,
                        );
                    }
                });
            const amount =
                getObjectLeafCount(extractMap) -
                getObjectLeafCount(newExtractMap);
            success(`${filePath} 共移除${amount}个文案！`);
            updateLocaleContent(newExtractMap, filePath);
        });
    });
};

export default clear;
