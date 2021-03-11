import * as _ from "lodash";
import dagre from "dagre";
import Box from "../geometry/box";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import RecursiveLayouter from "./recursiveLayouter";

export default class DagreLayouter extends RecursiveLayouter {
    public static EDGE_LABEL_OFFSET = 3;

    layoutSizedGraph(graph: LayoutGraph): void {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph(this.graphOptions());
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });

        _.forEach(graph.nodes(), (node: LayoutNode) => {
            dagreGraph.setNode(node.id, node.size());
        });

        const generalEdgeOptions: any = {};
        if (this._options['withLabels']) {
            generalEdgeOptions.labelpos = "c";
            generalEdgeOptions.labeloffset = DagreLayouter.EDGE_LABEL_OFFSET;
        }
        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            const edgeOptions = _.assign({}, generalEdgeOptions);
            if (this._options['withLabels']) {
                _.assign(edgeOptions, edge.labelSize);
            }
            let edgeId: any = edge.id;
            if (edge.bundle !== null) {
                const connector = edge.srcConnector || edge.dstConnector;
                if (edge.bundle.connectors[0] !== connector) {
                    return; // only add the edge with the first connector
                }
                edgeOptions.weight = edge.bundle.weight;
                edgeId = edge.src + "_" + edge.dst;
            }
            dagreGraph.setEdge(edge.src, edge.dst, edgeOptions, edgeId);
        });

        // call dagre layouter
        dagre.layout(dagreGraph);

        // store layout information in layout graph
        _.forEach(graph.nodes(), (node: LayoutNode) => {
            const dagreNode = dagreGraph.node(node.id);
            const box = new Box(dagreNode.x, dagreNode.y, dagreNode.width, dagreNode.height, true);
            node.setPosition(box.topLeft());
        });
        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            let edgeId: any = edge.id;
            if (edge.bundle !== null) {
                edgeId = edge.src + "_" + edge.dst;
            }
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, edgeId);

            // commented out: duplicate points to prevent curved edges
            /*if (dagreEdge.weight > 1) {
                if (edge.srcConnector === null) {
                    const penultimate = edge.points.length - 2;
                    edge.points.splice(penultimate, 0, _.clone(edge.points[penultimate]));
                } else {
                    edge.points.splice(1, 0, _.clone(edge.points[1]));
                }
            }*/

            edge.points = _.cloneDeep(dagreEdge.points);
            if (this._options['withLabels']) {
                const labelSize = edge.labelSize;
                if (labelSize) {
                    edge.labelX = dagreEdge.x - labelSize.width / 2 + DagreLayouter.EDGE_LABEL_OFFSET;
                    edge.labelY = dagreEdge.y - labelSize.height / 2;
                }
            }

            // move edges without connectors to an invisible connector in the center of the node
            if (!graph.mayHaveCycles) {
                if (edge.srcConnector === null) {
                    edge.points[0] = edge.graph.node(edge.src).boundingBox().bottomCenter();
                }
                if (edge.dstConnector === null) {
                    edge.points[edge.points.length - 1] = edge.graph.node(edge.dst).boundingBox().topCenter();
                }
            }
        });
    }

    graphOptions() {
        const options = {
            ranksep: this._options.targetEdgeLength,
            nodesep: 30,
        }
        if (this._options['withLabels']) {
            options['edgesep'] = 30;
        }
        return options;
    }
}