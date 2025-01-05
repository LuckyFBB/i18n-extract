import { Command } from 'commander';
import initProject from './init';
import extract from './extract';

const program = new Command();

program
    .command('init')
    .description('init default config')
    .action(() => {
        initProject();
    });

program
    .command('extract')
    .description('extract chinese from project')
    .action(() => {
        extract();
    });

program.parse(process.argv);
