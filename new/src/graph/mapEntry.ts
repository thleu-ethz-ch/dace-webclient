import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import Size from "../layout/size";
import Shape from "../layout/shape";
import UpwardTrapezoid from "../layout/upwardTrapezoid";
import * as _ from "lodash";
import Group from "../layout/group";

export default class MapEntry extends SdfgNode {
    public static LABEL_PADDING_X = 30;

    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y, _.concat([
            new UpwardTrapezoid(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
        group.reference = this;
        return group;
    }

    size(): Size {
        return {
            width: Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        }
    }
}