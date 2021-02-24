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
import * as _ from "lodash";
var AccessNode = /** @class */ (function (_super) {
    __extends(AccessNode, _super);
    function AccessNode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AccessNode.prototype.shapes = function () {
        return _.concat(_super.prototype.shapes.call(this), [
            new Ellipse(this, this.x, this.y, this.width, this.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ]);
    };
    return AccessNode;
}(SdfgNode));
export default AccessNode;
//# sourceMappingURL=accessNode.js.map