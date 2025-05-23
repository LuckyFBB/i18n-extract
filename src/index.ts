#!/usr/bin/env node

import { Command } from 'commander';

import extract from './extract';
import validateI18nCoverage from './extract/check';
import init from './init';
import clear from './extract/clear';
import toLocal from './extract/toLocal';

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
    .command('extract:clear')
    .description('clear unused key in locale file')
    .action(clear);

program
    .command('extract:local')
    .description('transform I18N to locale text')
    .action(toLocal);

program.parse(process.argv);
