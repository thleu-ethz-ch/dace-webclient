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
import { Graphics } from "pixi.js";
import SimpleShape from "./simpleShape";
import Color from "./color";
var Rectangle = /** @class */ (function (_super) {
    __extends(Rectangle, _super);
    function Rectangle(reference, x, y, width, height, backgroundColor, borderColor) {
        if (backgroundColor === void 0) { backgroundColor = new Color(255, 255, 255); }
        if (borderColor === void 0) { borderColor = new Color(0, 0, 0); }
        var _this = _super.call(this, reference, x, y, width, height) || this;
        _this._backgroundColor = backgroundColor;
        _this._borderColor = borderColor;
        return _this;
    }
    Rectangle.prototype.render = function (container) {
        var rectangle = new Graphics();
        rectangle.lineStyle(1, this._borderColor.hex(), this._borderColor.alpha);
        rectangle.beginFill(this._backgroundColor.hex(), this._backgroundColor.alpha);
        rectangle.drawRect(0, 0, this._width, this._height);
        rectangle.endFill();
        rectangle.x = this._x;
        rectangle.y = this._y;
        container.addChild(rectangle);
    };
    return Rectangle;
}(SimpleShape));
export default Rectangle;
//# sourceMappingURL=rectangle.js.map