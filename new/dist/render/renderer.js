import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import Layouter from "../layout/layouter";
import Loader from "../parse/loader";
var Renderer = /** @class */ (function () {
    function Renderer(domContainer) {
        var app = new PIXI.Application({
            width: domContainer.clientWidth,
            height: domContainer.clientHeight,
            antialias: true
        });
        app.renderer.backgroundColor = 0xFFFFFF;
        domContainer.appendChild(app.view);
        this._viewport = new Viewport({
            screenWidth: domContainer.clientWidth,
            screenHeight: domContainer.clientHeight,
            worldWidth: domContainer.clientWidth,
            worldHeight: domContainer.clientHeight,
            interaction: app.renderer.plugins.interaction // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        });
        app.stage.addChild(this._viewport);
        app.stage.on('mouseover', function (object) {
            console.log(object);
        });
        var update = function () {
            requestAnimationFrame(update);
            app.renderer.render(app.stage);
        };
        update();
        this._viewport.drag().pinch().wheel().decelerate();
    }
    Renderer.prototype.show = function (name) {
        var _this = this;
        Loader.load(name).then(function (graph) {
            var layout = Layouter.layout(graph);
            _this.render(layout);
            // center and fit the graph in the viewport
            var box = layout.boundingBox();
            _this._viewport.moveCorner((box.width - _this._viewport.worldWidth) / 2, (box.height - _this._viewport.worldHeight) / 2);
            _this._viewport.setZoom(Math.min(1, _this._viewport.worldWidth / box.width, _this._viewport.worldHeight / box.height), true);
        });
    };
    Renderer.prototype.render = function (layout) {
        layout.render(this._viewport);
    };
    return Renderer;
}());
export default Renderer;
//# sourceMappingURL=renderer.js.map