import DagreLayouter from "../layouter/dagreLayouter";
import LayoutAnalysis from "./layoutAnalysis";
import Layouter from "../layouter/layouter";
import PerformanceAnalysis from "./performanceAnalysis";
import RenderGraph from "../renderGraph/renderGraph";
import Serializer from "../util/serializer";
import LayoutGraph from "../layoutGraph/layoutGraph";

export default class Bench {
    public static GRAPHS_SMALL = ["gemm_opt", "jacobi", "placement", "symm", "syrk", "trisolv", "trmm", "wrong"];
    public static GRAPHS_MEDIUM = ["bert2", "encbwd", "eos", "linfrmr"," tile", "unreadable", "VA-gpu", "yolov4-fus"]
    public static GRAPHS_LARGE = ["bert", "lulesh-with-maps", "rgf_dense"];
    public static GRAPHS_ALL = ["bert", "bert2", "encbwd", "eos", "gemm_opt", "jacobi", "linfrmr", "lulesh-with-maps", "placement", "rgf_dense", "symm", "syrk", "tile", "trisolv", "trmm", "unreadable", "VA-gpu", "wrong", "yolov4-fus"];
    public static GRAPHS_POLYBENCH = ["npbench/polybench/adi", "npbench/polybench/atax", "npbench/polybench/bicg", "npbench/polybench/cholesky", "npbench/polybench/correlation", "npbench/polybench/covariance", "npbench/polybench/deriche", "npbench/polybench/doitgen", "npbench/polybench/durbin", "npbench/polybench/fdtd_2d", "npbench/polybench/floyd_warshall", "npbench/polybench/gemm", "npbench/polybench/gemver", "npbench/polybench/gesummv", "npbench/polybench/gramschmidt", "npbench/polybench/heat_3d", "npbench/polybench/jacobi_1d", "npbench/polybench/jacobi_2d", "npbench/polybench/k2mm", "npbench/polybench/k3mm", "npbench/polybench/lu", "npbench/polybench/ludcmp", "npbench/polybench/mvt", "npbench/polybench/nussinov", "npbench/polybench/seidel_2d", "npbench/polybench/symm", "npbench/polybench/syr2k", "npbench/polybench/syrk", "npbench/polybench/trisolv", "npbench/polybench/trmm"];
    public static GRAPHS_NPBENCH = ["npbench/pythran/arc_distance", "npbench/weather_stencils/vadv", "npbench/azimint_hist", "npbench/azimint_naive", "npbench/cavity_flow", "npbench/channel_flow", "npbench/compute", "npbench/go_fast", "npbench/mandelbrot1", "npbench/nbody", "npbench/scattering_self_energies", "npbench/stockham_fft"];

    public static validate(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then(async (renderGraph: RenderGraph) => {
                 return await layouter.layout(renderGraph).then((layout: LayoutGraph) => {
                    const layoutAnalysis = new LayoutAnalysis(layout, layouter.getOptionsForAnalysis());
                    return layoutAnalysis.validate();
                });
            });
        });
        return Serializer.serializePromises(promises);
    }

    public static cost(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then(async (renderGraph: RenderGraph) => {
                return await layouter.layout(renderGraph).then((layout: LayoutGraph) => {
                    const layoutAnalysis = new LayoutAnalysis(layout, layouter.getOptionsForAnalysis());
                    return layoutAnalysis.cost();
                });
            });
        });
        return Serializer.serializePromises(promises);
    }

    public static numRanks(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then(async (renderGraph: RenderGraph) => {
                return await layouter.layout(renderGraph).then((layout: LayoutGraph) => {
                    return layout.numRanks;
                });
            });
        });
        return Serializer.serializePromises(promises);
    }

    public static crossings(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL) {
        const promises = graphs.map(name => {
            return loadFunction(name).then(async (renderGraph: RenderGraph) => {
                return await layouter.layout(renderGraph).then((layout: LayoutGraph) => {
                    const layoutAnalysis = new LayoutAnalysis(layout, layouter.getOptionsForAnalysis());
                    return layoutAnalysis.segmentCrossings();
                });
            });
        });
        return Serializer.serializePromises(promises);
    }

    public static runtime(loadFunction: (name: string) => Promise<RenderGraph>, layouter: Layouter, graphs: Array<string> = Bench.GRAPHS_ALL, runs: number = 10, breakdown: boolean = false) {
        const promises = graphs.map(name => {
            return loadFunction(name).then((renderGraph: RenderGraph) => {
                const performanceAnalysis = new PerformanceAnalysis(layouter);
                return performanceAnalysis.measure(renderGraph, runs, breakdown);
            });
        });
        return Serializer.serializePromises(promises);
    }
}
