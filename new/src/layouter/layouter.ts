import * as _ from "lodash";
import SdfgGraph from "../graph/sdfgGraph";
import Group from "../layout/group";
import Edge from "../layout/edge";
import LayoutUtil from "./layoutUtil";
import SdfgEdge from "../graph/sdfgEdge";

export default abstract class Layouter {

    abstract layout(graph: SdfgGraph);

    matchEdgesToConnectors(edge: SdfgEdge, edgeShape: Edge, graph: SdfgGraph): void {
        if (edge.srcConnector !== null) {
            const connector = graph.node(edge.src).retrieveConnector("OUT", edge.srcConnector);
            const circleBox = connector.shape.globalBoundingBox();
            circleBox.x += circleBox.width / 2;
            circleBox.y += circleBox.height;
            edgeShape.setFirstPoint(LayoutUtil.globalToLocal(circleBox, edgeShape));
        }
        if (edge.dstConnector !== null) {
            const connector = graph.node(edge.dst).retrieveConnector("IN", edge.dstConnector);
            const circleBox = connector.shape.globalBoundingBox();
            circleBox.x += circleBox.width / 2;
            edgeShape.setLastPoint(LayoutUtil.globalToLocal(circleBox, edgeShape));
        }
    }
}
