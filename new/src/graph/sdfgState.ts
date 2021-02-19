import SdfgNode from "./sdfgNode";
import SdfgGraph from "./sdfgGraph";
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Group from "../layout/group";
import Layouter from "../layouter/layouter";
import Size from "../layout/size";
import Shape from "../layout/shape";

export default class SdfgState extends SdfgNode {
    public static CHILD_PADDING = 20;
    public static BACKGROUND_COLOR = 0xDEEBF7;

    constructor(jsonNode) {
        super(jsonNode);
        this._childGraph = Parser.parse(jsonNode);
    }

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y);
        const rectangle = new Rectangle(0, 0, size.width, size.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR);
        group.addElement(rectangle);
        if (this._childGraphLayout !== null) {
            group.addElement(this._childGraphLayout);
        }
        group.reference = this;
        return group;
    }

    size(): Size {
        return {
            width: this._childGraphSize.width + 2 * SdfgState.CHILD_PADDING,
            height: this._childGraphSize.height + 2 * SdfgState.CHILD_PADDING,
        }
    }
}