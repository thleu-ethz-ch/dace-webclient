import * as PIXI from "pixi.js";
import SimpleShape from "./simpleShape";

export default class Text extends SimpleShape {
    private _text;
    private _fontStyle;

    constructor(x: number, y: number, text, fontSize = 12, color = 0x000000) {
        const fontStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: fontSize, fill: color});
        const metrics = PIXI.TextMetrics.measureText(text, fontStyle);
        super(x, y, metrics.width, metrics.height);
        this._text = text;
        this._fontStyle = fontStyle;
    }

    render(group) {
        const pixiText = new PIXI.Text(this._text, this._fontStyle);
        pixiText.x = this._x;
        pixiText.y = this._y;
        group.addChild(pixiText);
    }
}