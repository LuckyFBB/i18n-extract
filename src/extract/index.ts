import * as path from 'path';
import * as fs from 'fs';
import {
    createFileAndDirectories,
    getAllFiles,
    getProjectConfig,
    successLog,
} from '../utils';
import { fileChineseExtractor } from './fileChineseExtractor';

const projectConfig = getProjectConfig();

const extract = () => {
    const targetFilename = path.join(
        projectConfig.localeDir,
        'zh-CN/index.json',
    );
    let extractMap = {};
    if (fs.existsSync(targetFilename)) {
        const content = fs.readFileSync(targetFilename, 'utf-8') ?? '{}';
        if (content) extractMap = JSON.parse(content);
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
            createFileAndDirectories(
                targetFilename,
                `${JSON.stringify(extractMap, null, 4)}`,
            );
            throw new Error(`${file} 提取文案失败, ${error.message}`);
        }
    }, 0);
    successLog(`共提取${amount}处文案！`);
    createFileAndDirectories(
        targetFilename,
        `${JSON.stringify(extractMap, null, 4)}`,
    );
};

export default extract;
