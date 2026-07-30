import { describe, test, expect, vi } from 'vitest';
import { parse, ParserOptions } from '@babel/parser';
import generate from '@babel/generator';

vi.mock('../src/utils', () => ({
    getProjectConfig: () => ({
        importStatement: 'import I18N from @/utils/i18n',
        extractDir: './src',
        localeDir: './locales',
        excludeDir: ['node_modules', 'locales'],
        excludeFile: [],
        type: 'ts',
        sourceLocale: 'zh-CN',
    }),
    generateLocaleKey: (filePath: string) => {
        const extractDir = './src';
        const normalized = filePath.replace(/^\.?\//, '').replace(/\\/g, '/');
        // Strip the extractDir prefix (mimics path.relative(basePath, filePath))
        const prefix = extractDir.replace(/^\.?\//, '').replace(/\\/g, '/');
        const stripped = normalized.startsWith(prefix + '/')
            ? normalized.slice(prefix.length + 1)
            : normalized;
        const parts = stripped.split('/');
        const fileName = parts[parts.length - 1];
        const name = fileName.split('.').slice(0, -1).join('.');
        const dir = parts.slice(0, -1).join('.');
        return (dir ? `${dir}.${name}` : name).replace(/-/g, '_');
    },
    info: () => {},
    error: () => {},
    success: () => {},
}));

import { getInvalidI18nRefs, inlineI18nReferences } from '../src/i18nRef';

const parseFile = (code: string, isJsx: boolean) => {
    const plugins: ParserOptions['plugins'] = [
        'decorators-legacy',
        'typescript',
    ];
    if (isJsx) plugins.push('jsx');
    return parse(code, { sourceType: 'module', plugins });
};

const generateCode = (ast: any) =>
    generate(ast, {
        retainLines: true,
        comments: true,
        jsescOption: { minimal: true, quotes: 'single' },
    }).code;

describe('getInvalidI18nRefs', () => {
    test('returns empty for file with no I18N refs', () => {
        const content = `const x = 'hello';`;
        expect(getInvalidI18nRefs('src/pages/demo.tsx', content)).toEqual([]);
    });

    test('returns empty for valid I18N refs (prefix matches file path)', () => {
        const content = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`;
        expect(getInvalidI18nRefs('src/pages/demo.tsx', content)).toEqual([]);
    });

    test('detects invalid I18N ref with wrong prefix', () => {
        const content = `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`;
        const refs = getInvalidI18nRefs('src/pages/demo.tsx', content);
        expect(refs).toHaveLength(1);
        expect(refs[0].actualRef).toBe('I18N.otherPage.key1');
        expect(refs[0].expectedPrefix).toBe('I18N.pages.demo.');
    });

    test('skips refs with @i18n-ignore on previous line', () => {
        const content = `import I18N from '@/utils/i18n';
// @i18n-ignore
const x = I18N.otherPage.key1;`;
        expect(getInvalidI18nRefs('src/pages/demo.tsx', content)).toEqual([]);
    });

    test('excludes I18N.get() outer member expression', () => {
        const content = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.pages.demo.key1, { val1: 'a' });`;
        expect(getInvalidI18nRefs('src/pages/demo.tsx', content)).toEqual([]);
    });

    test('returns empty for unparseable file', () => {
        const content = `import { broken`;
        expect(getInvalidI18nRefs('src/pages/demo.tsx', content)).toEqual([]);
    });

    test('detects multiple invalid refs in same file', () => {
        const content = `import I18N from '@/utils/i18n';
const a = I18N.foo.key1;
const b = I18N.bar.key2;`;
        const refs = getInvalidI18nRefs('src/pages/demo.tsx', content);
        expect(refs).toHaveLength(2);
        expect(refs[0].actualRef).toBe('I18N.foo.key1');
        expect(refs[1].actualRef).toBe('I18N.bar.key2');
    });
});

describe('inlineI18nReferences (all mode)', () => {
    test('inlines standalone I18N.x.y reference to string literal', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`;
        const extractMap = { pages: { demo: { key1: '你好' } } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(false);
        expect(generateCode(ast)).toContain(`'你好'`);
        expect(generateCode(ast)).not.toContain(`I18N.pages.demo.key1`);
    });

    test('inlines I18N.get() call to template literal', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.pages.demo.key1, { val1: name });`;
        const extractMap = { pages: { demo: { key1: '你好{val1}' } } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(false);
        expect(generateCode(ast)).toContain('`你好');
        expect(generateCode(ast)).not.toContain('I18N.get');
    });

    test('removes I18N import when all refs inlined', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`;
        const extractMap = { pages: { demo: { key1: '你好' } } };
        const ast = parseFile(code, true);
        inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(generateCode(ast)).not.toContain(`import I18N`);
    });

    test('leaves ref as-is when key not in locale (warns)', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.missing;`;
        const extractMap = { pages: { demo: {} } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.notFoundKeys).toEqual(['pages.demo.missing']);
        expect(result.hasRemainingRefs).toBe(true);
        expect(generateCode(ast)).toContain(`I18N.pages.demo.missing`);
        expect(generateCode(ast)).toContain(`import I18N`);
    });

    test('no-op when file has no I18N import', () => {
        const code = `const x = 'hello';`;
        const extractMap = {};
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.hasRemainingRefs).toBe(false);
    });

    test('inlines refs with wrong prefix too (all mode ignores prefix validity)', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`;
        const extractMap = { otherPage: { key1: '你好' } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(false);
    });
});

describe('inlineI18nReferences (invalid-only mode)', () => {
    test('inlines only invalid refs, leaves valid refs untouched', () => {
        const code = `import I18N from '@/utils/i18n';
const a = I18N.pages.demo.validKey;
const b = I18N.otherPage.invalidKey;`;
        const extractMap = {
            pages: { demo: { validKey: '合法' } },
            otherPage: { invalidKey: '非法' },
        };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(true);
        const out = generateCode(ast);
        expect(out).toContain(`I18N.pages.demo.validKey`);
        expect(out).toContain(`'非法'`);
        expect(out).toContain(`import I18N`);
    });

    test('removes import when all refs are invalid and inlined', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`;
        const extractMap = { otherPage: { key1: '你好' } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(false);
        expect(generateCode(ast)).not.toContain(`import I18N`);
    });

    test('skips invalid ref with @i18n-ignore on previous line', () => {
        const code = `import I18N from '@/utils/i18n';
// @i18n-ignore
const x = I18N.otherPage.key1;`;
        const extractMap = { otherPage: { key1: '你好' } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.hasRemainingRefs).toBe(true);
        expect(generateCode(ast)).toContain(`I18N.otherPage.key1`);
        expect(generateCode(ast)).toContain(`import I18N`);
    });

    test('inlines invalid I18N.get() call to template literal', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.otherPage.key1, { val1: name });`;
        const extractMap = { otherPage: { key1: '你好{val1}' } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.hasRemainingRefs).toBe(false);
        const out = generateCode(ast);
        expect(out).toContain('`你好');
        expect(out).not.toContain('I18N.get');
        expect(out).not.toContain('import I18N');
    });

    test('leaves valid I18N.get() call untouched', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.pages.demo.key1, { val1: name });`;
        const extractMap = { pages: { demo: { key1: '你好{val1}' } } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.hasRemainingRefs).toBe(true);
        const out = generateCode(ast);
        expect(out).toContain('I18N.get(I18N.pages.demo.key1');
        expect(out).toContain('import I18N');
    });

    test('warns when invalid ref key not in locale', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.otherPage.missing;`;
        const extractMap = { otherPage: {} };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.notFoundKeys).toEqual(['otherPage.missing']);
        expect(result.hasRemainingRefs).toBe(true);
        expect(generateCode(ast)).toContain(`I18N.otherPage.missing`);
        expect(generateCode(ast)).toContain(`import I18N`);
    });
});

