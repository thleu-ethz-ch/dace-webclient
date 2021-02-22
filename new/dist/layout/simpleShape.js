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
import Shape from "./shape";
import Edge from "./edge";
var SimpleShape = /** @class */ (function (_super) {
    __extends(SimpleShape, _super);
    function SimpleShape(reference, x, y, width, height) {
        var _this = _super.call(this, reference, x, y) || this;
        _this._width = width;
        _this._height = height;
        return _this;
    }
    SimpleShape.prototype.intersects = function (otherShape) {
        if (otherShape instanceof Edge) {
            return otherShape.intersects(this);
        }
        return _super.prototype.intersects.call(this, otherShape);
    };
    SimpleShape.prototype.boundingBox = function () {
        return {
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height,
        };
    };
    return SimpleShape;
}(Shape));
export default SimpleShape;
//# sourceMappingURL=simpleShape.js.map