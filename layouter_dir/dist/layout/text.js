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
import * as PIXI from "pixi.js";
import SimpleShape from "./simpleShape";
var Text = /** @class */ (function (_super) {
    __extends(Text, _super);
    function Text(x, y, text, fontSize, color) {
        if (fontSize === void 0) { fontSize = 12; }
        if (color === void 0) { color = 0x000000; }
        var _this = this;
        var fontStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: fontSize, fill: color });
        var metrics = PIXI.TextMetrics.measureText(text, fontStyle);
        _this = _super.call(this, null, x, y, metrics.width, metrics.height) || this;
        _this._text = text;
        _this._fontStyle = fontStyle;
        return _this;
    }
    Text.prototype.render = function (group) {
        var pixiText = new PIXI.Text(this._text, this._fontStyle);
        pixiText.x = this._x;
        pixiText.y = this._y;
        group.addChild(pixiText);
    };
    Text.prototype.clone = function () {
        return new Text(this._x, this._y, this._text, this._fontStyle.fontSize, this._fontStyle.fill);
    };
    return Text;
}(SimpleShape));
export default Text;
//# sourceMappingURL=text.js.map