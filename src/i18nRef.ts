import { parse, ParserOptions } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import generate from '@babel/generator';
import _ from 'lodash';

import { generateLocaleKey, getProjectConfig } from './utils';

export type InlineMode = 'all' | 'invalid-only';

export interface InvalidI18nRef {
    line: number;
    actualRef: string;
    expectedPrefix: string;
}

export interface InlineResult {
    inlinedCount: number;
    notFoundKeys: string[];
    /** 文件里是否还有没能内联的 I18N 引用残留 */
    hasRemainingRefs: boolean;
    unsupportedCalls: Array<{ line: number; key: string }>;
    /** I18N 的 import 语句是否被删除 */
    importRemoved: boolean;
}

const getImportVariable = (): string => {
    const { importStatement } = getProjectConfig();
    return importStatement
        .replace(/^import\s+|\s+from\s+/g, ',')
        .split(',')?.[1];
};

export const getInvalidI18nRefs = (
    filePath: string,
    content: string,
): InvalidI18nRef[] => {
    const importVariable = getImportVariable();
    const fileKey = generateLocaleKey(filePath);
    const expectedSegments = [importVariable, ...fileKey.split('.')];
    const expectedPrefix = `${expectedSegments.join('.')}.`;
    const invalidRefs: InvalidI18nRef[] = [];
    const lines = content.split('\n');
    const plugins: ParserOptions['plugins'] = [
        'decorators-legacy',
        'typescript',
    ];

    if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
        plugins.push('jsx');
    }

    let ast;
    try {
        ast = parse(content, {
            sourceType: 'module',
            plugins,
        });
    } catch {
        return [];
    }

    babelTraverse(ast, {
        MemberExpression(path) {
            if (
                babelTypes.isMemberExpression(path.parentPath?.node) &&
                path.parentPath.node.object === path.node
            ) {
                return;
            }

            const nodeLine = path.node.loc?.start.line;
            if (nodeLine) {
                const prevLine = lines[nodeLine - 2] ?? '';
                if (
                    prevLine.includes('// @i18n-ignore') ||
                    prevLine.includes('/* @i18n-ignore') ||
                    prevLine.includes('{/* @i18n-ignore')
                ) {
                    return;
                }
            }

            if (path.node.computed) return;

            const segments: string[] = [];
            let current: babelTypes.MemberExpression | babelTypes.Expression =
                path.node;

            while (babelTypes.isMemberExpression(current)) {
                if (
                    current.computed ||
                    !babelTypes.isIdentifier(current.property)
                ) {
                    return;
                }
                segments.unshift(current.property.name);
                current = current.object;
            }

            if (!babelTypes.isIdentifier(current)) return;
            segments.unshift(current.name);

            if (segments[0] !== importVariable) return;

            // 排除 [importVariable].get() 这种情况
            if (
                segments[1] === 'get' &&
                babelTypes.isCallExpression(path.parentPath?.node) &&
                path.parentPath.node.callee === path.node
            ) {
                return;
            }

            const isMatchedPrefix = expectedSegments.every(
                (segment, index) => segments[index] === segment,
            );
            if (isMatchedPrefix) return;

            invalidRefs.push({
                line: nodeLine ?? 0,
                actualRef: segments.join('.'),
                expectedPrefix,
            });
        },
    });

    return invalidRefs;
};

