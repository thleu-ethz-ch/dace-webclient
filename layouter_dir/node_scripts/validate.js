const load = require('./nodeLoader');
require('../dist/layoutLib');
const layouter = new layoutLib.layouter.SugiyamaLayouter({shuffles: 16, shuffleGlobal: true, preorderConnectors: true, orderNodes: "NONE"});
layoutLib.Bench.validate(load, layouter, layoutLib.Bench.GRAPHS_POLYBENCH).catch((e) => {
    console.error(e);
});
