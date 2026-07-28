import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TempProject {
    tmpDir: string;
    cleanup: () => void;
    writeFile: (relPath: string, content: string) => void;
    readFile: (relPath: string) => string;
    fileExists: (relPath: string) => boolean;
}

export const createTempProject = (
    config?: Record<string, any>,
): TempProject => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-'));
    const configContent = {
        localeDir: './locales',
        extractDir: './src',
        importStatement: 'import I18N from @/utils/i18n',
        excludeFile: [],
        excludeDir: ['node_modules', 'locales'],
        type: 'ts',
        sourceLocale: 'zh-CN',
        ...config,
    };
    fs.writeFileSync(
        path.join(tmpDir, 'i18n.config.json'),
        JSON.stringify(configContent, null, 4),
    );

    const origCwd = process.cwd();
    process.chdir(tmpDir);

    return {
        tmpDir,
        cleanup: () => {
            process.chdir(origCwd);
            fs.rmSync(tmpDir, { recursive: true, force: true });
        },
        writeFile: (relPath, content) => {
            const fullPath = path.join(tmpDir, relPath);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content);
        },
        readFile: (relPath) =>
            fs.readFileSync(path.join(tmpDir, relPath), 'utf-8'),
        fileExists: (relPath) => fs.existsSync(path.join(tmpDir, relPath)),
    };
};

export const tsLocaleContent = (obj: Record<string, any>): string => {
    return `export default ${JSON.stringify(obj, null, 4)};\n`;
};
