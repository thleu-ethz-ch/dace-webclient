import * as _ from "lodash";
import DownwardTrapezoid from "../layout/downwardTrapezoid";
import ScopeNode from "./scopeNode";
import Shape from "../layout/shape";
import Text from "../layout/text";

export default class ExitNode extends ScopeNode
{
    shapes(): Array<Shape> {
        return _.concat([
            new DownwardTrapezoid(this, this._x, this._y, this._width, this._height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], super.shapes());
    }
}