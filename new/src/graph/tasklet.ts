import SdfgNode from "./sdfgNode";
import Size from "../layout/size";
import Shape from "../layout/shape";
import Octagon from "../layout/octagon";
import Text from "../layout/text"
import * as _ from "lodash";
import Group from "../layout/group";

export default class Tasklet extends SdfgNode {
    shape(x: number, y: number): Shape {
        const size = this.size();
        const group = new Group(x, y, _.concat([
            new Octagon(0, 0, size.width, size.height),
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