describe('inlineI18nReferences: I18N.get() with component params', () => {
    test('skips I18N.get() with component function params in all mode', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.utils.domI18n.D, {
    val1: count,
    BlueText: (chunks) => <BlueText>{chunks}</BlueText>,
});`;
        const extractMap = {
            utils: {
                domI18n: { D: '已选择 <BlueText>{val1}</BlueText> 条数据' },
            },
        };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/utils/dom.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.unsupportedCalls).toHaveLength(1);
        expect(result.unsupportedCalls[0].key).toBe('utils.domI18n.D');
        expect(result.hasRemainingRefs).toBe(true);
        const out = generateCode(ast);
        expect(out).toContain('I18N.get(I18N.utils.domI18n.D');
        expect(out).toContain('import I18N');
    });

    test('skips I18N.get() with component function params in invalid-only mode', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.utils.domI18n.D, {
    val1: count,
    BlueText: (chunks) => <BlueText>{chunks}</BlueText>,
});`;
        const extractMap = {
            utils: {
                domI18n: { D: '已选择 <BlueText>{val1}</BlueText> 条数据' },
            },
        };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/utils/dom.tsx',
            'invalid-only',
            code,
        );
        expect(result.inlinedCount).toBe(0);
        expect(result.unsupportedCalls).toHaveLength(1);
        expect(result.hasRemainingRefs).toBe(true);
        const out = generateCode(ast);
        expect(out).toContain('I18N.get(I18N.utils.domI18n.D');
        expect(out).toContain('import I18N');
    });

    test('still inlines other refs in same file when one I18N.get() is unsupported', () => {
        const code = `import I18N from '@/utils/i18n';
const a = I18N.utils.domI18n.plain;
const b = I18N.get(I18N.utils.domI18n.D, {
    val1: count,
    BlueText: (chunks) => <BlueText>{chunks}</BlueText>,
});`;
        const extractMap = {
            utils: {
                domI18n: {
                    plain: '普通文案',
                    D: '已选择 <BlueText>{val1}</BlueText> 条数据',
                },
            },
        };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/utils/dom.tsx',
            'all',
            code,
        );
        expect(result.inlinedCount).toBe(1);
        expect(result.unsupportedCalls).toHaveLength(1);
        expect(result.hasRemainingRefs).toBe(true);
        const out = generateCode(ast);
        expect(out).toContain(`'普通文案'`);
        expect(out).toContain('I18N.get(I18N.utils.domI18n.D');
        expect(out).toContain('import I18N');
    });
});

