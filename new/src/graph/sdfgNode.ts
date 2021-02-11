import SdfgGraph from "./sdfgGraph";
import Layout from "../layout/layout";
import Size from "../layout/size";
import LayoutElement from "../layout/layoutElement";

export default abstract class SdfgNode
{
    protected _childLayout = null;
    protected _label;

    constructor(jsonNode) {
        this._label = jsonNode.label;
    }

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            return [];
        };
    }

    childGraph(): SdfgGraph {
        return null;
    }

    childLayout(nodeId: number): Layout {
        return null;
    }

    size(): Size {
        return {
            width: 0,
            height: 0,
        };
    }
}
