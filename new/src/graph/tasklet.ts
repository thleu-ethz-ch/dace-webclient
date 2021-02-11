import SdfgNode from "./sdfgNode";
import Size from "../layout/size";
import LayoutElement from "../layout/layoutElement";
import Octagon from "../layout/octagon";
import LayoutUtil from "../layout/layoutUtil";
import Text from "../layout/text";

export default class Tasklet extends SdfgNode {
    public static PADDING = 10;

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            const size = this.size();
            return [
                new Octagon(x, y, size.width, size.height),
                new Text(x + Tasklet.PADDING, y + Tasklet.PADDING, this._label),
            ];
        };
    }

    size(): Size {
        return LayoutUtil.textSize(this._label, 12, Tasklet.PADDING, Tasklet.PADDING)
    }
}
