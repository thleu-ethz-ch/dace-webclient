import RenderEdge from "./renderEdge";
import Color from "../renderer/color";

export default class GenericEdge extends RenderEdge {
    private _label: string;
    private _color: Color;
    private _lineWidth: number;
    private _lineStyle: "solid" | "dashed";

    constructor(src, dst, label: string = "", color: Color = Color.BLACK, lineWidth: number = 1, lineStyle: "solid" | "dashed" = "solid") {
        super(src, dst, null, null);
        this._label = label;
        this._color = color;
        this._lineWidth = lineWidth;
        this._lineStyle = lineStyle;
    }

    label(): string {
        return this._label;
    }

    color(): Color {
        return this._color;
    }

    lineWidth(): number {
        return this._lineWidth;
    }

    lineStyle(): "solid" | "dashed" {
        return this._lineStyle;
    }
}
