import * as _ from "lodash";
import dagre from "dagre";
import Layout from "./layout";
import Edge from "./edge";
import LayoutUtil from "./layoutUtil";
var Layouter = /** @class */ (function () {
    function Layouter() {
    }
    Layouter.layout = function (graph) {
        var _this = this;
        // create dagre graph
        var dagreGraph = new dagre.graphlib.Graph({ multigraph: true });
        dagreGraph.setGraph({});
        dagreGraph.setDefaultEdgeLabel(function () {
            return {};
        });
        _.forEach(graph.nodes, function (node, id) {
            dagreGraph.setNode(id, node.size());
        });
        _.forEach(graph.edges, function (edge, id) {
            dagreGraph.setEdge(edge.src, edge.dst, {}, id);
        });
        // call dagre layouter
        dagre.layout(dagreGraph);
        // create layout
        var layout = new Layout();
        _.forEach(graph.nodes, function (node, id) {
            var dagreNode = dagreGraph.node(id);
            _this.addNodeToLayout(node, id, dagreNode, layout, null);
        });
        _.forEach(graph.edges, function (edge, id) {
            var dagreEdge = dagreGraph.edge(edge.src, edge.dst, id);
            layout.addElement(new Edge(dagreEdge.points), edge, null);
        });
        return layout;
    };
    Layouter.addNodeToLayout = function (node, nodeId, dagreNode, layout, parentNodeId) {
        var cornerBox = LayoutUtil.centerToCorner(dagreNode);
        _.forEach((node.shapes())(cornerBox.x, cornerBox.y), function (shape) {
            layout.addElement(shape, node, parentNodeId);
            var childLayout = node.childLayout(nodeId);
            if (childLayout !== null) {
                childLayout.offset(cornerBox.x, cornerBox.y);
                layout.addElement(childLayout, null, nodeId);
            }
        });
    };
    return Layouter;
}());
export default Layouter;
//# sourceMappingURL=layouter.js.map