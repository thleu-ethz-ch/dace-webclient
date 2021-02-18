import {Container} from "pixi.js";
import BoundingBox from "./boundingBox";
import Position from "./position";
import LayoutUtil from "../layouter/layoutUtil";
import * as _ from "lodash";

export default abstract class Shape {
    public reference = null;

    public parent: Shape = null;
    protected _x: number = 0;
    protected _y: number = 0;

    protected constructor(x: number, y: number) {
        this._x = x;
        this._y = y;
    }

    offset(x: number, y: number): void {
        this._x += x;
        this._y += y;
    }

    globalPosition(): Position {
        const position = {
            x: this._x,
            y: this._y,
        }
        if (this.parent !== null) {
            const parentPosition = this.parent.globalPosition();
            position.x += parentPosition.x;
            position.y += parentPosition.y;
        }
        return position;
    }

    globalBoundingBox(): BoundingBox {
        const localBox = this.boundingBox();
        let parentPosition = {
            x: 0,
            y: 0,
        }
        if (this.parent !== null) {
            parentPosition = this.parent.globalPosition();
        }
        return {
            x: localBox.x + parentPosition.x,
            y: localBox.y + parentPosition.y,
            width: localBox.width,
            height: localBox.height,
        };
    }

    center(): Position {
        const box = this.boundingBox();
        return LayoutUtil.cornerToCenter(box);
    }

    parentWithReferenceType(type) {
        let shape: Shape = this;
        let node = this.reference;
        while (shape.parent !== null) {
            node = shape.reference;
            if (node !== null) {
                if (node.constructor.name === type) {
                    break;
                }
            }
            shape = shape.parent;
        }
        node = shape.reference;
        if (node !== null && node.constructor.name === type) {
            return node;
        }
        return null;
    }

    get x(): number {
        return this._x;
    }

    get y(): number {
        return this._y;
    }

    clone(): Shape {
        const clone = new (this.constructor as { new() })();
        _.assign(clone, <Shape>this);
        return clone;
    }

    abstract boundingBox(): BoundingBox;

    abstract render(container: Container): void;

}