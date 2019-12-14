# SugarValidator
Validates SugarCube games, find bugs quickly and easily

## Description
This is a validator made for SugarCube games. It takes your game's HTML file as input, collects all passages from the game and does some basic validation checks to check that `<<` and `>>` are matched correctly, and that the `<<if>>` `<<elseif>>` `<<else>>` <</if>>` are structured correctly.

Most SugarCube games will ship with a few of these types of errors. Now you can easily check for them and fix them before your users do.

In addition you can also receive warnings about deprecated syntax being used. Add `--warn`` at the end of your command to see these warnings.

## Prerequisites
You'll need [NPM/Node](https://nodejs.org/en/download/).

## How to use
Download `sugarValidator.js` and place it in the same ddirectory as your game. Then execute the command `node sugarValidator ./YourGame.html`, or `node sugarValidator ./YourGame.html --warn` to include deprecation warnings.

## Result
If any errors are found, they'll be displayed allong with information about which passage they were found in, what kind of error was found and if possible some of the surrounding text/content.

If no errors are found, you'll receive a message saying so.
