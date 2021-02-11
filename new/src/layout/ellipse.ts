import SimpleShape from "./simpleShape";
import * as PIXI from "pixi.js";
import LayoutUtil from "./layoutUtil";

export default class Ellipse extends SimpleShape {
    private _backgroundColor: number;
    private _borderColor: number;

    constructor(x: number, y: number, width: number, height: number, backgroundColor: number = 0xFFFFFF, borderColor: number = 0x000000) {
        super(x, y, width, height);
        this._backgroundColor = backgroundColor;
        this._borderColor = borderColor;
    }

    render(container: PIXI.Container): void {
        const ellipse = new PIXI.Graphics();
        ellipse.lineStyle(1, this._borderColor, 1);
        ellipse.beginFill(this._backgroundColor);
        const centerBox = LayoutUtil.cornerToCenter(this.boundingBox());
        ellipse.drawEllipse(centerBox.x, centerBox.y, this._width / 2, this._height / 2);
        ellipse.endFill();
        container.addChild(ellipse);
    }

}