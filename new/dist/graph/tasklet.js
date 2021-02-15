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
import Group from "../layout/group";
var Tasklet = /** @class */ (function (_super) {
    __extends(Tasklet, _super);
    function Tasklet() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Tasklet.prototype.shape = function (x, y) {
        var size = this.size();
        var group = new Group(x, y, _.concat([
            new Octagon(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
        group.reference = this;
        return group;
    };
    Tasklet.prototype.size = function () {
        return {
            width: Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        };
    };
    return Tasklet;
}(SdfgNode));
export default Tasklet;
//# sourceMappingURL=tasklet.js.map