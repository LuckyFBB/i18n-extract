module.exports = {
    printWidth: 80,
    proseWrap: 'never',
    singleQuote: true,
    trailingComma: 'all',
    tabWidth: 4,
    overrides: [
        {
            files: '*.md',
            options: {
                proseWrap: 'preserve',
            },
        },
    ],
};
