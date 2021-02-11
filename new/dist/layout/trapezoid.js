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
var Octagon = /** @class */ (function (_super) {
    __extends(Octagon, _super);
    function Octagon() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Octagon.prototype.getPath = function () {
        var octSeg = this._height / 3.0;
        return [
            this._x, this._y + octSeg,
            this._x + octSeg, this._y,
            this._x + this._width - octSeg, this._y,
            this._x + this._width, this._y + octSeg,
            this._x + this._width, this._y + 2 * octSeg,
            this._x + this._width - octSeg, this._y + this._height,
            this._x + octSeg, this._y + this._height,
            this._x, this._y + 2 * octSeg,
        ];
    };
    return Octagon;
}(Polygon));
export default Octagon;
//# sourceMappingURL=trapezoid.js.map