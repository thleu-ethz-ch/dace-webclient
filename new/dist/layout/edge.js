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
import Shape from "./shape";
var Edge = /** @class */ (function (_super) {
    __extends(Edge, _super);
    function Edge(points) {
        var _this = _super.call(this, 0, 0) || this;
        _this._boundingBox = null;
        _this.points = points;
        return _this;
    }
    Edge.prototype.offset = function (x, y) {
        _.forEach(this.points, function (point) {
            point.x += x;
            point.y += y;
        });
    };
    Edge.prototype.boundingBox = function () {
        if (this._boundingBox === null) {
            this.updateBoundingBox();
        }
        return this._boundingBox;
    };
    Edge.prototype.render = function (container) {
        var line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = _.head(this.points).x;
        line.y = _.head(this.points).y;
        line.moveTo(0, 0);
        _.forEach(_.tail(this.points), function (point) {
            line.lineTo(point.x - line.x, point.y - line.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    };
    Edge.prototype.updateBoundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, function (point) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.min(maxY, point.y);
        });
        this._boundingBox = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };
    return Edge;
}(Shape));
export default Edge;
//# sourceMappingURL=edge.js.map