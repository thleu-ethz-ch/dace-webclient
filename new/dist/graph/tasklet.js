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
import Octagon from "../layout/octagon";
import Text from "../layout/text";
import * as _ from "lodash";
var Tasklet = /** @class */ (function (_super) {
    __extends(Tasklet, _super);
    function Tasklet() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Tasklet.prototype.shapes = function () {
        return _.concat([
            new Octagon(this, this._x, this._y, this._width, this._height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], _super.prototype.shapes.call(this));
    };
    return Tasklet;
}(SdfgNode));
export default Tasklet;
//# sourceMappingURL=tasklet.js.map