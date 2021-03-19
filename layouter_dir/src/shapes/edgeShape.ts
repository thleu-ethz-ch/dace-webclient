import * as _ from "lodash";
import {Graphics} from "pixi.js";
import Box from "../geometry/box";
import Vector from "../geometry/vector";
import Shape from "./shape";
import Segment from "../geometry/segment";

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

    render(container: PIXI.Container, crossings: Map<string, Array<[Vector, number]>> = null) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.moveTo(_.head(this._points).x, _.head(this._points).y);
        let prevPoint = _.head(this._points);
        _.forEach(_.tail(this._points), (point: Vector) => {
            const key = prevPoint.x + "_" + prevPoint.y + "_" + point.x + "_" + point.y;
            if (crossings.has(key)) {
                let segCrossings = _.sortBy(crossings.get(key), pair => pair[0].x);
                if (point.x < prevPoint.x) {
                    segCrossings = segCrossings.reverse();
                }
                _.forEach(segCrossings, (pair: [Vector, number]) => {
                    const crossing = pair[0];
                    const angle = pair[1];
                    const crossingOffset = (crossing.clone().sub(prevPoint)).setLength((1 + Math.sin(angle)) * 3);
                    const beforeCrossing = crossing.clone().sub(crossingOffset);
                    const afterCrossing = crossing.clone().add(crossingOffset);
                    line.lineTo(beforeCrossing.x, beforeCrossing.y);
                    line.lineStyle(1, 0x666666, 1);
                    line.quadraticCurveTo(crossing.x, crossing.y - 10, afterCrossing.x, afterCrossing.y);
                    line.lineStyle(1, 0x000000, 1);
                    prevPoint = crossing;
                });
            }
            line.lineTo(point.x, point.y);
            prevPoint = point;
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