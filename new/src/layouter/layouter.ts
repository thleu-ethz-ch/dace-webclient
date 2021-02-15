import * as _ from "lodash";
import dagre from "dagre";
import SdfgGraph from "../graph/sdfgGraph";
import Group from "../layout/group";
import SdfgNode from "../graph/sdfgNode";
import Edge from "../layout/edge";
import LayoutUtil from "./layoutUtil";
import SdfgEdge from "../graph/sdfgEdge";

export default class Layouter {
    static layout(graph: SdfgGraph): Group {
        // create dagre graph
        const dagreGraph = new dagre.graphlib.Graph({multigraph: true});
        dagreGraph.setGraph({});
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });
        _.forEach(graph.nodes, (node) => {
            dagreGraph.setNode(node.id, node.size());
        });
        _.forEach(graph.edges, (edge) => {
            dagreGraph.setEdge(edge.src, edge.dst, {}, edge.id);
        });

        // call dagre layouter
        dagre.layout(dagreGraph);

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

    static matchEdgesToConnectors(edge: SdfgEdge, edgeShape: Edge, graph: SdfgGraph): void {
        if (edge.srcConnector !== null) {
            const connector = graph.node(edge.src).retrieveConnector("OUT", edge.srcConnector);
            const circle = connector.shape;
            edgeShape.points[0] = LayoutUtil.cornerToCenter(circle.globalBoundingBox());
        }
        if (edge.dstConnector !== null) {
            const connector = graph.node(edge.dst).retrieveConnector("IN", edge.dstConnector);
            const circle = connector.shape;
            _.assign(_.last(edgeShape.points), LayoutUtil.cornerToCenter(circle.globalBoundingBox()));
        }
    }
}
