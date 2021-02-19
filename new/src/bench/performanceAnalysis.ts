import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";

export default class PerformanceAnalysis {
    private _layouter: Layouter = null;

    constructor(layouter: Layouter) {
        this._layouter = layouter;
    }

    measure(name: string, runs: number = 3) {
        return Loader.load(name).then(graph => {
            const start = Date.now();
            for (let run = 0; run < runs; ++run) {
                const layout = this._layouter.layout(graph);
            }
            const end = Date.now();
            return ((end - start) / 3);
        });
    }
}