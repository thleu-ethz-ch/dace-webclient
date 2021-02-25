import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import Loader from "../parse/loader";
import * as _ from "lodash";
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
        var nodes = [
            { x: 10 },
            { x: 20 },
            { x: 30 },
            { x: 50 },
            { x: 40 }
        ];
        delete nodes[0];
        this._viewport.drag().pinch().wheel().decelerate();
    }
    Renderer.prototype.show = function (layouter, name) {
        var _this = this;
        Loader.load(name).then(function (graph) {
            layouter.layout(graph);
            _this.render(graph);
            /*const layoutAnalysis = new LayoutAnalysis(graph.shapes());
            console.log(layoutAnalysis.bendsMetric());
            console.log(layoutAnalysis.crossingsMetric());*/
            /*const performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(time => {
                console.log(time + " ms");
            });*/
            // center and fit the graph in the viewport
            var box = graph.boundingBox();
            _this._viewport.moveCorner((box.width - _this._viewport.worldWidth) / 2, (box.height - _this._viewport.worldHeight) / 2);
            _this._viewport.setZoom(Math.min(1, _this._viewport.worldWidth / box.width, _this._viewport.worldHeight / box.height), true);
        });
    };
    /**
     * Shows a graph in the designated container.
     * @param graph Graph with layout information for all nodes and edges (x, y, width, height).
     */
    Renderer.prototype.render = function (graph) {
        var _this = this;
        _.forEach(graph.shapes(), function (shape) {
            shape.render(_this._viewport);
        });
    };
    return Renderer;
}());
export default Renderer;
//# sourceMappingURL=renderer.js.map