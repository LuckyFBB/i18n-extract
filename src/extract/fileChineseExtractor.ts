import * as fs from 'fs';
import { parse, ParserOptions } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import generate from '@babel/generator';
import template from '@babel/template';
import _ from 'lodash';

import {
    DOUBLE_BYTE_REGEX,
    errorLog,
    getFileKey,
    getProjectConfig,
    getSortKey,
    setObj,
} from '../utils';

const projectConfig = getProjectConfig();

const jsChineseExtractor = (fileName: string, extractMap: any) => {
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

    const fileKey = getFileKey(fileName);

    const obj: {} = _.get(extractMap, fileKey) ?? {};
    let haveMoreTemplate = false;
    let count = 0;
    babelTraverse(ast, {
        StringLiteral(path) {
            const { node } = path;
            const { value } = node;
            if (
                !value.match(DOUBLE_BYTE_REGEX) ||
                (babelTypes.isCallExpression(path.parent) &&
                    babelTypes.isMemberExpression(path.parent.callee) &&
                    babelTypes.isIdentifier(path.parent.callee.object, {
                        name: 'console',
                    }))
            ) {
                return;
            }
            count++;
            const key = getSortKey(count, obj);
            setObj(obj, key, value);
            path.replaceWithMultiple(template.ast(`I18N.${fileKey}.${key}`));
        },
        TemplateLiteral(path) {
            const { node } = path;
            const { start, end } = node;
            if (!start || !end) return;
            let templateContent = sourceCode.slice(start + 1, end - 1);
            if (
                !templateContent.match(DOUBLE_BYTE_REGEX) ||
                (babelTypes.isCallExpression(path.parent) &&
                    babelTypes.isMemberExpression(path.parent.callee) &&
                    babelTypes.isIdentifier(path.parent.callee.object, {
                        name: 'console',
                    })) ||
                babelTypes.isTaggedTemplateExpression(path.parent)
            ) {
                return;
            }
            if (!node.expressions.length) {
                count++;
                const key = getSortKey(count, obj);
                setObj(obj, key, templateContent);
                path.replaceWithMultiple(
                    template.ast(`I18N.${fileKey}.${key}`),
                );
                path.skip();
                return;
            }
            const expressions = node.expressions.map((expression) => {
                const { start, end } = expression;
                if (!start || !end) return;
                return sourceCode.slice(start, end);
            });
            const kvPair = expressions.map((expression, index) => {
                const escapedExpression = expression?.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&',
                );
                const regex = new RegExp(
                    `\\$\\{\\s*${escapedExpression}\\s*\\}`,
                    'g',
                );
                templateContent = templateContent.replace(
                    regex,
                    `{val${index + 1}}`,
                );
                return `val${index + 1}: ${expression}`;
            });
            if (kvPair.some((item) => item.includes('`'))) {
                haveMoreTemplate = true;
            }
            count++;
            const key = getSortKey(count, obj);

            setObj(obj, key, templateContent);
            path.replaceWithMultiple(
                template.ast(
                    `I18N.get(I18N.${fileKey}.${key},{${kvPair.join(',\n')}})`,
                ),
            );
        },
        JSXText(path) {
            const { value } = path.node;
            if (value.match(DOUBLE_BYTE_REGEX)) {
                count++;
                const key = getSortKey(count, obj);
                setObj(obj, key, value);
                path.replaceWithMultiple(
                    babelTypes.identifier(`{I18N.${fileKey}.${key}}`),
                );
            }
        },
        JSXAttribute(path) {
            const { node } = path;
            if (
                babelTypes.isStringLiteral(node.value) &&
                node.value.value.match(DOUBLE_BYTE_REGEX)
            ) {
                count++;
                const key = getSortKey(count, obj);
                setObj(obj, key, node.value.value);
                const expression = babelTypes.jsxExpressionContainer(
                    babelTypes.memberExpression(
                        babelTypes.identifier('I18N'),
                        babelTypes.identifier(`${fileKey}.${key}`),
                    ),
                );
                node.value = expression;
            }
        },
        TSUnionType(path) {
            const { types } = path.node;
            const newTypes = types.map((node) => {
                if (
                    babelTypes.isTSLiteralType(node) &&
                    babelTypes.isStringLiteral(node.literal)
                ) {
                    const value = node.literal.value;
                    if (value.match(DOUBLE_BYTE_REGEX)) {
                        count++;
                        const key = getSortKey(count, obj);
                        setObj(obj, key, value);
                        return babelTypes.tsTypeReference(
                            babelTypes.tsQualifiedName(
                                babelTypes.identifier('I18N'),
                                babelTypes.identifier(`${fileKey}.${key}`),
                            ),
                        );
                    }
                }
                return node;
            });
            path.node.types = newTypes;
        },
        Program: {
            exit(path) {
                if (count > 0) {
                    const importStatement = projectConfig.importStatement;
                    const result = importStatement
                        .replace(/^import\s+|\s+from\s+/g, ',')
                        .split(',')
                        .filter(Boolean);
                    const existingImport = path.node.body.find((node) => {
                        return (
                            babelTypes.isImportDeclaration(node) &&
                            node.source.value === result[1]
                        );
                    });
                    if (!existingImport) {
                        const importDeclaration = babelTypes.importDeclaration(
                            [
                                babelTypes.importDefaultSpecifier(
                                    babelTypes.identifier(result[0]),
                                ),
                            ],
                            babelTypes.stringLiteral(result[1]),
                        );
                        // 插入 import 声明到最顶部
                        path.node.body.unshift(importDeclaration);
                    }
                }
            },
        },
    });

    if (haveMoreTemplate) {
        errorLog(
            `${fileName} 中存在模板字符串的变量中嵌套模板字符串，请做特殊处理`,
        );
    }
    if (count !== 0) {
        const { code } = generate(ast, {
            retainLines: true,
            comments: true,
        });
        _.set(extractMap, fileKey, obj);
        fs.writeFileSync(fileName, code);
    }
    return count;
};

export const fileChineseExtractor = (fileName: string, extractMap: any) => {
    if (
        fileName.endsWith('.js') ||
        fileName.endsWith('.ts') ||
        fileName.endsWith('.jsx') ||
        fileName.endsWith('.tsx')
    ) {
        return jsChineseExtractor(fileName, extractMap);
    }
    return 0;
};
