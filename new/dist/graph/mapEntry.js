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
import UpwardTrapezoid from "../layout/updwardTrapezoid";
var MapEntry = /** @class */ (function (_super) {
    __extends(MapEntry, _super);
    function MapEntry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MapEntry.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new UpwardTrapezoid(x, y, size.width, size.height),
                new Text(x + MapEntry.PADDING_X, y + MapEntry.PADDING_Y, _this._label),
            ];
        };
    };
    MapEntry.prototype.size = function () {
        return LayoutUtil.textSize(this._label, 12, MapEntry.PADDING_X, MapEntry.PADDING_Y);
    };
    MapEntry.PADDING_X = 30;
    MapEntry.PADDING_Y = 10;
    return MapEntry;
}(SdfgNode));
export default MapEntry;
//# sourceMappingURL=mapEntry.js.map