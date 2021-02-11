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
import Parser from "../parse/parser";
import Rectangle from "../layout/rectangle";
import Layouter from "../layout/layouter";
var SdfgState = /** @class */ (function (_super) {
    __extends(SdfgState, _super);
    function SdfgState(jsonNode) {
        var _this = _super.call(this, jsonNode) || this;
        _this._graph = Parser.parse(jsonNode);
        return _this;
    }
    SdfgState.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new Rectangle(x, y, size.width, size.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR),
            ];
        };
    };
    SdfgState.prototype.childGraph = function () {
        return this._graph;
    };
    SdfgState.prototype.childLayout = function () {
        if (this._childLayout === null) {
            this._childLayout = Layouter.layout(this._graph);
            this._childLayout.offset(SdfgState.PADDING, SdfgState.PADDING);
        }
        return this._childLayout;
    };
    SdfgState.prototype.size = function () {
        var box = this.childLayout().boundingBox();
        return {
            width: box.width + 2 * SdfgState.PADDING,
            height: box.height + 2 * SdfgState.PADDING,
        };
    };
    SdfgState.PADDING = 20;
    SdfgState.BACKGROUND_COLOR = 0xDEEBF7;
    return SdfgState;
}(SdfgNode));
export default SdfgState;
//# sourceMappingURL=sdfgState.js.map