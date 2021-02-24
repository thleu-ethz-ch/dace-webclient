import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import * as _ from "lodash";
import Octagon from "../layout/octagon";
import Text from "../layout/text";
import Size from "../layout/size";
import FoldedCornerRectangle from "../layout/foldedCornerRectangle";

export default class LibraryNode extends SdfgNode {
    shapes(): Array<Shape> {
        return _.concat(super.shapes(), [
            new FoldedCornerRectangle(this, this.x, this.y, this.width, this.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ]);
    }
}