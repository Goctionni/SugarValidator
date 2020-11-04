importScripts('sugarValidatorLib.js');

onmessage = (event) => {
    const results = validate(event.data);
    postMessage(results);
}