import * as _ from "lodash";
import {Graphics} from "pixi.js";
import BoundingBox from "./boundingBox";
import Point from "./point";
import Segment from "./segment";
import Shape from "./shape";

export default class Edge extends Shape {
    private _points: Array<Point>;

    constructor(reference: object, points: Array<Point>) {
        super(reference, 0, 0);
        this._points = _.cloneDeep(points);
        const box = this.boundingBox();
    }

    boundingBox(): BoundingBox {
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
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }
    }

    render(container: PIXI.Container) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        _.forEach(_.tail(this._points), (point: Point) => {
            line.lineTo(point.x, point.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    }

    intersects(otherShape: Shape): any {
        let intersect = false;
        _.forEach(this.segments(), (segmentA) => {
            if (otherShape instanceof Edge) {
                _.forEach(otherShape.segments(), (segmentB) => {
                    intersect = intersect || segmentA.intersects(segmentB);
                });
            } else {
                intersect = intersect || segmentA.intersectsBox(otherShape.boundingBox());
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
    }

    points() {
        return _.cloneDeep(this._points);
    }

    offset(x: number, y: number) {
        _.forEach(this._points, (point: Point) => {
            point.x += x;
            point.y += y;
        });
    }
}