const getIdentifiers = (node: babelTypes.MemberExpression): string[] => {
    const identifiers: string[] = [];
    let current: babelTypes.Node = node;
    while (babelTypes.isMemberExpression(current)) {
        identifiers.unshift((current.property as babelTypes.Identifier).name);
        current = current.object;
    }
    if (babelTypes.isIdentifier(current)) {
        identifiers.unshift((current as babelTypes.Identifier).name);
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
        declaration?.type === 'VariableDeclaration' &&
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

export const inlineI18nReferences = (
    ast: babelTypes.File,
    extractMap: Record<string, any>,
    filePath: string,
    mode: InlineMode,
    sourceCode: string,
): InlineResult => {
    const importVariable = getImportVariable();
    const lines = sourceCode.split('\n');
    let inlinedCount = 0;
    const notFoundKeys: string[] = [];
    let hasRemainingRefs = false;
    const unsupportedCalls: Array<{ line: number; key: string }> = [];
    let importRemoved = false;

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
                if (!hasRemainingRefs) {
                    const originalLength = path.node.body.length;
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
                    if (path.node.body.length !== originalLength) {
                        importRemoved = true;
                    }
                }
            },
        },
        MemberExpression(path) {
            if (
                babelTypes.isMemberExpression(path.parentPath?.node) &&
                path.parentPath.node.object === path.node
            ) {
                return;
            }

            const node = path.node;
            const identifiers = getIdentifiers(node);
            if (identifiers[0] !== importVariable) return;

            if (
                identifiers[1] === 'get' &&
                babelTypes.isCallExpression(path.parentPath?.node) &&
                path.parentPath.node.callee === path.node
            ) {
                return;
            }

            const fullKey = identifiers.slice(1).join('.');

            if (mode === 'invalid-only') {
                const fileKey = generateLocaleKey(filePath);
                const expectedSegments = [
                    importVariable,
                    ...fileKey.split('.'),
                ];
                const isValid = expectedSegments.every(
                    (seg, i) => identifiers[i] === seg,
                );
                if (isValid) {
                    hasRemainingRefs = true;
                    return;
                }
                const nodeLine = node.loc?.start.line;
                if (nodeLine) {
                    const prevLine = lines[nodeLine - 2] ?? '';
                    if (
                        prevLine.includes('// @i18n-ignore') ||
                        prevLine.includes('/* @i18n-ignore') ||
                        prevLine.includes('{/* @i18n-ignore')
                    ) {
                        hasRemainingRefs = true;
                        return;
                    }
                }
            }

            const localText = _.get(extractMap, fullKey);
            if (localText) {
                path.replaceWith(babelTypes.stringLiteral(localText));
                inlinedCount++;
            } else {
                notFoundKeys.push(fullKey);
                hasRemainingRefs = true;
            }
        },
        CallExpression(path) {
            if (!babelTypes.isMemberExpression(path.node.callee)) return;
            const identifiers = getIdentifiers(path.node.callee);
            if (
                !(identifiers[0] === importVariable && identifiers[1] === 'get')
            ) {
                return;
            }

            const [keyPath, params] = path.node.arguments;
            if (!babelTypes.isMemberExpression(keyPath)) return;

            const keyIdentifiers = getIdentifiers(keyPath);
            const fullKey = keyIdentifiers.slice(1).join('.');

            if (mode === 'invalid-only') {
                const fileKey = generateLocaleKey(filePath);
                const expectedSegments = [
                    importVariable,
                    ...fileKey.split('.'),
                ];
                const isValid = expectedSegments.every(
                    (seg, i) => keyIdentifiers[i] === seg,
                );
                if (isValid) {
                    hasRemainingRefs = true;
                    return;
                }
                const nodeLine = path.node.loc?.start.line;
                if (nodeLine) {
                    const prevLine = lines[nodeLine - 2] ?? '';
                    if (
                        prevLine.includes('// @i18n-ignore') ||
                        prevLine.includes('/* @i18n-ignore') ||
                        prevLine.includes('{/* @i18n-ignore')
                    ) {
                        hasRemainingRefs = true;
                        return;
                    }
                }
            }

            const localText = _.get(extractMap, fullKey);
            if (!localText) {
                notFoundKeys.push(fullKey);
                hasRemainingRefs = true;
                return;
            }

            if (
                babelTypes.isObjectExpression(params) &&
                params.properties.some(
                    (p) =>
                        babelTypes.isObjectProperty(p) &&
                        (babelTypes.isArrowFunctionExpression(p.value) ||
                            babelTypes.isFunctionExpression(p.value)),
                )
            ) {
                unsupportedCalls.push({
                    line: path.node.loc?.start.line ?? 0,
                    key: fullKey,
                });
                hasRemainingRefs = true;
                path.skip();
                return;
            }

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
                    babelTypes.templateElement({ raw: '', cooked: '' }, true),
                );
            }

            const templateLiteral = babelTypes.templateLiteral(
                quasis,
                expressions,
            );
            path.replaceWith(templateLiteral);
            inlinedCount++;
        },
    });

    return {
        inlinedCount,
        notFoundKeys,
        hasRemainingRefs,
        unsupportedCalls,
        importRemoved,
    };
};
