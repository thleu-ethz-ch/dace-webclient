import SdfgGraph from "../graph/sdfgGraph";
import Group from "../layout/group";
import * as _ from "lodash";
import LayoutUtil from "./layoutUtil";
import Edge from "../layout/edge";
import Layouter from "./layouter";
import dagre from "dagre";
import SdfgNode from "../graph/sdfgNode";
import {MapNode} from "../graph/map";

export default class DagreLayouter extends Layouter {
    layout(graph: SdfgGraph): Group {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph({});
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });
        _.forEach(graph.nodes, (node) => {
            if (node.childGraph() !== null) {
                if (node.childGraph().nodes.length > 0) {
                    const childLayout = this.layout(node.childGraph());
                    node.setChildGraphSize(childLayout.boundingBox());
                    const constructor = <typeof SdfgNode>node.constructor;
                    childLayout.offset(constructor.CHILD_PADDING, constructor.CHILD_PADDING);
                    if (node instanceof MapNode) {
                        _.forEach(node.childGraph().nodes, (childNode) => {

                        });
                    }
                    node.setChildGraphLayout(childLayout);
                } else {
                    node.setChildGraphSize({width: 0, height: 0});
                }
            }
            if (node.size().width === Number.NEGATIVE_INFINITY) {
                console.log('size', node.size(), node);
            }
            dagreGraph.setNode(node.id, node.size());
        });
        _.forEach(graph.edges, (edge) => {
            dagreGraph.setEdge(edge.src, edge.dst, {}, edge.id);
        });

        // call dagre layouter
        this.applyDagre(dagreGraph);

        // create layout
        const layout = new Group();
        layout.reference = graph;
        _.forEach(graph.nodes, (node) => {
            const dagreNode = dagreGraph.node(node.id);
            const cornerBox = LayoutUtil.centerToCorner(dagreNode);
            const shape = node.shape(cornerBox.x, cornerBox.y);
            shape.reference = node;
            layout.addElement(shape);
        });
        _.forEach(graph.edges, (edge) => {
            const dagreEdge = dagreGraph.edge(edge.src, edge.dst, edge.id);
            const edgeShape = new Edge(dagreEdge.points);
            this.matchEdgesToConnectors(edge, edgeShape, graph);
            edgeShape.reference = edge;
            layout.addElement(edgeShape);
        });
        return layout;
    }

    applyDagre(dagreGraph) {
        dagre.layout(dagreGraph);
    }
}