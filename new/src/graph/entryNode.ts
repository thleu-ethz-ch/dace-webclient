import ScopeNode from "./scopeNode";
import Shape from "../layout/shape";
import * as _ from "lodash";
import UpwardTrapezoid from "../layout/upwardTrapezoid";
import Text from "../layout/text";

export default class EntryNode extends ScopeNode
{
    shapes(): Array<Shape> {
        return _.concat([
            new UpwardTrapezoid(this, this._x, this._y, this._width, this._height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], super.shapes());
    }
}