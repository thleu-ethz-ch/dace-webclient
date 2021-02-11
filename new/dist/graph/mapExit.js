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
import Text from "../layout/text";
import LayoutUtil from "../layout/layoutUtil";
import DownwardTrapezoid from "../layout/downwardTrapezoid";
var MapExit = /** @class */ (function (_super) {
    __extends(MapExit, _super);
    function MapExit() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MapExit.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new DownwardTrapezoid(x, y, size.width, size.height),
                new Text(x + MapExit.PADDING_X, y + MapExit.PADDING_Y, _this._label),
            ];
        };
    };
    MapExit.prototype.size = function () {
        return LayoutUtil.textSize(this._label, 12, MapExit.PADDING_X, MapExit.PADDING_Y);
    };
    MapExit.PADDING_X = 30;
    MapExit.PADDING_Y = 10;
    return MapExit;
}(SdfgNode));
export default MapExit;
//# sourceMappingURL=mapExit.js.map