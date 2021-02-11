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
import LayoutElement from "./layoutElement";
var SimpleShape = /** @class */ (function (_super) {
    __extends(SimpleShape, _super);
    function SimpleShape(x, y, width, height) {
        var _this = _super.call(this) || this;
        _this._x = 0;
        _this._y = 0;
        _this._width = 0;
        _this._height = 0;
        _this._x = x;
        _this._y = y;
        _this._width = width;
        _this._height = height;
        return _this;
    }
    SimpleShape.prototype.offset = function (x, y) {
        this._x += x;
        this._y += y;
    };
    SimpleShape.prototype.boundingBox = function () {
        return {
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height
        };
    };
    return SimpleShape;
}(LayoutElement));
export default SimpleShape;
//# sourceMappingURL=simpleShape.js.map