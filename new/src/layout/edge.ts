import Point from "./point";
import * as _ from "lodash";
import BoundingBox from "./boundingBox";
import {Graphics} from "pixi.js";
import Shape from "./shape";
import LayoutUtil from "../layouter/layoutUtil";
import Segment from "./segment";
import Group from "./group";

export default class Edge extends Shape {
    private _points: Array<Point>;
    private _boundingBox = null;

    constructor(points: Array<Point>) {
        super(0, 0);
        this._points = points;
        const box = this.boundingBox();
        this._x = box.x;
        this._y = box.y;
        _.forEach(this._points, (point) => {
            point.x -= box.x;
            point.y -= box.y;
        });
    }

    boundingBox(): BoundingBox {
        if (this._boundingBox === null) {
            this.updateBoundingBox();
        }
        return _.clone(this._boundingBox); // clone prevents that the bounding box gets mutated
    }

    render(container: PIXI.Container) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = this._x;
        line.y = this._y;
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        _.forEach(_.tail(this._points), (point: Point) => {
            line.lineTo(point.x, point.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    }

    intersects(otherShape: Shape): any {
        let intersect = false;
        _.forEach(this.globalSegments(), (segmentA) => {
            if (otherShape instanceof Edge) {
                _.forEach(otherShape.globalSegments(), (segmentB) => {
                    intersect = intersect || segmentA.intersects(segmentB);
                });
            } else {
                intersect = intersect || segmentA.intersectsBox(otherShape.globalBoundingBox());
            }
        });
        return intersect;
    }

    segments(): Array<Segment> {
        const segments = [];
        let start = _.clone(this._points[0]);
        let end = _.clone(this._points[1]);
        for (let i = 2; i < this._points.length; ++i) {
            const deltaXPrev = end.x - start.x;
            const deltaYPrev = end.y - start.y;
            const deltaXNext = this._points[i].x - end.x;
            const deltaYNext = this._points[i].y - end.y;
            if (deltaXPrev * deltaYNext === deltaXNext * deltaYPrev) {
                end = _.clone(this._points[i]);
            } else {
                segments.push(new Segment(start, end));
                start = _.clone(end);
                end = _.clone(this._points[i]);
            }
        }
        segments.push(new Segment(start, end));
        return segments;
    }

    globalSegments(): Array<Segment> {
        const segments = this.segments();
        const offset = this.globalPosition();
        _.forEach(segments, (segment: Segment) => {
            segment.start.x += offset.x;
            segment.start.y += offset.y;
            segment.end.x += offset.x;
            segment.end.y += offset.y;
        });
        return segments;
    }

    clone(): Shape {
        const clone = <Edge>super.clone();
        clone.clear();
        _.forEach(this._points, (point) => {
            clone.addPoint(_.clone(point));
        });
        return clone;
    }

    clear() {
        this._points = [];
    }

    addPoint(point: Point) {
        this._points.push(_.clone(point));
        this.invalidateBoundingBox();
    }

    setFirstPoint(point: Point) {
        this._points[0] = _.clone(point);
        //this.invalidateBoundingBox();
    }

    setLastPoint(point: Point) {
        _.assign(_.last(this._points), point);
        //this.invalidateBoundingBox();
    }

    get points() {
        return _.map(this._points, (point) => _.clone(point));
    }

    globalPoints() {
        const points = this.points;
        const offset = this.globalPosition();
        return _.map(points, (point) => LayoutUtil.add(point, offset));
    }

    invalidateBoundingBox() {
        this._boundingBox = null;
        if (this.parent !== null) {
            (<Group>this.parent).invalidateBoundingBox();
        }
    }

    private updateBoundingBox() {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, (point: Point) => {
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
        }
    }
}