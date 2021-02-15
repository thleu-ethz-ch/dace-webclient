import Position from "./position";
import * as _ from "lodash";
import BoundingBox from "./boundingBox";
import {Graphics} from "pixi.js";
import Shape from "./shape";

export default class Edge extends Shape {
    public points: Array<Position>;

    private _boundingBox = null;

    constructor(points: Array<Position>) {
        super(0, 0);
        this.points = points;
    }

    offset(x, y): void {
        _.forEach(this.points, (point: Position) => {
            point.x += x;
            point.y += y;
        });
    }

    boundingBox(): BoundingBox {
        if (this._boundingBox === null) {
            this.updateBoundingBox();
        }
        return this._boundingBox;
    }

    render(container: PIXI.Container) {
        let line = new Graphics();
        line.lineStyle(1, 0x000000, 1);
        line.x = _.head(this.points).x;
        line.y = _.head(this.points).y;
        line.moveTo(0, 0);
        _.forEach(_.tail(this.points), (point: Position) => {
            line.lineTo(point.x - line.x, point.y - line.y);
        });
        line.zIndex = -1;
        container.addChild(line);
    }

    private updateBoundingBox() {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, (point: Position) => {
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
        }
    }
}