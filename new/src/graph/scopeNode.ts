import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import Group from "../layout/group";
import * as _ from "lodash";
import UpwardTrapezoid from "../layout/upwardTrapezoid";
import Text from "../layout/text";
import Size from "../layout/size";

export default abstract class ScopeNode extends SdfgNode
{
    public static LABEL_PADDING_X = 30;

    private _fixedWidth = null;

    setWidth(width: number) {
        this._fixedWidth = width;
    }

    size(): Size {
        return {
            width: this._fixedWidth || Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        }
    }
}