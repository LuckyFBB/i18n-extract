import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, tsLocaleContent } from './test-utils';

let project: ReturnType<typeof createTempProject>;

beforeEach(() => {
    project = createTempProject();
});

afterEach(() => {
    project.cleanup();
});

// Dynamic import so the module loads after createTempProject changes cwd.
const importRestore = () => import('../src/restore');

describe('restore single-file', () => {
    test('inlines I18N refs and removes fileKey from locale', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;
const y = I18N.pages.demo.key2;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: { demo: { key1: '你好', key2: '世界' } },
            }),
        );
        project.writeFile(
            'locales/en-US/index.ts',
            tsLocaleContent({
                pages: { demo: { key1: 'Hello', key2: 'World' } },
            }),
        );

        const { default: restore } = await importRestore();
        await restore('src/pages/demo.tsx');

        const fileContent = project.readFile('src/pages/demo.tsx');
        expect(fileContent).toContain(`'你好'`);
        expect(fileContent).toContain(`'世界'`);
        expect(fileContent).not.toContain(`I18N.pages.demo`);
        expect(fileContent).not.toContain(`import I18N`);

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).not.toContain('pages');
        expect(zhContent).not.toContain('demo');

        const enContent = project.readFile('locales/en-US/index.ts');
        expect(enContent).not.toContain('pages');
        expect(enContent).not.toContain('demo');
    });

    test('skips file with @i18n-file-ignore header', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `// @i18n-file-ignore
import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { key1: '你好' } } }),
        );

        const { default: restore } = await importRestore();
        await restore('src/pages/demo.tsx');

        const fileContent = project.readFile('src/pages/demo.tsx');
        expect(fileContent).toContain(`I18N.pages.demo.key1`);
        // locale unchanged
        expect(project.readFile('locales/zh-CN/index.ts')).toContain('你好');
    });

    test('skips file with no I18N import', async () => {
        project.writeFile('src/pages/demo.tsx', `const x = 'hello';`);
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { key1: '你好' } } }),
        );

        const { default: restore } = await importRestore();
        await restore('src/pages/demo.tsx');

        // locale unchanged
        expect(project.readFile('locales/zh-CN/index.ts')).toContain('你好');
    });

    test('errors when file does not exist', async () => {
        project.writeFile('locales/zh-CN/index.ts', tsLocaleContent({}));
        const { default: restore } = await importRestore();
        await expect(restore('src/pages/missing.tsx')).rejects.toThrow(
            /File not found/,
        );
    });

    test('errors when file is not JS/TS', async () => {
        project.writeFile('src/pages/demo.md', '# hello');
        project.writeFile('locales/zh-CN/index.ts', tsLocaleContent({}));
        const { default: restore } = await importRestore();
        await expect(restore('src/pages/demo.md')).rejects.toThrow(
            /Not a JS\/TS file/,
        );
    });

    test('errors when source locale file is missing', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        // No locale file created
        const { default: restore } = await importRestore();
        await expect(restore('src/pages/demo.tsx')).rejects.toThrow(
            /Source locale file not found/,
        );
    });

    test('warns when ref key not in locale, leaves ref as-is, still removes fileKey', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.missing;
const y = I18N.pages.demo.existing;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { existing: '存在' } } }),
        );

        const { default: restore } = await importRestore();
        await restore('src/pages/demo.tsx');

        const fileContent = project.readFile('src/pages/demo.tsx');
        expect(fileContent).toContain(`I18N.pages.demo.missing`);
        expect(fileContent).toContain(`'存在'`);
        expect(fileContent).toContain(`import I18N`);

        // Per spec: fileKey still removed from locale even when refs were
        // not found, so other keys under fileKey (e.g. 'existing') are
        // also removed.
        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).not.toContain('demo');
        expect(zhContent).not.toContain('existing');
    });

    test('inlines I18N.get() call to template literal', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.pages.demo.greeting, { name });`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { greeting: '你好{name}' } } }),
        );

        const { default: restore } = await importRestore();
        await restore('src/pages/demo.tsx');

        const fileContent = project.readFile('src/pages/demo.tsx');
        expect(fileContent).toContain('`你好');
        expect(fileContent).toContain('${name}');
        expect(fileContent).not.toContain('I18N.get');
        expect(fileContent).not.toContain('import I18N');

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).not.toContain('demo');
        expect(zhContent).not.toContain('greeting');
    });
});

describe('restore full-project', () => {
    test('inlines all refs in all files and clears locale (except ignored files)', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        project.writeFile(
            'src/pages/other.tsx',
            `import I18N from '@/utils/i18n';
const y = I18N.pages.other.key2;`,
        );
        project.writeFile(
            'src/pages/ignored.tsx',
            `// @i18n-file-ignore
import I18N from '@/utils/i18n';
const z = I18N.pages.ignored.key3;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: {
                    demo: { key1: '你好' },
                    other: { key2: '世界' },
                    ignored: { key3: '保留' },
                },
            }),
        );

        const { default: restore } = await importRestore();
        await restore();

        // demo.tsx inlined
        const demoContent = project.readFile('src/pages/demo.tsx');
        expect(demoContent).toContain(`'你好'`);
        expect(demoContent).not.toContain(`I18N.pages.demo`);
        expect(demoContent).not.toContain(`import I18N`);

        // other.tsx inlined
        const otherContent = project.readFile('src/pages/other.tsx');
        expect(otherContent).toContain(`'世界'`);
        expect(otherContent).not.toContain(`import I18N`);

        // ignored.tsx untouched
        const ignoredContent = project.readFile('src/pages/ignored.tsx');
        expect(ignoredContent).toContain(`I18N.pages.ignored.key3`);

        // locale: ignored key preserved, others removed
        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).toContain('保留');
        expect(zhContent).not.toContain('你好');
        expect(zhContent).not.toContain('世界');
    });

    test('idempotent: restore twice is a no-op on second run', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { key1: '你好' } } }),
        );

        const { default: restore } = await importRestore();
        await restore();
        const contentAfterFirst = project.readFile('src/pages/demo.tsx');
        const localeAfterFirst = project.readFile('locales/zh-CN/index.ts');
        await restore();
        const contentAfterSecond = project.readFile('src/pages/demo.tsx');
        const localeAfterSecond = project.readFile('locales/zh-CN/index.ts');
        expect(contentAfterFirst).toBe(contentAfterSecond);
        expect(localeAfterFirst).toBe(localeAfterSecond);
    });

    test('errors when source locale file is missing', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        // No locale file created
        const { default: restore } = await importRestore();
        await expect(restore()).rejects.toThrow(/Source locale file not found/);
    });

    test('skips files with no I18N import without erroring', async () => {
        project.writeFile('src/pages/plain.ts', `const x = 'no i18n here';`);
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { key1: '你好' } } }),
        );

        const { default: restore } = await importRestore();
        await restore();

        // demo.tsx inlined, plain.ts untouched
        expect(project.readFile('src/pages/demo.tsx')).toContain(`'你好'`);
        expect(project.readFile('src/pages/plain.ts')).toContain(
            `const x = 'no i18n here';`,
        );

        // demo's fileKey removed from locale
        expect(project.readFile('locales/zh-CN/index.ts')).not.toContain(
            'demo',
        );
    });
});
