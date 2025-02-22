#!/usr/bin/env node

import { Command } from 'commander';

import extract from './extract';
import validateI18nCoverage from './extract/check';
import init from './init';

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

program.parse(process.argv);
