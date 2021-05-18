const load = require('./nodeLoader');
require('../dist/layoutLib');

const graph = "bert";
const layouter = new layoutLib.layouter.SugiyamaLayouter();

layoutLib.Bench.runtime(load, layouter, [graph], 1, true).then(result => {
    console.log(JSON.stringify(result[0][0]));
});
