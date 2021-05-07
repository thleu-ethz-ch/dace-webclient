import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";
import * as _ from "lodash";

export default class PerformanceAnalysis {
    private _layouter: Layouter = null;

    constructor(layouter: Layouter) {
        this._layouter = layouter;
    }

    // adapted from https://gist.github.com/venning/b6593f965773985f923f
    sd(numbers: Array<number>) {
        const mean = _.mean(numbers);
        return Math.sqrt(_.sum(_.map(numbers, (i) => Math.pow((i - mean), 2))) / numbers.length);
    };

    measure(name: string, runs: number = 10) {
        return Loader.load(name).then(graph => {
            const times = [];
            for (let run = 0; run < runs; ++run) {
                const start = Date.now();
                const layout = this._layouter.layout(graph);
                const end = Date.now();
                times.push(end - start);
                if (_.sum(times) < 1000) {
                    runs++;
                }
            }
            return _.sortBy(times)[Math.floor(runs / 2)] + " (" + "±" + this.sd(times).toFixed(0) + ")";
        });
    }
}