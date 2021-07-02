import * as PIXI from "pixi.js";
import SimpleShape from "./simpleShape";
import Color from "../renderer/color";

export default class Ellipse extends SimpleShape {
    private readonly _backgroundColor: Color;
    private readonly _borderColor: Color;

    constructor(reference: object, x: number, y: number, width: number, height: number, backgroundColor: Color = Color.WHITE, borderColor: Color = Color.BLACK) {
        super(reference, x, y, width, height);
        this._backgroundColor = backgroundColor;
        this._borderColor = borderColor;
    }

    render(container: PIXI.Container): void {
        const ellipse = new PIXI.Graphics();
        ellipse.lineStyle(1, this._borderColor.number(), this._borderColor.alpha);
        ellipse.beginFill(this._backgroundColor.number(), this._backgroundColor.alpha);
        const box = this.boundingBox();
        const center = box.center();
        ellipse.drawEllipse(center.x, center.y, this._width / 2, this._height / 2);
        ellipse.endFill();
        container.addChild(ellipse);
    }
}
