require('../dist/layoutLib');

module.exports = (name) => {
    const path = require('path');
    const url = path.resolve(__dirname, "../graphs/" + name + ".json");
    const json = require(url);
    const graph = layoutLib.Parser.parse(json);

    return new Promise(resolve => {
        resolve(graph);
    });
}