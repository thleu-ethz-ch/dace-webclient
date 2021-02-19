import ScopeNode from "./scopeNode";
import Shape from "../layout/shape";
import Group from "../layout/group";
import * as _ from "lodash";
import Text from "../layout/text";
import DownwardTrapezoid from "../layout/downwardTrapezoid";

export default class ExitNode extends ScopeNode
{
    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y, _.concat([
            new DownwardTrapezoid(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
        group.reference = this;
        return group;
    }
}