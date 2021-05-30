import * as _ from "lodash";
import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";
import Timer from "../util/timer";
import RenderGraph from "../renderGraph/renderGraph";

export default class PerformanceAnalysis {
    private _layouter: Layouter = null;

    constructor(layouter: Layouter) {
        this._layouter = layouter;
    }

    // adapted from https://gist.github.com/venning/b6593f965773985f923f
    public sd(numbers: Array<number>): number {
        const mean = _.mean(numbers);
        return Math.sqrt(_.sum(_.map(numbers, (i) => Math.pow((i - mean), 2))) / numbers.length);
    };

    public async measure(graph: RenderGraph, runs: number = 10, breakdown: boolean = false): Promise<any> {
        const graphCopy = _.cloneDeep(graph);
        const times = [];
        for (let run = 0; run < runs; ++run) {
            Timer.reset();
            const start = Date.now();
            await this._layouter.layout(graphCopy);
            const end = Date.now();
            if (breakdown) {
                times.push(Timer.getTimes());
            } else {
                times.push(end - start);
                if (_.sum(times) < 1000) {
                    runs++;
                }
            }
        }
        if (breakdown) {
            if (runs === 1) {
                return times;
            }
            return Timer.combineTimes(times);
        } else {
            return times;
            //return _.sortBy(times)[Math.floor(runs / 2)] + " (" + "±" + (2 * this.sd(times)).toFixed(0) + ")";
        }
    }
}
