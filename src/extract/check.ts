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
    // 匹配单行注释、块注释和字符串
    const commentAndStringRegex =
        /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(.*?)"|'(.*?)')/g;

    allFiles.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        // 移除注释和字符串中的内容
        const cleanedContent = content.replace(
            commentAndStringRegex,
            (match) => {
                // 对于字符串，保留内容；对于注释，直接移除
                return match.startsWith('//') || match.startsWith('/*')
                    ? ''
                    : ' ';
            },
        );

        // 检查剩余的代码中是否有中文字符
        if (zhRegex.test(cleanedContent)) {
            const zhArr = cleanedContent.match(zhRegex);

            infoLog(`检测到中文字符：${JSON.stringify(zhArr)}`);
            errorLog(`所在文件: ${filePath}\n`);
        }
    });
};

export default zhCheck;
