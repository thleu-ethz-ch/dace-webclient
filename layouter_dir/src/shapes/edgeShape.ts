import * as _ from "lodash";
import {Graphics} from "pixi.js";
import Box from "../geometry/box";
import Vector from "../geometry/vector";
import Shape from "./shape";

export default class EdgeShape extends Shape {
    private _points: Array<Vector>;

    constructor(reference: object, points: Array<Vector>) {
        super(reference, 0, 0);
        this._points = _.cloneDeep(points);
    }

    boundingBox(): Box {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, (point: Vector) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }

    render(container: PIXI.Container) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        _.forEach(_.tail(this._points), (point: Vector) => {
            line.lineTo(point.x, point.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    }

    /*intersects(otherShape: Shape): any {
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
    }*/

    clone(): Shape {
        const clone = <EdgeShape>super.clone();
        clone.clear();
        _.forEach(this._points, (point) => {
            clone.addPoint(_.clone(point));
        });
        return clone;
    }

    clear() {
        this._points = [];
    }

    addPoint(point: Vector) {
        this._points.push(_.clone(point));
    }

    points() {
        return _.cloneDeep(this._points);
    }

    offset(x: number, y: number) {
        _.forEach(this._points, (point: Vector) => {
            point.x += x;
            point.y += y;
        });
    }
}