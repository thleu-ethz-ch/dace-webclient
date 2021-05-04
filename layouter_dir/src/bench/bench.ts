import DagreLayouter from "../layouter/dagreLayouter";
import LayoutAnalysis from "./layoutAnalysis";
import Layouter from "../layouter/layouter";
import RenderGraph from "../renderGraph/renderGraph";

export default class Bench {
    public static GRAPHS_SMALL = ["gemm_opt", "jacobi", "placement", "symm", "syrk", "trisolv", "trmm", "wrong"];
    public static GRAPHS_LARGE = ["bert", "encbwd", "lulesh-with-maps", "unreadable", "rgf_dense"];
    public static GRAPHS_ALL = ["bert", "encbwd", "gemm_opt", "jacobi", "lulesh-with-maps", "placement", "rgf_dense", "symm", "syrk", "trisolv", "trmm", "unreadable", "wrong"];

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

}