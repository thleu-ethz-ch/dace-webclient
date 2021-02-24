import Text from "./text";
var LayoutUtil = /** @class */ (function () {
    function LayoutUtil() {
    }
    LayoutUtil.centerToCorner = function (box) {
        return {
            x: box.x - box.width / 2,
            y: box.y - box.height / 2,
            width: box.width,
            height: box.height,
        };
    };
    LayoutUtil.cornerToCenter = function (box) {
        return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            width: box.width,
            height: box.height,
        };
    };
    LayoutUtil.textSize = function (text, fontSize, paddingX, paddingY) {
        if (fontSize === void 0) { fontSize = 12; }
        if (paddingX === void 0) { paddingX = 0; }
        if (paddingY === void 0) { paddingY = 0; }
        var box = (new Text(0, 0, text, fontSize)).boundingBox();
        return {
            width: box.width + 2 * paddingX,
            height: box.height + 2 * paddingY,
        };
    };
    return LayoutUtil;
}());
export default LayoutUtil;
//# sourceMappingURL=layoutUtil.js.map