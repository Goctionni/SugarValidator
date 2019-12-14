const fs = require('fs');
if (!process.argv[2]) throw 'Please include filename as argument. Ie: node sugarValidator ./MyGame.html'
const showWarnings = (process.argv[3] === '--warn');
const fileExists = fs.existsSync(process.argv[2]);
if (!fileExists) {
    console.log(`\x1b[31mFile '${process.argv[2]}' could not be found\x1b[0m`);
    return;
}
const fileData = fs.readFileSync(process.argv[2], { encoding: 'UTF-8' });

const entityMap = {
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': `'`,
    '&amp;': '&',
};
function decodeHTML(encodedStr) {
    const input = Object.keys(entityMap);
    for(const k of input) {
        const v = entityMap[k];
        while(encodedStr.indexOf(k) !== -1) {
            encodedStr = encodedStr.replace(k, v);
        }
    }
    return encodedStr;
}

function getHTMLAttr(html, attr) {
    const startStr = `${attr}="`;
    const start = html.indexOf(startStr);
    if (start === -1) return null;
    const end = html.indexOf('"', start + startStr.length);
    if (end === -1) return null;
    return html.substring(start + startStr.length, end);
}

const passageStartTag = '<tw-passagedata';
const passageCloseTag = '</tw-passagedata>';
const passages = [];
const passageNameIndex = {};
const passageIdIndex = {};
let lastIndex = 0;
while(true) {
    const startIndex = fileData.indexOf(passageStartTag, lastIndex);
    if (startIndex === -1) break;
    const endIndex = fileData.indexOf(passageCloseTag, startIndex);
    if (endIndex === -1) throw 'Unclosed passage found: ' + fileData.substr(startIndex, 200);
    const contentIndex = fileData.indexOf('>', startIndex) + 1;
    const header = fileData.substring(startIndex, contentIndex);
    const content = decodeHTML(fileData.substring(contentIndex, endIndex));
    const id = getHTMLAttr(header, 'pid');
    const name = getHTMLAttr(header, 'name');
    const passage = { header, content, id, name };


    // Add stuff
    passages.push(passage);
    if (name) passageNameIndex[name] = passage;
    if (id) passageIdIndex[id] = passage;
    lastIndex = endIndex + passageCloseTag.length;
}

function throwError(msg, passage) {
    console.log('\x1b[31m' + passage.header + '\x1b[0m');
    console.log(msg.replace(/\n/g, '\\n').replace(/\t/g, '\\t'));
    console.log('');
    throw 'Error';
}

function matchGTLT(html, passage) {
    while(true) {
        const start = html.lastIndexOf('<<');
        const end = html.indexOf('>>', start);
        if (start === -1 && end === -1) return;
        if (start === -1 || end === -1) {
            let partial;
            if (start !== -1) partial = html.substr(start, 40);
            if (end !== -1) partial =  html.substr(end - 20, 40);
            return throwError(`Mismatch found in << >> in passage (${partial})`, passage);
        }
        html = html.substr(0, start) + html.substr(end + 2);
    }
}

function matchIfs(html, passage) {
    while(true) {
        const start = html.lastIndexOf('<<if ');
        // If there is no <<if
        if (start === -1) {
            // But there's still an /if, elseif or else, something's fucked
            if (html.indexOf('<</if>>') !== -1) return throwError('Unmatched <</if>> found in passage', passage);
            if (html.indexOf('<<elseif') !== -1) return throwError('Unmatched <<elseif found in passage', passage);
            if (html.indexOf('<<else>>') !== -1) return throwError('Unmatched <<else>> found in passage', passage);
            // If none of those still exist, we're good
            return;
        }
        // If there still is an <<if
        // Make sure there is also an <</if>>
        const end1 = html.indexOf('<</if>>', start);
        const end2 = html.indexOf('<<endif>>', start);
        const end = (end2 === -1) ? end1 : (end1 === -1) ? end2 : Math.min(end1, end2);
        if (end === -1) return throwError('Unmatched <<if found in passage ' + html.substr(start, 40), passage);
        // Only look between the <<if and <</if>>
        const endOfIf = html.indexOf('>>', start);
        // But make sure our <<if isn't completely broken
        if (endOfIf > end) return throwError('Malformed <<if found in passage', passage);
        // Get content
        const content = html.substring(endOfIf + 2, end);
        // Check if there is an <<else>>
        const elseIndex = content.indexOf('<<else>>', start);
        // If so, make sure there isn't a another <<else>> or an <<elseif after the <<else>>
        if (elseIndex !== -1) {
            if (content.indexOf('<<else>>', elseIndex + 1) !== -1) return throwError('Double <<else>> found inside if block in passage', passage);
            if (content.indexOf('<<elseif', elseIndex + 1) !== -1) return throwError('<<elseif found after <<else>> found inside if block in passage', passage);
        }
        // Remove this if block from the HTML
        html = html.substr(0, start) + html.substr(end + 7);
    }
}

