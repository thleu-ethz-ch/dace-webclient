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
var Polygon = /** @class */ (function (_super) {
    __extends(Polygon, _super);
    function Polygon(x, y, width, height, backgroundColor, borderColor) {
        if (backgroundColor === void 0) { backgroundColor = 0xFFFFFF; }
        if (borderColor === void 0) { borderColor = 0x000000; }
        var _this = _super.call(this, x, y, width, height) || this;
        _this._backgroundColor = backgroundColor;
        _this._borderColor = borderColor;
        return _this;
    }
    Polygon.prototype.render = function (container) {
        var polygon = new PIXI.Graphics();
        polygon.lineStyle(1, this._borderColor, 1);
        polygon.beginFill(this._backgroundColor);
        polygon.drawPolygon(this.getPath());
        polygon.endFill();
        polygon.on('mouseover', function (e) {
            console.log(e);
        });
        container.addChild(polygon);
    };
    return Polygon;
}(SimpleShape));
export default Polygon;
//# sourceMappingURL=polygon.js.map