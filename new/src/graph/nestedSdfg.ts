import SdfgNode from "./sdfgNode";
import SdfgGraph from "./sdfgGraph";
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Layout from "../layout/layout";
import Layouter from "../layout/layouter";
import Size from "../layout/size";
import LayoutElement from "../layout/layoutElement";
import LayoutUtil from "../layout/layoutUtil";

export default class NestedSdfg extends SdfgNode {
    public static PADDING = 20;

    private _graph: SdfgGraph;

    constructor(jsonNode) {
        super(jsonNode);
        this._graph = Parser.parse(jsonNode.attributes.sdfg);
    }

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            const size = this.size();
            return [
                new Rectangle(x, y, size.width, size.height),
            ];
        };
    }

    childGraph(): SdfgGraph {
        return this._graph;
    }

    childLayout(): Layout {
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