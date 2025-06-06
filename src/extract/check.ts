import * as fs from 'fs';
import { error, getFilteredFiles, getProjectConfig, info } from '../utils';

const projectConfig = getProjectConfig();

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

    let hasZh = false;
    allFiles.forEach((filePath) => {
        let content = fs.readFileSync(filePath, 'utf-8');
        content = content.replace(commentRegex, (match) => {
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
                hasZh = true;
                const zhArr = lines[i].match(zhRegex);
                info(`检测到中文字符：${JSON.stringify(zhArr)}`);
                error(`所在文件: ${filePath}，第${i + 1}行\n`);
            }
        }
    });

    hasZh ? process.exit(1) : info('未检测到中文字符');
};

export default validateI18nCoverage;
