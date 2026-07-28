#!/usr/bin/env node

import { Command } from 'commander';

import extract from './extract';
import validateI18nCoverage from './extract/check';
import init from './init';
import clear from './extract/clear';
import checkFix from './extract/checkFix';
import restore from './restore';

const program = new Command();

program.command('init').description('init default config').action(init);

program
    .command('extract')
    .description('extract chinese from project')
    .action(extract);

program
    .command('extract:check')
    .description('check chinese in files')
    .action(validateI18nCoverage);

program
    .command('extract:check:fix')
    .description('fix invalid i18n references by restoring to Chinese')
    .action(checkFix);

program
    .command('extract:clear')
    .description('clear unused key in locale file')
    .action(clear);

program
    .command('restore [file]')
    .description('restore I18N references back to Chinese text')
    .action(restore);

program.parse(process.argv);