describe('inlineI18nReferences: importRemoved flag', () => {
    test('importRemoved is true when I18N import is removed (all refs inlined)', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.key1;`;
        const extractMap = { pages: { demo: { key1: '你好' } } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.importRemoved).toBe(true);
    });

    test('importRemoved is false when file has no I18N import', () => {
        const code = `const x = 'hello';`;
        const extractMap = {};
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.importRemoved).toBe(false);
    });

    test('importRemoved is false when refs remain (key not in locale)', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.pages.demo.missing;`;
        const extractMap = { pages: { demo: {} } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'all',
            code,
        );
        expect(result.hasRemainingRefs).toBe(true);
        expect(result.importRemoved).toBe(false);
    });

    test('importRemoved is false when unsupported I18N.get() keeps import', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.utils.domI18n.D, {
    val1: count,
    BlueText: (chunks) => <BlueText>{chunks}</BlueText>,
});`;
        const extractMap = {
            utils: {
                domI18n: { D: '已选择 <BlueText>{val1}</BlueText> 条数据' },
            },
        };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/utils/dom.tsx',
            'all',
            code,
        );
        expect(result.hasRemainingRefs).toBe(true);
        expect(result.importRemoved).toBe(false);
    });

    test('importRemoved is true in invalid-only mode when all refs inlined', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.otherPage.key1;`;
        const extractMap = { otherPage: { key1: '你好' } };
        const ast = parseFile(code, true);
        const result = inlineI18nReferences(
            ast,
            extractMap,
            'src/pages/demo.tsx',
            'invalid-only',
            code,
        );
        expect(result.importRemoved).toBe(true);
    });
});

describe('inlineI18nReferences: I18N.get() with JSX element params', () => {
    test('does not crash when params contain JSX elements', () => {
        const code = `import I18N from '@/utils/i18n';
const x = I18N.get(I18N.pages.demo.key1, { el: <div /> });`;
        const extractMap = { pages: { demo: { key1: '你好{el}' } } };
        const ast = parseFile(code, true);
        expect(() =>
            inlineI18nReferences(
                ast,
                extractMap,
                'src/pages/demo.tsx',
                'all',
                code,
            ),
        ).not.toThrow();
    });
});
