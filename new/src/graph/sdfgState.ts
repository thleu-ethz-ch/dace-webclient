import SdfgNode from "./sdfgNode";
import SdfgGraph from "./sdfgGraph";
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Group from "../layout/group";
import Layouter from "../layouter/layouter";
import Size from "../layout/size";
import Shape from "../layout/shape";

export default class SdfgState extends SdfgNode {
    public static PADDING = 20;
    public static BACKGROUND_COLOR = 0xDEEBF7;

    private _graph: SdfgGraph;

    constructor(jsonNode) {
        super(jsonNode);
        this._graph = Parser.parse(jsonNode);
    }

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y);
        const rectangle = new Rectangle(0, 0, size.width, size.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR);
        group.addElement(rectangle);
        group.addElement(this.childLayout());
        group.reference = this;
        return group;
    }

    childGraph(): SdfgGraph {
        return this._graph;
    }

    childLayout(): Group {
        if (this._childLayout === null) {
            this._childLayout = Layouter.layout(this._graph);
            this._childLayout.offset(SdfgState.PADDING, SdfgState.PADDING);
        }
        return this._childLayout;
    }

    size(): Size {
        const box = this.childLayout().boundingBox();
        return {
            width: box.width + 2 * SdfgState.PADDING,
            height: box.height + 2 * SdfgState.PADDING,
        }
    }
}