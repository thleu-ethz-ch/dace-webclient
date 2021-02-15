import LayoutUtil from "../layouter/layoutUtil";
var LayoutElement = /** @class */ (function () {
    function LayoutElement() {
        this.parentElement = null;
    }
    LayoutElement.prototype.center = function () {
        var box = this.boundingBox();
        return LayoutUtil.cornerToCenter(box);
    };
    return LayoutElement;
}());
export default LayoutElement;
//# sourceMappingURL=layoutElement.js.map