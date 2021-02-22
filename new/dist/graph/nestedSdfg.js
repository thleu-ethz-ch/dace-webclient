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
import * as _ from "lodash";
import Rectangle from "../layout/rectangle";
import SdfgNode from "./sdfgNode";
var NestedSdfg = /** @class */ (function (_super) {
    __extends(NestedSdfg, _super);
    function NestedSdfg() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NestedSdfg.prototype.shapes = function () {
        return _.concat([
            new Rectangle(this, this._x, this._y, this._width, this._height),
        ], _super.prototype.shapes.call(this));
    };
    NestedSdfg.CHILD_PADDING = 20;
    return NestedSdfg;
}(SdfgNode));
export default NestedSdfg;
//# sourceMappingURL=nestedSdfg.js.map