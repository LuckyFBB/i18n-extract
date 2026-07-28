import * as path from 'path';
import * as fs from 'fs';
import { parse, ParserOptions } from '@babel/parser';
import generate from '@babel/generator';

import {
    generateLocaleKey,
    getFilteredFiles,
    getProjectConfig,
    getSubDirectories,
    info,
    error,
    parseLocaleModule,
    pruneEmptyAncestors,
    success,
    updateLocaleContent,
} from './utils';
import { inlineI18nReferences } from './i18nRef';
import { runClear } from './extract/clear';

const isJsOrTs = (filePath: string): boolean =>
    ['.js', '.ts', '.jsx', '.tsx'].some((ext) => filePath.endsWith(ext));

const restoreFile = (
    filePath: string,
    extractMap: Record<string, any>,
): {
    inlinedCount: number;
    notFoundKeys: string[];
    unsupportedCalls: Array<{ line: number; key: string }>;
} => {
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    if (
        sourceCode.startsWith('// @i18n-file-ignore') ||
        sourceCode.startsWith('/* @i18n-file-ignore')
    ) {
        info('已忽略文件:' + filePath);
        return { inlinedCount: 0, notFoundKeys: [], unsupportedCalls: [] };
    }

    const plugins: ParserOptions['plugins'] = [
        'decorators-legacy',
        'typescript',
    ];
    if (filePath.endsWith('jsx') || filePath.endsWith('tsx')) {
        plugins.push('jsx');
    }
    const ast = parse(sourceCode, {
        sourceType: 'module',
        plugins,
    });

    const result = inlineI18nReferences(
        ast,
        extractMap,
        filePath,
        'all',
        sourceCode,
    );

    if (result.inlinedCount > 0 || !result.hasRemainingRefs) {
        const { code } = generate(ast, {
            retainLines: true,
            comments: true,
            jsescOption: { minimal: true, quotes: 'single' },
        });
        fs.writeFileSync(filePath, code);
    }

    return {
        inlinedCount: result.inlinedCount,
        notFoundKeys: result.notFoundKeys,
        unsupportedCalls: result.unsupportedCalls,
    };
};

const removeFileKeyFromAllLocales = async (fileKey: string) => {
    const { localeDir, type } = getProjectConfig();
    const subDirs = await getSubDirectories(localeDir);
    let modifiedCount = 0;

    for (const lang of subDirs) {
        const localeFile = path.join(localeDir, `${lang}/index.${type}`);
        if (!fs.existsSync(localeFile)) continue;
        const localeMap = await parseLocaleModule(localeFile);
        if (pruneEmptyAncestors(localeMap, fileKey)) {
            updateLocaleContent(localeMap, localeFile);
            modifiedCount++;
        }
    }
    return modifiedCount;
};

const restore = async (file?: string) => {
    const {
        extractDir,
        excludeDir,
        excludeFile,
        localeDir,
        sourceLocale,
        type,
    } = getProjectConfig();

    if (file) {
        const absPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(absPath)) {
            error(`File not found: ${file}`);
            throw new Error(`File not found: ${file}`);
        }
        if (!isJsOrTs(absPath)) {
            error(`Not a JS/TS file: ${file}`);
            throw new Error(`Not a JS/TS file: ${file}`);
        }

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
        const { inlinedCount, notFoundKeys, unsupportedCalls } = restoreFile(
            absPath,
            extractMap,
        );
        success(
            `已还原 ${file} (inline ${inlinedCount} 处引用, ${unsupportedCalls.length} 处需手动处理)`,
        );
        notFoundKeys.forEach((key) => {
            info(`警告: Key not found in locale: ${key}`);
        });
        unsupportedCalls.forEach(({ line, key }) => {
            info(
                `  警告: ${absPath}:${line} I18N.get(${key}) 含组件函数参数，无法自动还原，请手动处理`,
            );
        });

        // Remove locale entries whenever we attempted to inline refs in a file
        // that had an I18N import. Skipped cases (@i18n-file-ignore, no I18N
        // import) return inlinedCount=0 and notFoundKeys=[] before reaching
        // here, so they don't trigger removal. Per spec, fileKey is removed
        // even when some refs were not found in the locale.
        if (inlinedCount > 0 || notFoundKeys.length > 0) {
            const fileKey = generateLocaleKey(absPath);
            const localeCount = await removeFileKeyFromAllLocales(fileKey);
            success(`已从 ${localeCount} 个语言包中移除 ${fileKey}`);
        }
        return;
    }

    // Full-project mode
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
    const allFiles = getFilteredFiles(extractDir, excludeDir, excludeFile);
    let totalInlined = 0;
    let fileCount = 0;
    let totalUnsupported = 0;
    allFiles.forEach((filePath) => {
        if (!isJsOrTs(filePath)) return;
        const { inlinedCount, unsupportedCalls } = restoreFile(
            filePath,
            extractMap,
        );
        if (inlinedCount > 0) {
            totalInlined += inlinedCount;
            fileCount++;
        }
        totalUnsupported += unsupportedCalls.length;
        unsupportedCalls.forEach(({ line, key }) => {
            info(
                `  警告: ${filePath}:${line} I18N.get(${key}) 含组件函数参数，无法自动还原，请手动处理`,
            );
        });
    });
    success(`已还原 ${fileCount} 个文件 (inline ${totalInlined} 处引用)`);

    info('正在清理语言包...');
    await runClear();

    if (totalUnsupported > 0) {
        info(
            `检测到 ${totalUnsupported} 处含组件函数参数的 I18N.get() 调用，请手动处理`,
        );
    }
};

export default restore;
