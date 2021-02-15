import Shape from "../layout/shape";
import BoundingBox from "../layout/boundingBox";
import SdfgNode from "./sdfgNode";
import Group from "../layout/group";
import * as _ from "lodash";
import Rectangle from "../layout/rectangle";
import Layouter from "../layouter/layouter";
import SdfgGraph from "./sdfgGraph";
import SdfgEdge from "./sdfgEdge";
import Size from "../layout/size";

export class MapNode extends SdfgNode {
    private _elements: Array<SdfgNode>;
    private _graph: SdfgGraph;

    constructor(id: number, nodes: Array<SdfgNode>) {
        super({id: id});
        this._graph = new SdfgGraph();
        _.forEach(nodes, (node) => {
            this._graph.addNode(node, node.id);
        })
    }

    addEdge(edge) {
        this._graph.addEdge(edge);
    }

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y);
        //group.addElement(new Rectangle(0, 0, this.size().width, this.size().height, 0xFF0000))
        group.addElement(this.childLayout());
        group.addElements(this.connectorShapes(0, 0));
        group.reference = this;
        return group;
    }

    childLayout(): Group {
        if (this._childLayout === null) {
            this._childLayout = Layouter.layout(this._graph);
        }
        return this._childLayout;
    }

    node(id: number): SdfgNode {
        return this._graph.node(id);
    }

    size(): Size {
        const box = this.childLayout().boundingBox();
        return {
            width: Math.max(box.width, this.connectorsWidth()),
            height: box.height,
        }
    }
}
