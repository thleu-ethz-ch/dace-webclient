import * as _ from "lodash";
import Layouter from "./layouter";
import LayoutNode from "../layoutGraph/layoutNode";
import LayoutGraph from "../layoutGraph/layoutGraph";

export default abstract class RecursiveLayouter extends Layouter {
    doLayout(graph: LayoutGraph, withLabels: boolean = false) {
        this.setNodeSizes(graph, withLabels);
        this.layoutSizedGraph(graph, withLabels);
        this._placeConnectorsCenter(graph);
        this._matchEdgesToConnectors(graph);
    }

    setNodeSizes(graph: LayoutGraph, withLabels: boolean = false) {
        _.forEach(graph.nodes(), (node: LayoutNode) => {
            if (node.childGraph !== null) {
                const childGraph = <LayoutGraph>node.childGraph;
                let childGraphBox = {
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                };
                if (childGraph.nodes().length > 0) {
                    this.doLayout(childGraph, withLabels);
                    childGraphBox = childGraph.boundingBox();
                    // child graph's contents can have negative coordinates
                    childGraph.translateElements(node.padding - childGraphBox.x, node.padding - childGraphBox.y);

                    // make entry and exit nodes match parent width
                    if (childGraph.entryNode !== null) {
                        const childNodeBox = childGraph.entryNode.boundingBox();
                        childGraph.entryNode.setWidth(childGraphBox.width);
                        childGraph.entryNode.translate(-childNodeBox.x, 0);
                    }
                    if (childGraph.exitNode !== null) {
                        const childNodeBox = childGraph.exitNode.boundingBox();
                        childGraph.exitNode.setWidth(childGraphBox.width);
                        childGraph.exitNode.translate(-childNodeBox.x, 0);
                    }
                }
                node.setSize({
                    width: childGraphBox.width + 2 * node.padding,
                    height: childGraphBox.height + 2 * node.padding,
                });
            }
        });
    }

    abstract layoutSizedGraph(graph: LayoutGraph, withLabels: boolean);
}
