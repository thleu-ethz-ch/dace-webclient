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
import SimpleShape from "./simpleShape";
import * as PIXI from "pixi.js";
import LayoutUtil from "../layouter/layoutUtil";
var Ellipse = /** @class */ (function (_super) {
    __extends(Ellipse, _super);
    function Ellipse(x, y, width, height, backgroundColor, borderColor) {
        if (backgroundColor === void 0) { backgroundColor = 0xFFFFFF; }
        if (borderColor === void 0) { borderColor = 0x000000; }
        var _this = _super.call(this, x, y, width, height) || this;
        _this._backgroundColor = backgroundColor;
        _this._borderColor = borderColor;
        return _this;
    }
    Ellipse.prototype.render = function (container) {
        var ellipse = new PIXI.Graphics();
        ellipse.lineStyle(1, this._borderColor, 1);
        ellipse.beginFill(this._backgroundColor);
        var centerBox = LayoutUtil.cornerToCenter(this.boundingBox());
        ellipse.drawEllipse(centerBox.x, centerBox.y, this._width / 2, this._height / 2);
        ellipse.endFill();
        container.addChild(ellipse);
    };
    return Ellipse;
}(SimpleShape));
export default Ellipse;
//# sourceMappingURL=ellipse.js.map