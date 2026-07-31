import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, tsLocaleContent } from '../test-utils';

let project: ReturnType<typeof createTempProject>;

beforeEach(() => {
    project = createTempProject();
});

afterEach(() => {
    project.cleanup();
});

const importClear = () => import('../../src/extract/clear');

describe('extract:clear', () => {
    test('removes unused keys and reports accurate count', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const a = I18N.pages.demo.kept;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: {
                    demo: { kept: '保留', unused: '废弃' },
                },
            }),
        );

        const { runClear } = await importClear();
        const { removedCount } = await runClear();

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).toContain('保留');
        expect(zhContent).not.toContain('废弃');
        // Per bug fix: count should reflect actual removals (was 0 due to
        // _.set copying by reference, mutating extractMap during the scan).
        expect(removedCount).toBe(1);
    });

    test('preserves keys still referenced by source files', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const a = I18N.pages.demo.key1;
const b = I18N.pages.demo.key2;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: { demo: { key1: '你好', key2: '世界' } },
            }),
        );

        const { runClear } = await importClear();
        const { removedCount } = await runClear();

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).toContain('你好');
        expect(zhContent).toContain('世界');
        expect(removedCount).toBe(0);
    });

    test('removes fileKey entirely when no refs remain in file', async () => {
        project.writeFile('src/pages/demo.tsx', `const a = 'no i18n';`);
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: { demo: { key1: '你好', key2: '世界' } },
            }),
        );

        const { runClear } = await importClear();
        const { removedCount } = await runClear();

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).not.toContain('demo');
        expect(zhContent).not.toContain('你好');
        expect(zhContent).not.toContain('世界');
        expect(removedCount).toBe(2);
    });
});
