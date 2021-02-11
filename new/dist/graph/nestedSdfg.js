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
var NestedSdfg = /** @class */ (function (_super) {
    __extends(NestedSdfg, _super);
    function NestedSdfg(jsonNode) {
        var _this = _super.call(this, jsonNode) || this;
        _this._graph = Parser.parse(jsonNode.attributes.sdfg);
        return _this;
    }
    NestedSdfg.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new Rectangle(x, y, size.width, size.height),
            ];
        };
    };
    NestedSdfg.prototype.childGraph = function () {
        return this._graph;
    };
    NestedSdfg.prototype.childLayout = function () {
        if (this._childLayout === null) {
            this._childLayout = Layouter.layout(this._graph);
            this._childLayout.offset(NestedSdfg.PADDING, NestedSdfg.PADDING);
        }
        return this._childLayout;
    };
    NestedSdfg.prototype.size = function () {
        var box = this.childLayout().boundingBox();
        return {
            width: box.width + 2 * NestedSdfg.PADDING,
            height: box.height + 2 * NestedSdfg.PADDING,
        };
    };
    NestedSdfg.PADDING = 20;
    return NestedSdfg;
}(SdfgNode));
export default NestedSdfg;
//# sourceMappingURL=nestedSdfg.js.map