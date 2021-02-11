import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import LayoutElement from "../layout/layoutElement";
import LayoutUtil from "../layout/layoutUtil";
import Ellipse from "../layout/ellipse";

export default class AccessNode extends SdfgNode {
    public static PADDING = 10;

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            const size = this.size();
            return [
                new Ellipse(x, y, size.width, size.height),
                new Text(x + AccessNode.PADDING, y + AccessNode.PADDING, this._label),
            ];
        };
    }

    size() {
        return LayoutUtil.textSize(this._label, 12, AccessNode.PADDING, AccessNode.PADDING)
    }
}
