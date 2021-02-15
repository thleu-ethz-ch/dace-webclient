import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import Shape from "../layout/shape";
import LayoutUtil from "../layouter/layoutUtil";
import Ellipse from "../layout/ellipse";
import Group from "../layout/group";

export default class AccessNode extends SdfgNode {
    public static PADDING = 10;

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y, [
            new Ellipse(0, 0, size.width, size.height),
            new Text(AccessNode.PADDING, AccessNode.PADDING, this._label),
        ]);
        group.reference = this;
        return group;
    }

    size() {
        return this.labelSize();
    }
}
