import * as _ from "lodash";
import SdfgGraph from "./sdfgGraph";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Rectangle from "../layout/rectangle";

export default class MapNode extends SdfgNode {
    constructor(id: number, graph: SdfgGraph, nodes: Array<SdfgNode>) {
        super(id, graph);
        this._childGraph = new SdfgGraph();
        _.forEach(nodes, (node) => {
            node.graph = this._childGraph;
            this._childGraph.addNode(node, node.id);
        });
    }

    node(id: number): SdfgNode {
        return this._childGraph.node(id);
    }

    /*shapes(): Array<Shape> {
        return _.concat([new Rectangle(this, this._x, this._y, this._width, this._height, 0xFF0000)], super.shapes());
    }*/
}
