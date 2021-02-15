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
import UpwardTrapezoid from "../layout/upwardTrapezoid";
import * as _ from "lodash";
import Group from "../layout/group";
var MapEntry = /** @class */ (function (_super) {
    __extends(MapEntry, _super);
    function MapEntry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MapEntry.prototype.shape = function (x, y) {
        var size = this.size();
        var group = new Group(x, y, _.concat([
            new UpwardTrapezoid(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
        group.reference = this;
        return group;
    };
    MapEntry.prototype.size = function () {
        return {
            width: Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        };
    };
    MapEntry.LABEL_PADDING_X = 30;
    return MapEntry;
}(SdfgNode));
export default MapEntry;
//# sourceMappingURL=mapEntry.js.map