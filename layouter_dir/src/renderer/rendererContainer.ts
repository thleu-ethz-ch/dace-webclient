import Shape from "../shapes/shape";
import * as _ from "lodash";

export default abstract class RendererContainer
{
    protected _children: Array<Shape> = [];

    public addChild(shape: Shape) {
        this._children.push(shape);
    }

    public removeChildren() {
        this._children.length = 0;
    }

    public render() {
        _.forEach(this._children, (shape: Shape) => {
            this._renderShape(shape);
        });
    }

    protected abstract _renderShape(shape: Shape): void;
}