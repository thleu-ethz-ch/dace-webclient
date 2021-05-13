import DagreLayouter from "../layouter/dagreLayouter";
import LayoutAnalysis from "./layoutAnalysis";
import Layouter from "../layouter/layouter";
import RenderGraph from "../renderGraph/renderGraph";
import PerformanceAnalysis from "./performanceAnalysis";
import Serializer from "../util/serializer";

export default class Bench {
    public static GRAPHS_SMALL = ["gemm_opt", "jacobi", "placement", "symm", "syrk", "trisolv", "trmm", "wrong"];
    public static GRPAHS_MEDIUM = ["bert2", "encbwd", "unreadable", "VA-gpu"]
    public static GRAPHS_LARGE = ["bert", "lulesh-with-maps", "rgf_dense"];
    public static GRAPHS_ALL = ["bert", "bert2", "encbwd", "gemm_opt", "jacobi", "lulesh-with-maps", "placement", "rgf_dense", "symm", "syrk", "trisolv", "trmm", "unreadable", "VA-gpu", "wrong"];

    public static LAYOUTERS = [new DagreLayouter()];

    public static validate(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then((renderGraph: RenderGraph) => {
                const layoutGraph = layouter.layout(renderGraph);
                const layoutAnalysis = new LayoutAnalysis(layoutGraph, layouter.getOptionsForAnalysis());
                if (!layoutAnalysis.validate()) {
                    throw new Error('Layouter returned invalid layout for graph "' + name + '".');
                }
            });
        })
        return Promise.all(promises);
    }

    public static cost(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then((renderGraph: RenderGraph) => {
                const layoutGraph = layouter.layout(renderGraph);
                const layoutAnalysis = new LayoutAnalysis(layoutGraph, layouter.getOptionsForAnalysis());
                return layoutAnalysis.cost();
            });
        });
        return Promise.all(promises);
    }

    public static crossings(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then((renderGraph: RenderGraph) => {
                const layoutGraph = layouter.layout(renderGraph);
                const layoutAnalysis = new LayoutAnalysis(layoutGraph, layouter.getOptionsForAnalysis());
                return layoutAnalysis.segmentCrossings();
            });
        });
        return Promise.all(promises);
    }

    public static performance(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            const performanceAnalysis = new PerformanceAnalysis(layouter);
            return performanceAnalysis.measure(name);
        });
        return Serializer.serializePromises(promises);
    }

}