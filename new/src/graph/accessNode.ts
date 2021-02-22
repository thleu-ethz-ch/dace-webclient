import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import Shape from "../layout/shape";
import Ellipse from "../layout/ellipse";
import * as _ from "lodash";

export default class AccessNode extends SdfgNode {
    shapes(): Array<Shape> {
        return _.concat(super.shapes(), [
            new Ellipse(this, this._x, this._y, this._width, this._height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ]);
    }
}
