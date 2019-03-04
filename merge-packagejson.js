const fs = require('fs-extra');

Promise.all([
    fs.readFile('./package.json'),
]).then((buffers) => {
    const contentApp = JSON.parse(buffers[0].toString());
    delete contentApp.devDependencies;
    contentApp.scripts = {
        start: "node lib/run.js"
    };

    return fs.writeFile('./dist/package.json', JSON.stringify(contentApp, null, 4));
});