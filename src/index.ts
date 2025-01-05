import { Command } from 'commander';
import initProject from './init';

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
        console.log('extract command called');
    });

program.parse(process.argv);
