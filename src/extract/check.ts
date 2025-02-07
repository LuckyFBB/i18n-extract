import * as fs from 'fs';
import { errorLog, getAllFiles, getProjectConfig, infoLog } from '../utils';

const projectConfig = getProjectConfig();

const zhCheck = () => {
    const allFiles = getAllFiles(
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
    // 匹配单行注释、块注释
    const commentAndStringRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;

    let hasZh = false;
    allFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        // 移除注释中的内容
        const cleanedContent = content.replace(commentAndStringRegex, '');

        // 检查剩余的代码中是否有中文字符
        if (zhRegex.test(cleanedContent)) {
            hasZh = true;
            const zhArr = cleanedContent.match(zhRegex);

            infoLog(`检测到中文字符：${JSON.stringify(zhArr)}`);
            errorLog(`所在文件: ${filePath}\n`);
        }
    });
    hasZh && process.exit(1);
};

export default zhCheck;