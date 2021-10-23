importScripts('sugarValidatorLib.js');

onmessage = (event) => {
    const { fileData, localStorage } = event.data;
    const results = validate(fileData, localStorage);
    postMessage(results);
}
