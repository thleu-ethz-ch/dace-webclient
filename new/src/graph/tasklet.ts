import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Octagon from "../layout/octagon";
import Text from "../layout/text"
import * as _ from "lodash";

export default class Tasklet extends SdfgNode {
    shapes(): Array<Shape> {
        return _.concat([
            new Octagon(this, this._x, this._y, this._width, this._height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], super.shapes());
    }
}
