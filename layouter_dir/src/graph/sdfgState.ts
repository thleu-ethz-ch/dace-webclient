import * as _ from "lodash";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Rectangle from "../layout/rectangle";
import Color from "../layout/color";

export default class SdfgState extends SdfgNode {
    public static CHILD_PADDING = 20;
    public static BACKGROUND_COLOR = new Color(0xDE, 0xEB, 0xF7);

    shapes(): Array<Shape> {
        return _.concat([
            new Rectangle(this, this.x, this.y, this.width, this.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR),
        ], super.shapes());
    }
}