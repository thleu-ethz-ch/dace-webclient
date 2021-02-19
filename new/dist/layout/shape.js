import LayoutUtil from "../layouter/layoutUtil";
import * as _ from "lodash";
var Shape = /** @class */ (function () {
    function Shape(x, y) {
        this.reference = null;
        this.parent = null;
        this._x = 0;
        this._y = 0;
        this._x = x;
        this._y = y;
    }
    Shape.prototype.offset = function (x, y) {
        this._x += x;
        this._y += y;
    };
    Shape.prototype.globalPosition = function () {
        var position = {
            x: this._x,
            y: this._y,
        };
        if (this.parent !== null) {
            var parentPosition = this.parent.globalPosition();
            position.x += parentPosition.x;
            position.y += parentPosition.y;
        }
        return position;
    };
    Shape.prototype.globalBoundingBox = function () {
        var localBox = this.boundingBox();
        var parentPosition = {
            x: 0,
            y: 0,
        };
        if (this.parent !== null) {
            parentPosition = this.parent.globalPosition();
        }
        return {
            x: localBox.x + parentPosition.x,
            y: localBox.y + parentPosition.y,
            width: localBox.width,
            height: localBox.height,
        };
    };
    Shape.prototype.center = function () {
        var box = this.boundingBox();
        return LayoutUtil.cornerToCenter(box);
    };
    Shape.prototype.parentWithReferenceType = function (type) {
        var shape = this;
        var node = this.reference;
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
    };
    Object.defineProperty(Shape.prototype, "x", {
        get: function () {
            return this._x;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Shape.prototype, "y", {
        get: function () {
            return this._y;
        },
        enumerable: false,
        configurable: true
    });
    Shape.prototype.clone = function () {
        var clone = new this.constructor();
        _.assign(clone, this);
        return clone;
    };
    Shape.prototype.intersects = function (otherShape) {
        return LayoutUtil.boxesIntersect(this.globalBoundingBox(), otherShape.globalBoundingBox());
    };
    return Shape;
}());
export default Shape;
//# sourceMappingURL=shape.js.map