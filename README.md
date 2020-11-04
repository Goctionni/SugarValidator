# SugarValidator
Validates SugarCube games, find bugs quickly and easily

## Description
This is a validator made for SugarCube games. It takes your game's HTML file as input, collects all passages from the game and does some basic validation checks to check that `<<` and `>>` are matched correctly, and that the `<<if>>` `<<elseif>>` `<<else>>` `<</if>>` are structured correctly.

Most SugarCube games will ship with a few of these types of errors. Now you can easily check for them and fix them before your users do.

## How to use

* You can run this in your browser
* You can install this as an npm-package
  * Run it in cli
  * As a module in your script
* You can run this tool as a node-script

### Running in your browser

You can run this tool [in the browser](https://goctionni.github.io/SugarValidator/index.html), simply drag and drop your game's html file to see any issues. Depending on the filesize, the results can be near instant or take a while.

### Install as an NPM package

Once installed as an NPM package, you can use `sugarvalidator` as a cli command (with path to the file to parse), or as a module in your script.

To install NPM Package, run

```sh
# global
npm i sugarvalidator -g
# local
npm i sugarvalidator
```

**Use via CLI**
```sh
# If installed globally, or running as npm-script
sugarvalidator ./MyGame.html
# If installed locally
./node_modules/.bin/sugarvalidator ./MyGame.html
```

**Use as Module**
```javascript
const html = '' // your game's HTML-file-content
const validate = require('sugarvalidator');
console.log(validate(html));
```

### Running this tool as a node-script

* Create a new folder within your project (ie: validator)
* Download the files as a zip
* Extract the files into the newly created folder
* Run the following command:

```sh
$ node ./validator/cli ./YourGame.html
```