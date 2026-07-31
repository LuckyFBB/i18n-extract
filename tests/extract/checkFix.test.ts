import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, tsLocaleContent } from '../test-utils';

let project: ReturnType<typeof createTempProject>;

beforeEach(() => {
    project = createTempProject();
});

afterEach(() => {
    project.cleanup();
});

const importCheckFix = () => import('../../src/extract/checkFix');

describe('extract:check:fix', () => {
    test('inlines invalid refs, leaves valid refs untouched, keeps import', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const a = I18N.pages.demo.validKey;
const b = I18N.otherPage.invalidKey;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                pages: { demo: { validKey: '合法' } },
                otherPage: { invalidKey: '非法' },
            }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain(`I18N.pages.demo.validKey`);
        expect(content).toContain(`'非法'`);
        expect(content).toContain(`import I18N`);
    });

    test('removes import when all refs are invalid and inlined', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: { key1: '你好' } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).not.toContain(`import I18N`);
        expect(content).toContain(`'你好'`);
    });

    test('inlines invalid I18N.get() call to template literal', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.otherPage.key1, { val1: name });`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: { key1: '你好{val1}' } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain('`你好');
        expect(content).not.toContain('I18N.get');
        expect(content).not.toContain('import I18N');
    });

    test('skips file with @i18n-file-ignore header', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `// @i18n-file-ignore
import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: { key1: '你好' } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain(`I18N.otherPage.key1`);
        expect(content).toContain(`import I18N`);
    });

    test('skips invalid ref with @i18n-ignore on previous line', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
// @i18n-ignore
const x = I18N.otherPage.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: { key1: '你好' } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain(`I18N.otherPage.key1`);
        expect(content).toContain(`import I18N`);
    });

    test('runs cleanup after fix - removes now-unused keys from locale', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                otherPage: { key1: '你好' },
                unusedPage: { key2: '废弃' },
            }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const zhContent = project.readFile('locales/zh-CN/index.ts');
        expect(zhContent).not.toContain('你好');
        expect(zhContent).not.toContain('废弃');
    });

    test('warns when invalid ref key not in locale, leaves ref as-is', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.otherPage.missing;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: {} }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain(`I18N.otherPage.missing`);
        expect(content).toContain(`import I18N`);
    });

    test('no-op when no invalid refs found (cleanup still runs)', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ pages: { demo: { key1: '你好' } } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        expect(content).toContain(`I18N.pages.demo.key1`);
        expect(content).toContain(`import I18N`);
        // locale unchanged (key is still referenced)
        expect(project.readFile('locales/zh-CN/index.ts')).toContain('你好');
    });

    test('errors when source locale file is missing', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';`,
        );

        const { default: checkFix } = await importCheckFix();
        await expect(checkFix()).rejects.toThrow(
            /Source locale file not found/,
        );
    });

    test('skips file with syntax error without crashing', async () => {
        project.writeFile(
            'src/pages/broken.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;
const broken = {`,
        );
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({ otherPage: { key1: '你好' } }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        // broken.tsx untouched (parse failed, no inlining)
        const brokenContent = project.readFile('src/pages/broken.tsx');
        expect(brokenContent).toContain(`I18N.otherPage.key1`);
        expect(brokenContent).toContain(`import I18N`);

        // demo.tsx inlined normally
        const demoContent = project.readFile('src/pages/demo.tsx');
        expect(demoContent).toContain(`'你好'`);
        expect(demoContent).not.toContain(`import I18N`);
    });

    test('skips I18N.get() with component params, inlines other invalid refs', async () => {
        project.writeFile(
            'src/pages/demo.tsx',
            `import I18N from '@/utils/i18n';
const a = I18N.otherPage.invalidKey;
const b = I18N.get(I18N.utils.domI18n.D, {
    val1: count,
    BlueText: (chunks) => <BlueText>{chunks}</BlueText>,
});`,
        );
        project.writeFile(
            'locales/zh-CN/index.ts',
            tsLocaleContent({
                otherPage: { invalidKey: '非法' },
                utils: {
                    domI18n: { D: '已选择 <BlueText>{val1}</BlueText> 条数据' },
                },
            }),
        );

        const { default: checkFix } = await importCheckFix();
        await checkFix();

        const content = project.readFile('src/pages/demo.tsx');
        // Invalid ref is inlined
        expect(content).toContain(`'非法'`);
        // Unsupported I18N.get() call is preserved verbatim
        expect(content).toContain(`I18N.get(I18N.utils.domI18n.D`);
        expect(content).toContain(
            `BlueText: (chunks) => <BlueText>{chunks}</BlueText>`,
        );
        // Import kept because the unsupported call still references I18N
        expect(content).toContain(`import I18N`);
    });
});
