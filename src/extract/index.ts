import * as path from 'path';
import * as fs from 'fs';
import * as json5 from 'json5';
import {
    createFileAndDirectories,
    getAllFiles,
    getProjectConfig,
    successLog,
} from '../utils';
import { fileChineseExtractor } from './fileChineseExtractor';

const projectConfig = getProjectConfig();

const extract = () => {
    const fileType = projectConfig.type || 'ts';
    const targetFilename = path.join(
        projectConfig.localeDir,
        `zh-CN/index.${fileType}`,
    );
    let extractMap = {};
    if (fs.existsSync(targetFilename)) {
        const content = fs.readFileSync(targetFilename, 'utf-8') ?? '{}';
        if (['ts', 'js'].includes(fileType)) {
            const modifiedContent = content.replace(
                /^export default\s*({[\s\S]*})\s*;?/,
                '$1',
            );
            extractMap = json5.parse(modifiedContent);
        } else {
            extractMap = JSON.parse(content);
        }
    }
    const allFiles = getAllFiles(
        projectConfig.extractDir,
        projectConfig.excludeDir,
        projectConfig.excludeFile,
    );
    const amount = allFiles.reduce((amount, file) => {
        try {
            const curr = fileChineseExtractor(file, extractMap);
            return amount + curr;
        } catch (error: any) {
            createFileAndDirectories(`${JSON.stringify(extractMap, null, 4)}`);
            throw new Error(`${file} 提取文案失败, ${error.message}`);
        }
    }, 0);
    successLog(`共提取${amount}处文案！`);
    createFileAndDirectories(`${JSON.stringify(extractMap, null, 4)}`);
};

export default extract;
