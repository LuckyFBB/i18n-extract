#!/usr/bin/env node

import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import initProject from './init';
import extract from './extract';

const program = new Command();

program
    .command('init')
    .description('init default config')
    .action(async () => {
        const localeDir = await input({
            message: '请输入国际化文件夹(默认为 locales)',
        });
        const extractDir = await input({
            message: '请输入提取中文的文件夹(默认为当前路径)',
        });
        initProject(localeDir, extractDir);
    });

program
    .command('extract')
    .description('extract chinese from project')
    .action(() => {
        extract();
    });

program.parse(process.argv);
