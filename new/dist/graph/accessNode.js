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
import Ellipse from "../layout/ellipse";
import Group from "../layout/group";
var AccessNode = /** @class */ (function (_super) {
    __extends(AccessNode, _super);
    function AccessNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AccessNode.prototype.shape = function (x, y) {
        var size = this.size();
        var group = new Group(x, y, [
            new Ellipse(0, 0, size.width, size.height),
            new Text(AccessNode.PADDING, AccessNode.PADDING, this._label),
        ]);
        group.reference = this;
        return group;
    };
    AccessNode.prototype.size = function () {
        return this.labelSize();
    };
    AccessNode.PADDING = 10;
    return AccessNode;
}(SdfgNode));
export default AccessNode;
//# sourceMappingURL=accessNode.js.map