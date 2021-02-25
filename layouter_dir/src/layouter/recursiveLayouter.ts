import SdfgGraph from "../graph/sdfgGraph";
import * as _ from "lodash";
import SdfgNode from "../graph/sdfgNode";
import MapNode from "../graph/mapNode";
import ScopeNode from "../graph/scopeNode";
import Layouter from "./layouter";

export default abstract class RecursiveLayouter implements Layouter {
    layout(graph: SdfgGraph, withLabels: boolean = false) {
        this.setNodeSizes(graph);
        this.layoutSizedGraph(graph, withLabels);
    }

    setNodeSizes(graph: SdfgGraph) {
        _.forEach(graph.nodes(), (node: SdfgNode) => {
            if (node.childGraph !== null) {
                const constructor = <typeof SdfgNode>node.constructor;
                let childGraphBox = {
                    width: 0,
                    height: 0,
                    x: 0,
                    y: 0,
                };
                if (!node.isCollapsed && node.childGraph.nodes().length > 0) {
                    this.layout(node.childGraph);
                    childGraphBox = node.childGraph.boundingBox();
                    // child graph's contents can have negative coordinates
                    node.childGraph.offsetChildren(constructor.CHILD_PADDING - childGraphBox.x, constructor.CHILD_PADDING - childGraphBox.y);
                    if (node instanceof MapNode) {
                        _.forEach(node.childGraph.nodes(), (childNode) => {
                            if (childNode instanceof ScopeNode) {
                                const childNodeBox = childNode.boundingBox();
                                childNode.setWidth(childGraphBox.width);
                                childNode.offset(-childNodeBox.x, 0);
                            }
                        });
                    }
                }
                node.setSize({
                    width: childGraphBox.width + 2 * constructor.CHILD_PADDING,
                    height: childGraphBox.height + 2 * constructor.CHILD_PADDING,
                });
            }
        });
    }

    abstract layoutSizedGraph(graph: SdfgGraph, withLabels);
}
