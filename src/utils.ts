import chalk from 'chalk';

export const successLog = (message: string) => {
    console.log(chalk.green(message));
};

export const errorLog = (message: string) => {
    console.log(chalk.red(message));
};
