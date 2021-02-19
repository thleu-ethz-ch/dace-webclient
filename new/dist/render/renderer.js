import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import Loader from "../parse/loader";
import LayoutUtil from "../layouter/layoutUtil";
import LayoutAnalysis from "../bench/layoutAnalysis";
import PerformanceAnalysis from "../bench/performanceAnalysis";
var Renderer = /** @class */ (function () {
    function Renderer(domContainer) {
        this._layout = null;
        var app = new PIXI.Application({
            width: domContainer.clientWidth,
            height: domContainer.clientHeight,
            antialias: true,
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
        /*this._viewport.interactive = true;
        this._viewport.on('mousemove', _.throttle((e) => {
            if (this._layout === null) {
                return;
            }
            const mousePos = e.data.getLocalPosition(this._viewport);
            const mouseRectangle = new Rectangle(mousePos.x - 2, mousePos.y - 2, 4, 4);
            _.forEach(this._layout.elements, (element) => {
                if (element instanceof Edge && element.intersects(mouseRectangle)) {
                    console.log(element);
                }
            });
        }, 100));*/
        /*const update = () => {
            requestAnimationFrame(update);
            app.renderer.render(app.stage);
        }
        update();*/
        this._viewport.drag().pinch().wheel().decelerate();
    }
    Renderer.prototype.show = function (layouter, name) {
        var _this = this;
        Loader.load(name).then(function (graph) {
            var layout = layouter.layout(graph);
            _this.render(layout);
            var layoutAnalysis = new LayoutAnalysis(layout);
            console.log(layoutAnalysis.bendsMetric());
            console.log(layoutAnalysis.crossingsMetric());
            var performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(function (time) {
                console.log(time + " ms");
            });
            // center and fit the graph in the viewport
            var box = layout.boundingBox();
            _this._viewport.moveCorner((box.width - _this._viewport.worldWidth) / 2, (box.height - _this._viewport.worldHeight) / 2);
            _this._viewport.setZoom(Math.min(1, _this._viewport.worldWidth / box.width, _this._viewport.worldHeight / box.height), true);
        });
    };
    Renderer.prototype.render = function (layout) {
        this._layout = LayoutUtil.flattenLayout(layout);
        layout.render(this._viewport);
    };
    return Renderer;
}());
export default Renderer;
//# sourceMappingURL=renderer.js.map