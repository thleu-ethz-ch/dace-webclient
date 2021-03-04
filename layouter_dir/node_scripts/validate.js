const load = require('./nodeLoader');
require('../dist/layoutLib');
const layouter = new layoutLib.DagreLayouter();
layoutLib.Bench.validate(load, layouter, ["lulesh-with-maps"]).catch((e) => {
    console.error(e);
});
