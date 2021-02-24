import * as _ from "lodash";
import SdfgGraph from "./sdfgGraph";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Rectangle from "../layout/rectangle";

export default class MapNode extends SdfgNode {
    constructor(id: number, graph: SdfgGraph, nodes: Array<SdfgNode>) {
        super(id, graph);
        this.childGraph = new SdfgGraph();
        _.forEach(nodes, (node) => {
            node.graph = this.childGraph;
            this.childGraph.addNode(node, node.id);
        });
    }

    node(id: number): SdfgNode {
        return this.childGraph.node(id);
    }

    /*shapes(): Array<Shape> {
        return _.concat([new Rectangle(this, this.x, this.y, this.width, this.height, 0xFF0000)], super.shapes());
    }*/
}
