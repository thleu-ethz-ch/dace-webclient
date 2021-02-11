import * as _ from "lodash";
import dagre from "dagre";
import SdfgGraph from "../graph/sdfgGraph";
import Layout from "./layout";
import SdfgNode from "../graph/sdfgNode";
import Edge from "./edge";
import LayoutUtil from "./layoutUtil";

export default class Layouter {
    static layout(graph: SdfgGraph): Layout {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph({});
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });
        _.forEach(graph.nodes, (node, id) => {
            dagreGraph.setNode(id, node.size());
        });
        _.forEach(graph.edges, (edge, id) => {
            dagreGraph.setEdge(edge.src, edge.dst, {}, id);
        });

        // call dagre layouter
        dagre.layout(dagreGraph);

        // create layout
        const layout = new Layout();
        _.forEach(graph.nodes, (node, id) => {
            const dagreNode = dagreGraph.node(id);
            this.addNodeToLayout(node, id, dagreNode, layout, null);
        });
        _.forEach(graph.edges, (edge, id) => {
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, id);
            layout.addElement(new Edge(dagreEdge.points), edge, null);
        });
        return layout;
    }

    static addNodeToLayout(node: SdfgNode, nodeId: number, dagreNode, layout: Layout, parentNodeId: number) {
        const cornerBox = LayoutUtil.centerToCorner(dagreNode);
        _.forEach((node.shapes())(cornerBox.x, cornerBox.y), (shape) => {
            layout.addElement(shape, node, parentNodeId);
            const childLayout = node.childLayout(nodeId);
            if (childLayout !== null) {
                childLayout.offset(cornerBox.x, cornerBox.y);
                layout.addElement(childLayout, null, nodeId);
            }
        });
    }
}
