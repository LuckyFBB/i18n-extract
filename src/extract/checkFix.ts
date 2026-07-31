import * as path from 'path';
import * as fs from 'fs';
import { parse, ParserOptions } from '@babel/parser';
import generate from '@babel/generator';

import {
    getFilteredFiles,
    getProjectConfig,
    info,
    error,
    parseLocaleModule,
    success,
} from '../utils';
import { inlineI18nReferences } from '../i18nRef';
import { runClear } from './clear';

const isJsOrTs = (filePath: string): boolean =>
    ['.js', '.ts', '.jsx', '.tsx'].some((ext) => filePath.endsWith(ext));

const fixFile = (
    filePath: string,
    extractMap: Record<string, any>,
): {
    inlinedCount: number;
    notFoundKeys: number;
    unsupportedCount: number;
    changed: boolean;
} => {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    if (
        sourceCode.startsWith('// @i18n-file-ignore') ||
        sourceCode.startsWith('/* @i18n-file-ignore')
    ) {
        info('已忽略文件:' + filePath);
        return {
            inlinedCount: 0,
            notFoundKeys: 0,
            unsupportedCount: 0,
            changed: false,
        };
    }

    const plugins: ParserOptions['plugins'] = [
        'decorators-legacy',
        'typescript',
    ];
    if (filePath.endsWith('jsx') || filePath.endsWith('tsx')) {
        plugins.push('jsx');
    }

    let ast;
    try {
        ast = parse(sourceCode, {
            sourceType: 'module',
            plugins,
        });
    } catch (err: any) {
        info(`跳过 (解析失败): ${filePath}`);
        return {
            inlinedCount: 0,
            notFoundKeys: 0,
            unsupportedCount: 0,
            changed: false,
        };
    }

    const result = inlineI18nReferences(
        ast,
        extractMap,
        filePath,
        'invalid-only',
        sourceCode,
    );

    const changed = result.inlinedCount > 0;
    if (changed) {
        const { code } = generate(ast, {
            retainLines: true,
            comments: true,
            jsescOption: { minimal: true, quotes: 'single' },
        });
        fs.writeFileSync(filePath, code);
    }

    if (result.inlinedCount > 0) {
        success(
            `修复 ${filePath}: 内联 ${result.inlinedCount} 处无效引用 (跳过 ${result.notFoundKeys.length} 处未找到 key)`,
        );
        result.notFoundKeys.forEach((key) => {
            info(`  警告: Key not found in locale: ${key}`);
        });
    } else if (result.notFoundKeys.length > 0) {
        info(
            `警告 ${filePath}: 无法内联 ${result.notFoundKeys.length} 处无效引用`,
        );
        result.notFoundKeys.forEach((key) => {
            info(`  警告: Key not found in locale: ${key}`);
        });
    }

    result.unsupportedCalls.forEach(({ line, key }) => {
        info(
            `  警告: ${filePath}:${line} I18N.get(${key}) 含组件函数参数，无法自动还原，请手动处理`,
        );
    });

    return {
        inlinedCount: result.inlinedCount,
        notFoundKeys: result.notFoundKeys.length,
        unsupportedCount: result.unsupportedCalls.length,
        changed,
    };
};

const checkFix = async () => {
    const {
        extractDir,
        excludeDir,
        excludeFile,
        localeDir,
        sourceLocale,
        type,
    } = getProjectConfig();

    const sourceLocaleFile = path.join(
        localeDir,
        `${sourceLocale}/index.${type}`,
    );
    if (!fs.existsSync(sourceLocaleFile)) {
        error(`Source locale file not found. Run 'i18n extract' first.`);
        throw new Error(
            `Source locale file not found. Run 'i18n extract' first.`,
        );
    }

    const extractMap = await parseLocaleModule(sourceLocaleFile);
    const allFiles = getFilteredFiles(
        extractDir,
        excludeDir,
        excludeFile,
    ).filter(isJsOrTs);

    let totalFixed = 0;
    let totalInlined = 0;
    let totalNotFound = 0;
    let totalUnsupported = 0;
    allFiles.forEach((filePath) => {
        const { inlinedCount, notFoundKeys, unsupportedCount, changed } =
            fixFile(filePath, extractMap);
        if (changed) {
            totalFixed++;
            totalInlined += inlinedCount;
        }
        totalNotFound += notFoundKeys;
        totalUnsupported += unsupportedCount;
    });

    info('正在清理语言包...');
    await runClear();

    if (totalFixed > 0) {
        success(`共修复 ${totalFixed} 个文件，内联 ${totalInlined} 处无效引用`);
    } else if (totalNotFound > 0) {
        info(`检测到 ${totalNotFound} 处无法内联的无效引用 (key 未在语言包中)`);
    } else {
        info('未检测到任何无效引用');
    }
    if (totalUnsupported > 0) {
        info(
            `检测到 ${totalUnsupported} 处含组件函数参数的 I18N.get() 调用，请手动处理`,
        );
    }
};

export default checkFix;
