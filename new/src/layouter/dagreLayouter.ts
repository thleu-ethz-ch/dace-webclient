import * as _ from "lodash";
import dagre from "dagre";
import Layouter from "./layouter";
import LayoutUtil from "./layoutUtil";
import MapNode from "../graph/mapNode";
import ScopeNode from "../graph/scopeNode";
import SdfgEdge from "../graph/sdfgEdge";
import SdfgGraph from "../graph/sdfgGraph";
import SdfgNode from "../graph/sdfgNode";

export default class DagreLayouter implements Layouter {
    layout(graph: SdfgGraph): void {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph({});
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });
        _.forEach(graph.nodes(), (node: SdfgNode) => {
            if (node.childGraph() !== null) {
                const constructor = <typeof SdfgNode>node.constructor;
                let childGraphBox = {
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                };
                if (node.childGraph().nodes().length > 0) {
                    this.layout(node.childGraph());
                    childGraphBox = node.childGraph().boundingBox();
                    // child graph's contents can have negative coordinates
                    node.childGraph().offsetChildren(constructor.CHILD_PADDING - childGraphBox.x, constructor.CHILD_PADDING - childGraphBox.y);
                    if (node instanceof MapNode) {
                        _.forEach(node.childGraph().nodes(), (childNode) => {
                            if (childNode instanceof ScopeNode) {
                                const childNodeBox = childNode.boundingBox();
                                childNode.setWidth(childGraphBox.width);
                                childNode.offset(- childNodeBox.x, 0);
                            }
                        });
                    }
                }
                node.setSize({
                    width: childGraphBox.width + 2 * constructor.CHILD_PADDING,
                    height: childGraphBox.height + 2 * constructor.CHILD_PADDING,
                });
            }
            dagreGraph.setNode(node.id, node.size());
        });
        _.forEach(graph.edges(), (edge: SdfgEdge) => {
            dagreGraph.setEdge(edge.src, edge.dst, {}, edge.id);
        });

        // call dagre layouter
        this.applyDagre(dagreGraph);

        // store layout information in nodes
        _.forEach(graph.nodes(), (node: SdfgNode) => {
            const dagreNode = dagreGraph.node(node.id);
            const cornerBox = LayoutUtil.centerToCorner(dagreNode);
            node.setPosition(cornerBox);
        });
        _.forEach(graph.edges(), (edge: SdfgEdge) => {
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, edge.id);
            edge.setPoints(dagreEdge.points);
        });
    }

    applyDagre(dagreGraph) {
        dagre.layout(dagreGraph);
    }
}