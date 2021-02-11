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
import { Graphics } from "pixi.js";
import LayoutElement from "./layoutElement";
var Edge = /** @class */ (function (_super) {
    __extends(Edge, _super);
    function Edge(points) {
        var _this = _super.call(this) || this;
        _this._points = points;
        return _this;
    }
    Edge.prototype.offset = function (x, y) {
        _.forEach(this._points, function (point) {
            point.x += x;
            point.y += y;
        });
    };
    Edge.prototype.boundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, function (point) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.min(maxY, point.y);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };
    Edge.prototype.render = function (container) {
        var line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = _.head(this._points).x;
        line.y = _.head(this._points).y;
        line.moveTo(0, 0);
        _.forEach(_.tail(this._points), function (point) {
            line.lineTo(point.x - line.x, point.y - line.y);
        });
        container.addChild(line);
    };
    return Edge;
}(LayoutElement));
export default Edge;
//# sourceMappingURL=edge.js.map