function findDeprecatedInPassage(html, passage) {
    const deprecationMap = {
        '<<click': '<<link',
        '<<endclick>>': '<</link>>',
        '<</click>>': '<</link>>',
        '<<endif>>': '<</if>>',
        '<<endnobr>>': '<</nobr>>',
        '<<endsilently>>': '<</silently>>',
        '<<endfor>>': '<</for>>',
        '<<endscript>>': '<</script>>',
        '<<endbutton>>': '<</button>>',
        '<<endappend>>': '<</append>>',
        '<<endprepend>>': '<</prepend>>',
        '<<endreplace>>': '<</replace>>',
        '<<endwidget>>': '<</widget>>',
        '<<setplaylist': '<<createplaylist',
        '<<stopallaudio>>': '<<audio ":all" stop>>',
        '<<display': '<<include',
        'state.active.variables': 'State.variables',
	    'State.initPRNG(': 'State.prng.init(',
        '.containsAll(': '.includesAll(',
        '.containsAny(': '.includesAny(',
        '.flatten(': '.flat(',
    };
    const deprecationKeys = Object.keys(deprecationMap);
    let hasWarned = false;
    for (const key of deprecationKeys) {
        if (html.indexOf(key) !== -1) {
            if (!hasWarned) console.log('\x1b[33m' + passage.header + '\x1b[0m');
            console.log(`Deprecated markup found in passage (${key} should be ${deprecationMap[key]})`);
            hasWarned = true;
        }
    }
    if (hasWarned) console.log('');
}

function findDeprecatedInScript() {
    const deprecationMap = {
        'state.active.variables': 'State.variables',
	    'State.initPRNG(': 'State.prng.init(',
        '.containsAll(': '.includesAll(',
        '.containsAny(': '.includesAny(',
        '.flatten(': '.flat(',
    };
    const deprecationKeys = Object.keys(deprecationMap);
    let hasWarned = false;
    for (const key of deprecationKeys) {
        const startIndex = fileData.indexOf(key);
        if (startIndex !== -1) {
            if (!hasWarned) console.log('\x1b[33mDeprecated code found in Twine User-script\x1b[0m');
            const endOfLineIndex = fileData.indexOf('\n', startIndex);
            const lines = fileData.substring(0, endOfLineIndex).split('\n');
            const line = lines[lines.length - 1].trim();
            console.log(`\x1b[1mLine ${lines.length}:\x1b[0m ${line}`);
            console.log(`'\x1b[1m${key}\x1b[0m' should be '\x1b[1m${deprecationMap[key]}\x1b[0m'`);
            hasWarned = true;
        }
    }
    if (hasWarned) console.log('');
}

let errorsFound = false;
for(const passage of passages) {
    try {
        matchGTLT(passage.content, passage);
        matchIfs(passage.content, passage);
        if (showWarnings) {
            findDeprecatedInPassage(passage.content, passage);
        }
    } catch(e) {
        errorsFound = true;
    }
}
if (showWarnings) {
    findDeprecatedInScript();
}

console.log(`${errorsFound ? '\x1b[31m' : '\x1b[32m'}sugarValidator has finished ${errorsFound ? 'with' : 'without'} errors\x1b[0m`);
