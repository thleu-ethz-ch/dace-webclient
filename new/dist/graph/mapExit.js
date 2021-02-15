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
import DownwardTrapezoid from "../layout/downwardTrapezoid";
import * as _ from "lodash";
import Group from "../layout/group";
var MapExit = /** @class */ (function (_super) {
    __extends(MapExit, _super);
    function MapExit() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    MapExit.prototype.shape = function (x, y) {
        var size = this.size();
        return new Group(x, y, _.concat([
            new DownwardTrapezoid(0, 0, size.width, size.height),
            new Text(this.labelPosition().x, this.labelPosition().y, this._label),
        ], this.connectorShapes(0, 0)));
    };
    MapExit.prototype.size = function () {
        return {
            width: Math.max(this.labelSize().width, this.connectorsWidth()),
            height: this.labelSize().height,
        };
    };
    MapExit.LABEL_PADDING_X = 30;
    return MapExit;
}(SdfgNode));
export default MapExit;
//# sourceMappingURL=mapExit.js.map