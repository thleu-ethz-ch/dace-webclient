const load = require('./nodeLoader');
require('../dist/layoutLib');

const graph = "bert";
const layouter = new layoutLib.layouter.SugiyamaLayouter();
const runs = 10;

layoutLib.Bench.runtime(load, layouter, [graph, graph], runs, true).then(result => {
    console.log(JSON.stringify(result[1]));
});
