import LayoutUtil from "../layouter/layoutUtil";
import * as _ from "lodash";
var Shape = /** @class */ (function () {
    function Shape(reference, x, y) {
        this.reference = null;
        this._x = 0;
        this._y = 0;
        this.reference = reference;
        this._x = x;
        this._y = y;
    }
    Shape.prototype.offset = function (x, y) {
        this._x += x;
        this._y += y;
    };
    Shape.prototype.position = function () {
        return {
            x: this._x,
            y: this._y,
        };
    };
    Shape.prototype.clone = function () {
        var clone = new this.constructor();
        _.assign(clone, this);
        return clone;
    };
    Shape.prototype.intersects = function (otherShape) {
        return LayoutUtil.boxesIntersect(this.boundingBox(), otherShape.boundingBox());
    };
    return Shape;
}());
export default Shape;
//# sourceMappingURL=shape.js.map