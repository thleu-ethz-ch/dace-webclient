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
import Group from "../layout/group";
var NestedSdfg = /** @class */ (function (_super) {
    __extends(NestedSdfg, _super);
    function NestedSdfg(jsonNode) {
        var _this = _super.call(this, jsonNode) || this;
        _this._childGraph = Parser.parse(jsonNode.attributes.sdfg);
        return _this;
    }
    NestedSdfg.prototype.shape = function (x, y) {
        var size = this.size();
        var group = new Group(x, y);
        group.addElement(new Rectangle(0, 0, size.width, size.height));
        if (this._childGraphLayout !== null) {
            group.addElement(this._childGraphLayout);
        }
        group.addElements(this.connectorShapes(0, 0));
        return group;
    };
    NestedSdfg.prototype.size = function () {
        return {
            width: this._childGraphSize.width + 2 * NestedSdfg.CHILD_PADDING,
            height: this._childGraphSize.height + 2 * NestedSdfg.CHILD_PADDING,
        };
    };
    NestedSdfg.CHILD_PADDING = 20;
    return NestedSdfg;
}(SdfgNode));
export default NestedSdfg;
//# sourceMappingURL=nestedSdfg.js.map