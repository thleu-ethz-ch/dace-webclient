import SdfgNode from "./sdfgNode";
import SdfgGraph from "./sdfgGraph";
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Group from "../layout/group";
import Layouter from "../layouter/layouter";
import Size from "../layout/size";
import Shape from "../layout/shape";

export default class NestedSdfg extends SdfgNode {
    public static PADDING = 20;

    private _graph: SdfgGraph;

    constructor(jsonNode) {
        super(jsonNode);
        this._graph = Parser.parse(jsonNode.attributes.sdfg);
    }

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y);
        group.addElement(new Rectangle(0, 0, size.width, size.height));
        group.addElement(this.childLayout());
        group.addElements(this.connectorShapes(0, 0))
        return group;
    }

    childGraph(): SdfgGraph {
        return this._graph;
    }

    childLayout(): Group {
        if (this._childLayout === null) {
            this._childLayout = Layouter.layout(this._graph);
            this._childLayout.offset(NestedSdfg.PADDING, NestedSdfg.PADDING);
        }
        return this._childLayout;
    }

    size(): Size {
        const box = this.childLayout().boundingBox();
        return {
            width: box.width + 2 * NestedSdfg.PADDING,
            height: box.height + 2 * NestedSdfg.PADDING,
        }
    }
}