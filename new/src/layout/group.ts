import * as _ from "lodash";
import * as PIXI from 'pixi.js';
import BoundingBox from "./boundingBox";
import Shape from "./shape";

export default class Group extends Shape
{
    private _elements: Array<Shape> = [];
    private _boundingBox = null;

    constructor(x: number = 0, y: number = 0, elements: Array<Shape> = []) {
        super(x, y);
        this.addElements(elements);
    }

    addElement(shape: Shape): void {
        this._elements.push(shape);
        shape.parent = this;
        this.invalidateBoundingBox();
    }

    addElements(shapes: Array<Shape>): void {
        _.forEach(shapes, (shape) => this.addElement(shape));
    }

    boundingBox(): BoundingBox {
        if (this._boundingBox === null) {
            this.updateBoundingBox();
        }
        return _.clone(this._boundingBox); // clone prevents that the bounding box gets mutated
    }

    render(container: PIXI.Container) {
        const group = new PIXI.Container();
        group.sortableChildren = true; // enable zIndex on children
        group.x = this._x;
        group.y = this._y;
        _.forEach(this._elements, (element: Shape) => {
            element.render(group);
        });
        container.addChild(group);
    }

    private updateBoundingBox(): void {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._elements, (element) => {
            const box = element.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        this._boundingBox = {
            x: this._x + minX,
            y: this._y + minY,
            width: maxX - minX,
            height: maxY - minY,
        }
    }

    clear() {
        this._elements = [];
    }

    clone(): Shape {
        const clone = <Group>super.clone();
        clone.clear();
        _.forEach(this._elements, (child) => {
            const clonedChild = child.clone();
            clonedChild.parent = clone;
            clone.addElement(clonedChild);
        });
        return clone;
    }

    invalidateBoundingBox() {
        this._boundingBox = null;
        if (this.parent !== null) {
            (<Group>this.parent).invalidateBoundingBox();
        }
    }

    get elements() {
        const elements = [];
        _.forEach(this._elements, (element) => {
            elements.push(element.clone());
        });
        return elements;
    }

}