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
import LayoutUtil from "../layouter/layoutUtil";
import Segment from "./segment";
var Edge = /** @class */ (function (_super) {
    __extends(Edge, _super);
    function Edge(points) {
        var _this = _super.call(this, 0, 0) || this;
        _this._boundingBox = null;
        _this._points = points;
        var box = _this.boundingBox();
        _this._x = box.x;
        _this._y = box.y;
        _.forEach(_this._points, function (point) {
            point.x -= box.x;
            point.y -= box.y;
        });
        return _this;
    }
    Edge.prototype.boundingBox = function () {
        if (this._boundingBox === null) {
            this.updateBoundingBox();
        }
        return _.clone(this._boundingBox); // clone prevents that the bounding box gets mutated
    };
    Edge.prototype.render = function (container) {
        var line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = this._x;
        line.y = this._y;
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        _.forEach(_.tail(this._points), function (point) {
            line.lineTo(point.x, point.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    };
    Edge.prototype.intersects = function (otherShape) {
        var intersect = false;
        _.forEach(this.globalSegments(), function (segmentA) {
            if (otherShape instanceof Edge) {
                _.forEach(otherShape.globalSegments(), function (segmentB) {
                    intersect = intersect || segmentA.intersects(segmentB);
                });
            }
            else {
                intersect = intersect || segmentA.intersectsBox(otherShape.globalBoundingBox());
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
    Edge.prototype.globalSegments = function () {
        var segments = this.segments();
        var offset = this.globalPosition();
        _.forEach(segments, function (segment) {
            segment.start.x += offset.x;
            segment.start.y += offset.y;
            segment.end.x += offset.x;
            segment.end.y += offset.y;
        });
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
        this.invalidateBoundingBox();
    };
    Edge.prototype.setFirstPoint = function (point) {
        this._points[0] = _.clone(point);
        //this.invalidateBoundingBox();
    };
    Edge.prototype.setLastPoint = function (point) {
        _.assign(_.last(this._points), point);
        //this.invalidateBoundingBox();
    };
    Object.defineProperty(Edge.prototype, "points", {
        get: function () {
            return _.map(this._points, function (point) { return _.clone(point); });
        },
        enumerable: false,
        configurable: true
    });
    Edge.prototype.globalPoints = function () {
        var points = this.points;
        var offset = this.globalPosition();
        return _.map(points, function (point) { return LayoutUtil.add(point, offset); });
    };
    Edge.prototype.invalidateBoundingBox = function () {
        this._boundingBox = null;
        if (this.parent !== null) {
            this.parent.invalidateBoundingBox();
        }
    };
    Edge.prototype.updateBoundingBox = function () {
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