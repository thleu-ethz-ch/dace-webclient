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
import Polygon from "./polygon";
var DownwardTrapezoid = /** @class */ (function (_super) {
    __extends(DownwardTrapezoid, _super);
    function DownwardTrapezoid() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DownwardTrapezoid.prototype.getPath = function () {
        return [
            this._x, this._y,
            this._x + this._width, this._y,
            this._x + this._width - this._height, this._y + this._height,
            this._x + this._height, this._y + this._height,
        ];
    };
    return DownwardTrapezoid;
}(Polygon));
export default DownwardTrapezoid;
//# sourceMappingURL=downwardTrapezoid.js.map