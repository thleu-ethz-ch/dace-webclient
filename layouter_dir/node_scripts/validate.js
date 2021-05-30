const load = require('./nodeLoader');
require('../dist/layoutLib');
const layouter = new layoutLib.layouter.SugiyamaLayouter({});
layoutLib.Bench.validate(load, layouter, layoutLib.Bench.GRAPHS_ALL).catch((e) => {
    console.error(e);
});
