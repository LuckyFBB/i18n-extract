import * as path from 'path';
import * as fs from 'fs';
import _ from 'lodash';
import { parse, ParserOptions } from '@babel/parser';
import babelTraverse, { NodePath } from '@babel/traverse';
import * as babelTypes from '@babel/types';
import generate from '@babel/generator';

import {
    generateLocaleKey,
    getFilteredFiles,
    getProjectConfig,
    getSubDirectories,
    parseLocaleModule,
} from '../utils';

const {
    importStatement,
    type,
    sourceLocale,
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

    const getIdentifiers = (node: babelTypes.MemberExpression) => {
        const identifiers = [];
        while (babelTypes.isMemberExpression(node)) {
            identifiers.unshift((node.property as babelTypes.Identifier).name);
            node = node.object as babelTypes.MemberExpression;
        }
        if (babelTypes.isIdentifier(node)) {
            identifiers.unshift((node as babelTypes.Identifier).name);
        }
        return identifiers;
    };

    const extractObjectValuesFromCode = (code: string): string[] => {
        const ast = parse(`const x = ${code}`, {
            sourceType: 'module',
            plugins: ['typescript'],
        });
        const values: string[] = [];
        const declaration = ast.program.body[0];
        if (
            declaration.type === 'VariableDeclaration' &&
            declaration.declarations[0].init?.type === 'ObjectExpression'
        ) {
            const obj = declaration.declarations[0].init;
            for (const prop of obj.properties) {
                if (babelTypes.isObjectProperty(prop)) {
                    const valCode = generate(prop.value).code;
                    values.push(valCode);
                }
            }
        }
        return values;
    };
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
            },
        },
        MemberExpression(path) {
            let node = path.node;
            const identifiers = getIdentifiers(node);
            if (identifiers[0] !== 'I18N') return;

            const fullKey = identifiers.slice(1).join('.');
            const localText = _.get(extractMap, fullKey);
            if (localText) {
                path.replaceWith(babelTypes.stringLiteral(localText));
            }
        },
        CallExpression(path) {
            if (babelTypes.isMemberExpression(path.node.callee)) {
                const identifiers = getIdentifiers(path.node.callee);

                if (!(identifiers[0] == 'I18N' && identifiers[1] == 'get'))
                    return;
                const [keyPath, params] = path.node.arguments;
                const keyIdentifiers = getIdentifiers(
                    keyPath as babelTypes.MemberExpression,
                );
                const fullKey = keyIdentifiers.slice(1).join('.');
                const localText = _.get(extractMap, fullKey);
                const code = generate(params).code;
                const values = extractObjectValuesFromCode(code);
                const textParts: string[] = localText.split(/(\{[^}]+\})/);
                const quasis: babelTypes.TemplateElement[] = [];
                const expressions: babelTypes.Expression[] = [];

                let valueIndex = 0;
                textParts.forEach((part) => {
                    if (part.match(/^\{[^}]+\}$/)) {
                        if (valueIndex < values.length) {
                            expressions.push(
                                babelTypes.identifier(values[valueIndex]),
                            );
                            valueIndex++;
                        }
                    } else {
                        quasis.push(
                            babelTypes.templateElement(
                                { raw: part, cooked: part },
                                valueIndex >= values.length,
                            ),
                        );
                    }
                });

                if (quasis.length <= expressions.length) {
                    quasis.push(
                        babelTypes.templateElement(
                            { raw: '', cooked: '' },
                            true,
                        ),
                    );
                }

                const templateLiteral = babelTypes.templateLiteral(
                    quasis,
                    expressions,
                );
                path.replaceWith(templateLiteral);
            }
        },
    });

    const { code } = generate(ast, {
        retainLines: true,
        comments: true,
        jsescOption: {
            minimal: true,
        },
    });
    fs.writeFileSync(fileName, code);
};

const extractI18nByFileType = (
    fileName: string,
    extractMap: Record<string, any>,
) => {
    if (['.js', '.ts', '.jsx', '.tsx'].some((ext) => fileName.endsWith(ext))) {
        extractI18nFromScript(fileName, extractMap);
    }
};

const toLocal = async () => {
    const allFiles = getFilteredFiles(extractDir, excludeDir, excludeFile);
    const subDirs = await getSubDirectories(localeDir);

    const currentLocale = subDirs.find((dir) => dir === sourceLocale);
    const localeFile = path.join(localeDir, `${currentLocale}/index.${type}`);

    parseLocaleModule(localeFile).then((extractMap) => {
        allFiles
            .filter((file) => _.has(extractMap, generateLocaleKey(file)))
            .forEach((file) => {
                extractI18nByFileType(file, extractMap);
            });
    });
};

export default toLocal;
