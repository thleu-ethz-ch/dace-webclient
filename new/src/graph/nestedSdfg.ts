import SdfgNode from "./sdfgNode";
import SdfgGraph from "./sdfgGraph";
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Group from "../layout/group";
import Layouter from "../layouter/layouter";
import Size from "../layout/size";
import Shape from "../layout/shape";

export default class NestedSdfg extends SdfgNode {
    public static CHILD_PADDING = 20;

    constructor(jsonNode) {
        super(jsonNode);
        this._childGraph = Parser.parse(jsonNode.attributes.sdfg);
    }

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y);
        group.addElement(new Rectangle(0, 0, size.width, size.height));
        if (this._childGraphLayout !== null) {
            group.addElement(this._childGraphLayout);
        }
        group.addElements(this.connectorShapes(0, 0))
        return group;
    }

    size(): Size {
        return {
            width: this._childGraphSize.width + 2 * NestedSdfg.CHILD_PADDING,
            height: this._childGraphSize.height + 2 * NestedSdfg.CHILD_PADDING,
        }
    }
}