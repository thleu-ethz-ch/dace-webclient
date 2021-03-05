import * as _ from "lodash";
import dagre from "dagre";
import Box from "../geometry/box";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import RecursiveLayouter from "./recursiveLayouter";

export default class DagreLayouter extends RecursiveLayouter {
    public static EDGE_LABEL_OFFSET = 3;

    layoutSizedGraph(graph: LayoutGraph, withLabels: boolean = false): void {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph(this.graphOptions(withLabels));
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });

        _.forEach(graph.nodes(), (node: LayoutNode) => {
            dagreGraph.setNode(node.id, node.size());
        });

        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            const edgeOptions: any = {};
            if (withLabels) {
                edgeOptions.labelpos = "r";
                edgeOptions.labeloffset = DagreLayouter.EDGE_LABEL_OFFSET;
                _.assign(edgeOptions, edge.labelSize);
            }
            dagreGraph.setEdge(edge.src, edge.dst, edgeOptions, edge.id);
        });

        // call dagre layouter
        dagre.layout(dagreGraph);

        // store layout information in nodes
        _.forEach(graph.nodes(), (node: LayoutNode) => {
            const dagreNode = dagreGraph.node(node.id);
            const box = new Box(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height, true);
            node.setPosition(box.topLeft());
        });
        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, edge.id);
            edge.points = dagreEdge.points;
            // move edges without connectors to an invisible connector in the center of the node
            if (!graph.mayHaveCycles) {
                if (edge.srcConnector === null) {
                    edge.points[0] = edge.graph.node(edge.src).boundingBox().bottomCenter();
                }
                if (edge.dstConnector === null) {
                    edge.points[edge.points.length - 1] = edge.graph.node(edge.dst).boundingBox().topCenter();
                }
            }
            if (withLabels) {
                const labelSize = edge.labelSize;
                if (labelSize) {
                    edge.labelX = dagreEdge.x - labelSize.width / 2 + DagreLayouter.EDGE_LABEL_OFFSET;
                    edge.labelY = dagreEdge.y - labelSize.height / 2;
                }
            }
        });
    }

    graphOptions(withLabels) {
        const options = {
            ranksep: this._options.targetEdgeLength,
            nodesep: 30,
        }
        if (withLabels) {
            options['edgesep'] = 30;
        }
        return options;
    }
}