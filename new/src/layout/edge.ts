import Position from "./position";
import * as _ from "lodash";
import BoundingBox from "./boundingBox";
import {Graphics} from "pixi.js";
import LayoutElement from "./layoutElement";

export default class Edge extends LayoutElement {
    private _points: Array<Position>;

    constructor(points: Array<Position>) {
        super();
        this._points = points;
    }

    offset(x, y): void {
        _.forEach(this._points, (point: Position) => {
            point.x += x;
            point.y += y;
        });
    }

    boundingBox(): BoundingBox {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, (point: Position) => {
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
        }
    }

    render(container: PIXI.Container) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = _.head(this._points).x;
        line.y = _.head(this._points).y;
        line.moveTo(0, 0);
        _.forEach(_.tail(this._points), (point: Position) => {
            line.lineTo(point.x - line.x, point.y - line.y);
        });
        container.addChild(line);
    }
}