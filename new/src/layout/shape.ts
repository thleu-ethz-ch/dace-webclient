import {Container} from "pixi.js";
import BoundingBox from "./boundingBox";
import Point from "./point";
import LayoutUtil from "../layouter/layoutUtil";
import * as _ from "lodash";

export default abstract class Shape {
    public reference = null;

    protected _x: number = 0;
    protected _y: number = 0;

    protected constructor(reference: object, x: number, y: number) {
        this.reference = reference;
        this._x = x;
        this._y = y;
    }

    offset(x: number, y: number): void {
        this._x += x;
        this._y += y;
    }

    position(): Point {
        return {
            x: this._x,
            y: this._y,
        }
    }

    clone(): Shape {
        const clone = new (this.constructor as { new() })();
        _.assign(clone, <Shape>this);
        return clone;
    }

    intersects(otherShape: Shape) {
        return LayoutUtil.boxesIntersect(this.boundingBox(), otherShape.boundingBox());
    }

    abstract boundingBox(): BoundingBox;

    abstract render(container: Container): void;

}