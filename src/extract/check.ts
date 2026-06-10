import * as fs from 'fs';
import { parse, ParserOptions } from '@babel/parser';
import babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
import {
    error,
    generateLocaleKey,
    getFilteredFiles,
    getProjectConfig,
    info,
} from '../utils';

const projectConfig = getProjectConfig();
const importVariable = projectConfig.importStatement
    .replace(/^import\s+|\s+from\s+/g, ',')
    .split(',')?.[1];

type InvalidI18nRef = {
    line: number;
    actualRef: string;
    expectedPrefix: string;
};

const getInvalidI18nRefs = (
    filePath: string,
    content: string,
): InvalidI18nRef[] => {
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
        info(`跳过 i18n 前缀检测（解析失败）: ${filePath}`);
        return [];
    }

    babelTraverse(ast, {
        MemberExpression(path) {
            if (
                babelTypes.isMemberExpression(path.parentPath.node) &&
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
                babelTypes.isCallExpression(path.parentPath.node) &&
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

const validateI18nCoverage = () => {
    const allFiles = getFilteredFiles(
        projectConfig.extractDir,
        projectConfig.excludeDir,
        projectConfig.excludeFile,
    ).filter(
        (fileName) =>
            fileName.endsWith('.js') ||
            fileName.endsWith('.ts') ||
            fileName.endsWith('.jsx') ||
            fileName.endsWith('.tsx'),
    );

    const zhRegex = /[\u4e00-\u9fa5]/g;
    // 匹配所有注释（单行和多行），但不移除包含 @i18n-ignore 的注释
    const commentRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;

    let hasError = false;
    allFiles.forEach((filePath) => {
        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        let content = sourceCode;

        if (
            content.startsWith('// @i18n-file-ignore') ||
            content.startsWith('/* @i18n-file-ignore')
        ) {
            info('已忽略文件:' + filePath);
            return;
        }

        content = content.replace(commentRegex, (match: string) => {
            return /@i18n-ignore/.test(match) ? match : '';
        });
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (zhRegex.test(lines[i])) {
                // 检查上一行是否有 @i18n-ignore
                const prevLine = i > 0 ? lines[i - 1] : '';
                if (
                    /\/\/\s*@i18n-ignore/.test(prevLine) ||
                    /\/\*\s*@i18n-ignore\s*\*\//.test(prevLine)
                ) {
                    continue;
                }
                hasError = true;
                const zhArr = lines[i].match(zhRegex);
                info(`检测到中文字符：${JSON.stringify(zhArr)}`);
                error(`所在文件: ${filePath}，第${i + 1}行\n`);
            }
        }

        const invalidI18nRefs = getInvalidI18nRefs(filePath, sourceCode);
        if (!invalidI18nRefs.length) return;

        hasError = true;
        invalidI18nRefs.forEach((item) => {
            error(
                `检测到非法 i18n 变量引用: ${item.actualRef}\n所在文件: ${filePath}，第${item.line}行\n期望前缀: ${item.expectedPrefix}xxx\n`,
            );
        });
    });

    hasError ? process.exit(1) : info('未检测到中文字符和非法 i18n 变量引用');
};

export default validateI18nCoverage;
