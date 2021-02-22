import * as _ from "lodash";
import Rectangle from "../layout/rectangle";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";

export default class NestedSdfg extends SdfgNode {
    public static CHILD_PADDING = 20;

    shapes(): Array<Shape> {
        return _.concat([
            new Rectangle(this, this._x, this._y, this._width, this._height),
        ], super.shapes());
    }
}