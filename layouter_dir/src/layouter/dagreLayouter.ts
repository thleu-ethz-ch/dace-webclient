import * as _ from "lodash";
import dagre from "dagre";
import LayoutUtil from "./layoutUtil";
import SdfgEdge from "../graph/sdfgEdge";
import SdfgGraph from "../graph/sdfgGraph";
import SdfgNode from "../graph/sdfgNode";
import RecursiveLayouter from "./recursiveLayouter";

export default class DagreLayouter extends RecursiveLayouter {
    public static EDGE_LABEL_OFFSET = 3;

    layoutSizedGraph(graph: SdfgGraph, withLabels: boolean = false): void {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph(this.graphOptions(withLabels));
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });

        _.forEach(graph.nodes(), (node: SdfgNode) => {
            dagreGraph.setNode(node.id, node.size());
        });

        _.forEach(graph.edges(), (edge: SdfgEdge) => {
            const edgeOptions: any = {};
            if (withLabels) {
                edgeOptions.labelpos = "r";
                edgeOptions.labeloffset = DagreLayouter.EDGE_LABEL_OFFSET;
                _.assign(edgeOptions, edge.labelSize());
            }
            dagreGraph.setEdge(edge.src, edge.dst, edgeOptions, edge.id);
        });

        // call dagre layouter
        dagre.layout(dagreGraph);

        // store layout information in nodes
        _.forEach(graph.nodes(), (node: SdfgNode) => {
            const dagreNode = dagreGraph.node(node.id);
            const cornerBox = LayoutUtil.centerToCorner(dagreNode);
            node.setPosition(cornerBox);
        });
        _.forEach(graph.edges(), (edge: SdfgEdge) => {
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, edge.id);
            edge.points = dagreEdge.points;
            edge.updateBoundingBox();
            if (withLabels) {
                const labelSize = edge.labelSize();
                if (labelSize) {
                    edge.labelX = dagreEdge.x - labelSize.width / 2 + DagreLayouter.EDGE_LABEL_OFFSET;
                    edge.labelY = dagreEdge.y - labelSize.height / 2;
                }
            }
        });
    }

    graphOptions(withLabels) {
        if (withLabels) {
            return {edgesep: 30};
        }
        return {};
    }
}