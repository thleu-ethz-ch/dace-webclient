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
import Segment from "./segment";
import Shape from "./shape";
var Edge = /** @class */ (function (_super) {
    __extends(Edge, _super);
    function Edge(reference, points) {
        var _this = _super.call(this, reference, 0, 0) || this;
        _this._points = _.cloneDeep(points);
        var box = _this.boundingBox();
        return _this;
    }
    Edge.prototype.boundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, function (point) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
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
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        _.forEach(_.tail(this._points), function (point) {
            line.lineTo(point.x, point.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    };
    Edge.prototype.intersects = function (otherShape) {
        var intersect = false;
        _.forEach(this.segments(), function (segmentA) {
            if (otherShape instanceof Edge) {
                _.forEach(otherShape.segments(), function (segmentB) {
                    intersect = intersect || segmentA.intersects(segmentB);
                });
            }
            else {
                intersect = intersect || segmentA.intersectsBox(otherShape.boundingBox());
            }
        });
        return intersect;
    };
    Edge.prototype.segments = function () {
        var segments = [];
        var start = _.clone(this._points[0]);
        var end = _.clone(this._points[1]);
        for (var i = 2; i < this._points.length; ++i) {
            var deltaXPrev = end.x - start.x;
            var deltaYPrev = end.y - start.y;
            var deltaXNext = this._points[i].x - end.x;
            var deltaYNext = this._points[i].y - end.y;
            if (deltaXPrev * deltaYNext === deltaXNext * deltaYPrev) {
                end = _.clone(this._points[i]);
            }
            else {
                segments.push(new Segment(start, end));
                start = _.clone(end);
                end = _.clone(this._points[i]);
            }
        }
        segments.push(new Segment(start, end));
        return segments;
    };
    Edge.prototype.clone = function () {
        var clone = _super.prototype.clone.call(this);
        clone.clear();
        _.forEach(this._points, function (point) {
            clone.addPoint(_.clone(point));
        });
        return clone;
    };
    Edge.prototype.clear = function () {
        this._points = [];
    };
    Edge.prototype.addPoint = function (point) {
        this._points.push(_.clone(point));
    };
    Edge.prototype.points = function () {
        return _.cloneDeep(this._points);
    };
    Edge.prototype.offset = function (x, y) {
        _.forEach(this._points, function (point) {
            point.x += x;
            point.y += y;
        });
    };
    return Edge;
}(Shape));
export default Edge;
//# sourceMappingURL=edge.js.map