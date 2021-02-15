import SdfgNode from "./sdfgNode";
import Text from "../layout/text";
import Size from "../layout/size";
import Shape from "../layout/shape";
import DownwardTrapezoid from "../layout/downwardTrapezoid";
import * as _ from "lodash";
import Group from "../layout/group";

export default class MapExit extends SdfgNode {
    public static LABEL_PADDING_X = 30;

    shape(x: number, y: number): Shape {
        const size = this.size();
        return new Group(x, y, _.concat([
            new DownwardTrapezoid(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
    }

    size(): Size {
        return {
            width: Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        }
    }
}