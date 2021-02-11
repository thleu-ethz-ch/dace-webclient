/**
 * Represents a geometric layoutElement and its relative position in the layout.
 */
var Shape = /** @class */ (function () {
    function Shape() {
    }
    Shape.prototype.render = function (container) {
        // defined in subclasses
    };
    Shape.prototype.boundingBox = function () {
        // defined in subclasses
        return null;
    };
    Shape.prototype.offset = function (x, y) {
        // defined in subclasses
    };
    return Shape;
}());
export default Shape;
//# sourceMappingURL=shape.js.map