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
import SdfgNode from "./sdfgNode";
import Octagon from "../layout/octagon";
import LayoutUtil from "../layout/layoutUtil";
import Text from "../layout/text";
var Tasklet = /** @class */ (function (_super) {
    __extends(Tasklet, _super);
    function Tasklet() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Tasklet.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new Octagon(x, y, size.width, size.height),
                new Text(x + Tasklet.PADDING, y + Tasklet.PADDING, _this._label),
            ];
        };
    };
    Tasklet.prototype.size = function () {
        return LayoutUtil.textSize(this._label, 12, Tasklet.PADDING, Tasklet.PADDING);
    };
    Tasklet.PADDING = 10;
    return Tasklet;
}(SdfgNode));
export default Tasklet;
//# sourceMappingURL=tasklet.js.map