import * as _ from "lodash";
import * as PIXI from 'pixi.js';
import BoundingBox from "./boundingBox";
import LayoutElement from "./layoutElement";
import SimpleShape from "./simpleShape";

export default class Layout extends SimpleShape
{
    constructor() {
        super(0, 0, 0, 0);
    }

    elements: Array<[LayoutElement, object, number]> = [];

    addElement(shape: LayoutElement | Layout, reference: object, parentNodeId: number): number {
        const id = this.elements.length;
        this.elements.push([shape, reference, parentNodeId]);
        return id;
    }

    boundingBox(): BoundingBox {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.elements, (element) => {
            const box = element[0].boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    render(container: PIXI.Container) {
        const group = new PIXI.Container();
        group.x = this._x;
        group.y = this._y;
        _.forEach(this.elements, (element: [LayoutElement, object, number]) => {
            element[0].render(group);
        });
        container.addChild(group);
    }
}