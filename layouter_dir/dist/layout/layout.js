var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as _ from "lodash";
import * as PIXI from 'pixi.js';
import SimpleShape from "./simpleShape";
var Layout = /** @class */ (function (_super) {
    __extends(Layout, _super);
    function Layout(x, y) {
        if (x === void 0) { x = 0; }
        if (y === void 0) { y = 0; }
        var _this = _super.call(this, x, y, 0, 0) || this;
        _this.elements = [];
        return _this;
    }
    Layout.prototype.addElement = function (shape, reference, parentNodeId) {
        if (reference === void 0) { reference = null; }
        if (parentNodeId === void 0) { parentNodeId = null; }
        var id = this.elements.length;
        this.elements.push([shape, reference, parentNodeId]);
        return id;
    };
    Layout.prototype.boundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.elements, function (element) {
            var box = element[0].boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };
    Layout.prototype.render = function (container) {
        var group = new PIXI.Container();
        group.x = this._x;
        group.y = this._y;
        _.forEach(this.elements, function (element) {
            element[0].render(group);
        });
        container.addChild(group);
    };
    return Layout;
}(SimpleShape));
export default Layout;
//# sourceMappingURL=layout.js.map