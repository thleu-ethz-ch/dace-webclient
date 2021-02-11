var SdfgNode = /** @class */ (function () {
    function SdfgNode(jsonNode) {
        this._childLayout = null;
        this._label = jsonNode.label;
    }
    SdfgNode.prototype.shapes = function () {
        return function (x, y) {
            return [];
        };
    };
    SdfgNode.prototype.childGraph = function () {
        return null;
    };
    SdfgNode.prototype.childLayout = function (nodeId) {
        return null;
    };
    SdfgNode.prototype.size = function () {
        return {
            width: 0,
            height: 0,
        };
    };
    return SdfgNode;
}());
export default SdfgNode;
//# sourceMappingURL=sdfgNode.js.map