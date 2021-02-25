var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as _ from "lodash";
import SdfgNode from "./sdfgNode";
import Rectangle from "../layout/rectangle";
import Color from "../layout/color";
var SdfgState = /** @class */ (function (_super) {
    __extends(SdfgState, _super);
    function SdfgState() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SdfgState.prototype.shapes = function () {
        return _.concat([
            new Rectangle(this, this.x, this.y, this.width, this.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR),
        ], _super.prototype.shapes.call(this));
    };
    SdfgState.CHILD_PADDING = 20;
    SdfgState.BACKGROUND_COLOR = new Color(0xDE, 0xEB, 0xF7);
    return SdfgState;
}(SdfgNode));
export default SdfgState;
//# sourceMappingURL=sdfgState.js.map