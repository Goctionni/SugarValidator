const fs = require('fs');
if (!process.argv[2]) {
    throw 'Please include filename as argument. Ie: node sugarValidator ./MyGame.html'
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
    console.log(msg, passage.header);
    throw 'Error';
}

function matchGTLT(html, passage) {
    while(true) {
        const start = html.lastIndexOf('<<');
        const end = html.indexOf('>>', start);
        if (start === -1 && end === -1) return;
        if (start === -1 || end === -1) {
            if (start !== -1) console.log(html.substr(start, 40));
            if (end !== -1) console.log(html.substr(end - 20, 40));

            throwError('Mismatch found in << >> in passage', passage);
            throw 'Error';
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
        const end = html.indexOf('<</if>>', start);
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

for(const passage of passages) {
    break;
    try {
        matchGTLT(passage.content, passage);
        matchIfs(passage.content, passage);
    } catch { }
}
