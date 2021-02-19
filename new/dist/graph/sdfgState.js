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
var SdfgState = /** @class */ (function (_super) {
    __extends(SdfgState, _super);
    function SdfgState(jsonNode) {
        var _this = _super.call(this, jsonNode) || this;
        _this._childGraph = Parser.parse(jsonNode);
        return _this;
    }
    SdfgState.prototype.shape = function (x, y) {
        var size = this.size();
        var group = new Group(x, y);
        var rectangle = new Rectangle(0, 0, size.width, size.height, SdfgState.BACKGROUND_COLOR, SdfgState.BACKGROUND_COLOR);
        group.addElement(rectangle);
        if (this._childGraphLayout !== null) {
            group.addElement(this._childGraphLayout);
        }
        group.reference = this;
        return group;
    };
    SdfgState.prototype.size = function () {
        return {
            width: this._childGraphSize.width + 2 * SdfgState.CHILD_PADDING,
            height: this._childGraphSize.height + 2 * SdfgState.CHILD_PADDING,
        };
    };
    SdfgState.CHILD_PADDING = 20;
    SdfgState.BACKGROUND_COLOR = 0xDEEBF7;
    return SdfgState;
}(SdfgNode));
export default SdfgState;
//# sourceMappingURL=sdfgState.js.map