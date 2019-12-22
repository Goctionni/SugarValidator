function validate(fileData) {
    const validationErrors = {};
    const validationWarnings = {}

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

    function recodeHTML(str) {
        const recodeMap = Object.keys(entityMap).reduce((map, key) => {
            const intermediate = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36) + Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
            return [
                ...map,
                { replace: key, intermediate, find: entityMap[key] },
            ];
        }, []);
        // Find replace find's with intermediate's
        for (const { replace, intermediate, find } of recodeMap) {
            while(str.indexOf(find) !== -1) {
                str = str.replace(find, intermediate);
            }
        }
        // Then replace intermediate's with replace's
        for (const { replace, intermediate, find } of recodeMap) {
            while(str.indexOf(intermediate) !== -1) {
                str = str.replace(intermediate, replace);
            }
        }
        return str;
    }

    const exclusionMarkup = [
        ['"""', '"""', 'Markup escape'],
        ['<nowiki>', '</nowiki>', 'Markup escape'],
        ['{{{', '}}}', 'Markup escape'],
        ['<<script>>', '<</script>>', 'Script']
    ];
    function recodeExcludedHTML(html, header) {
        let startIndex = 0;
        while(true) {
            let firstIndex = html.length;
            let firstMarkup = null;
            for(const markup of exclusionMarkup) {
                const index = html.indexOf(markup[0], startIndex);
                if (index !== -1 && index < firstIndex) {
                    firstIndex = index;
                    firstMarkup = markup;
                }
            }
            // If none of the opening markup can be found, we're done
            if (!firstMarkup) {
                return html;
            }
            // If something is found, find the matching closing markup
            const closingIndex = html.indexOf(firstMarkup[1], firstIndex + firstMarkup[0].length);
            // If no closing markup is found, add a warning and stop trying to exclude further markup
            if (closingIndex === -1) {
                addWarning([
                    [`Found $$1 opening '$$2', but no subsequent closing '$$3'`, firstMarkup[2], firstMarkup[0], firstMarkup[1]],
                ], header);
                return html;
            }
            // modify html to re-encode the excluded markup
            html = html.substr(0, firstIndex + firstMarkup[0].length) + recodeHTML(html.substring(firstIndex + firstMarkup[0].length, closingIndex)) + html.substr(closingIndex);
            startIndex = closingIndex + firstMarkup[1].length;
        }
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
        const content = recodeExcludedHTML(decodeHTML(fileData.substring(contentIndex, endIndex)), header);
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
        validationErrors[passage.header] = msg.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        throw 'Error';
    }

    function addWarning(msg, header) {
        if (!validationWarnings[header]) validationWarnings[header] = [];
        validationWarnings[header].push(msg);
    }

    function matchQuotes(html, passage) {
        const numDoubleQuotes = html.split('"').length - 1;
        const numSingleQuotes = html.split("'").length - 1;
        const unevenDoubleQuotes = (numDoubleQuotes % 2) === 1;
        const unevenSingleQuotes = (numSingleQuotes % 2) === 1; // single quotes can reasonably be used in plain english
        if (unevenDoubleQuotes) addWarning([['Uneven number of double-quotes in passage']], passage.header);
        // if (unevenSingleQuotes) addWarning([['Uneven number of single-quotes in']], passage.header);
    }
    
    function matchGTLT(html, passage) {
        while(true) {
            const start = html.lastIndexOf('<<');
            const end = html.indexOf('>>', start);
            if (start === -1 && end === -1) return;
            if (start === -1 || end === -1) {
                let partial;
                if (start !== -1) {
                    partial = html.substr(start, 40);
                    return throwError(`Found an opening '<<' without matching '>>' (${partial})`, passage);
                }
                if (end !== -1) {
                    partial = html.substr(end - 20, 40);
                    return throwError(`Found a closing '>>' without matching '<<' (${partial})`, passage);
                }
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

    function findInvalidConditions(html, passage) {
        const matches = html.match(/<<(else)?if [^>]* is(not)? (gt|gte|lt|lte) [^>]*>>/g);
        if (matches) return throwError(`Invalid condition found: '${matches[0]}', is/isnot should not be used in combination with lt/lte/gt/gte`, passage);
    }

    function checkInvalidWidgets(html, passage) {
        // Find our tags
        const tags = getHTMLAttr(passage.header, 'tags');
        // If one of this passage's tags is widget, we dont need to check if there are invalid widgets, cause they'd be valid in this passage
        if (tags.split(' ').indexOf('widget') !== -1) return;
        // Determine if there are any widget tags
        if (html.indexOf('<<widget ') !== -1) return throwError('<<widget found in passage without a widget tag', passage);
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
        for (const key of deprecationKeys) {
            if (html.indexOf(key) !== -1) {
                addWarning([[`Deprecated markup found in passage ('$$1' should be '$$2')`, key, deprecationMap[key]]], passage.header);
            }
        }
    }
    
    function findDeprecatedInScript() {
        const deprecationMap = {
            'state.active.variables': 'State.variables',
            'State.initPRNG(': 'State.prng.init(',
            '.containsAll(': '.includesAll(',
            '.containsAny(': '.includesAny(',
            '.flatten(': '.flat(',
        };
        let curIndex = fileData.indexOf('id="twine-user-script"');
        const maxIndex = fileData.indexOf('</script>', curIndex);
        const deprecationKeys = Object.keys(deprecationMap);
        for (const key of deprecationKeys) {
            while(true) {
                const startIndex = fileData.indexOf(key, curIndex);
                if (startIndex === -1) break;
                if (startIndex >= maxIndex) break;
                const endOfLineIndex = fileData.indexOf('\n', startIndex);
                const lines = fileData.substring(0, endOfLineIndex).split('\n');
                const line = lines[lines.length - 1].trim();
                addWarning([
                    ['Line $$1: $$2', lines.length, line],
                    ["'$$1' should be '$$2'", key, deprecationMap[key]],
                ], 'Deprecated code found in Twine User-script');
                curIndex = startIndex + key.length;
            }
        }
    }
    
    for(const passage of passages) {
        try {
            matchQuotes(passage.content, passage);
            matchGTLT(passage.content, passage);
            matchIfs(passage.content, passage);
            findDeprecatedInPassage(passage.content, passage);
            findInvalidConditions(passage.content, passage);
            checkInvalidWidgets(passage.content, passage);
        } catch(e) {
            errorsFound = true;
        }
    }
    findDeprecatedInScript();
    
    return {
        errors: validationErrors,
        warnings: validationWarnings,
    };
}

if (typeof module !== 'undefined') module.exports = validate;