import SdfgNode from "./sdfgNode";
import Rectangle from "../layout/rectangle";
import Text from "../layout/text";
import Size from "../layout/size";
import LayoutElement from "../layout/layoutElement";
import LayoutUtil from "../layout/layoutUtil";
import UpwardTrapezoid from "../layout/updwardTrapezoid";

export default class MapEntry extends SdfgNode {
    public static PADDING_X = 30;
    public static PADDING_Y = 10;

    shapes(): (x: number, y: number) => Array<LayoutElement> {
        return (x, y) => {
            const size = this.size();
            return [
                new UpwardTrapezoid(x, y, size.width, size.height),
                new Text(x + MapEntry.PADDING_X, y + MapEntry.PADDING_Y, this._label),
            ];
        };
    }

    size(): Size {
        return LayoutUtil.textSize(this._label, 12, MapEntry.PADDING_X, MapEntry.PADDING_Y);
    }
}