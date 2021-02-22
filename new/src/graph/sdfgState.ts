import * as _ from "lodash";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Rectangle from "../layout/rectangle";

export default class SdfgState extends SdfgNode {
    public static CHILD_PADDING = 20;
    public static BACKGROUND_COLOR = 0xDEEBF7;

    shapes(): Array<Shape> {
        return _.concat([
            new Rectangle(this, this._x, this._y, this._width, this._height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR),
        ], super.shapes());
    }
}