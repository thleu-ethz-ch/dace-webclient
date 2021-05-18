const flush = require('flush-cache');

let graph = "unreadable";
let runs = 10;

require('../dist/layoutLib');

const coldTimes = [];
layoutLib.util.Serializer.repeatFunction(run => {
    flush();
    const load = require('./nodeLoader');
    require('../dist/layoutLib');
    const layouter = new layoutLib.layouter.SugiyamaLayouter();
    layoutLib.Bench.runtime(load, layouter, [graph], 1, true).then(result => {
        coldTimes.push(result[0][0]);
        if (coldTimes.length === runs) {
            const times = {
                cold: layoutLib.util.Timer.combineTimes(coldTimes),
            };
            layoutLib.Bench.runtime(load, layouter, [graph, graph], runs, true).then(result => {
                times.warm = result[1];
                console.log(JSON.stringify(times));
            });
        }
    });
}, runs);
