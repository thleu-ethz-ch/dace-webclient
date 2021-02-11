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
import Text from "../layout/text";
import LayoutUtil from "../layout/layoutUtil";
import Ellipse from "../layout/ellipse";
var AccessNode = /** @class */ (function (_super) {
    __extends(AccessNode, _super);
    function AccessNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AccessNode.prototype.shapes = function () {
        var _this = this;
        return function (x, y) {
            var size = _this.size();
            return [
                new Ellipse(x, y, size.width, size.height),
                new Text(x + AccessNode.PADDING, y + AccessNode.PADDING, _this._label),
            ];
        };
    };
    AccessNode.prototype.size = function () {
        return LayoutUtil.textSize(this._label, 12, AccessNode.PADDING, AccessNode.PADDING);
    };
    AccessNode.PADDING = 10;
    return AccessNode;
}(SdfgNode));
export default AccessNode;
//# sourceMappingURL=accessNode.js.map