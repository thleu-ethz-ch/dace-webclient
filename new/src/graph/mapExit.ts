import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import Size from "../layout/size";
import LayoutElement from "../layout/layoutElement";
import LayoutUtil from "../layout/layoutUtil";
import DownwardTrapezoid from "../layout/downwardTrapezoid";

export default class MapExit extends SdfgNode {
    public static PADDING_X = 30;
    public static PADDING_Y = 10;

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            const size = this.size();
            return [
                new DownwardTrapezoid(x, y, size.width, size.height),
                new Text(x + MapExit.PADDING_X, y + MapExit.PADDING_Y, this._label),
            ];
        };
    }

    size(): Size {
        return LayoutUtil.textSize(this._label, 12, MapExit.PADDING_X, MapExit.PADDING_Y);
    }
}