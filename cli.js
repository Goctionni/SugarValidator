#!/usr/bin/env node

const fs = require('fs');
const validate = require('./lib/sugarValidatorLib');

if (!process.argv[2]) throw 'Please include filename as argument. Ie: node sugarValidator ./MyGame.html'
const showWarnings = (process.argv[3] === '--warn');
const fileExists = fs.existsSync(process.argv[2]);
if (!fileExists) {
    console.log(`\x1b[31mFile '${process.argv[2]}' could not be found\x1b[0m`);
    return;
}
const fileData = fs.readFileSync(process.argv[2], { encoding: 'UTF-8' });

const { errors, warnings } = validate(fileData);

for (const passage in errors) {
    const error = errors[passage];
    console.log('\x1b[31m' + passage + '\x1b[0m');
    console.log(error);
    console.log('');
}

if (showWarnings) {
    for (const passage in warnings) {
        const passageWarnings = warnings[passage];
        console.log(`\x1b[33m${passage}\x1b[0m`);
        for (const warningLines of passageWarnings) {
            for (const warning of warningLines) {
                let [ message, ...args ] = warning;
                for (let i = 0; i < args.length; i++) {
                    const find = `$$${i + 1}`;
                    while (message.indexOf(find) !== -1) {
                        message = message.replace(find, '\x1b[1m' + args[i] + '\x1b[0m');
                    }
                }
                console.log(message);
            }
        }
        console.log('');
    }
}
