import * as PIXI from "pixi.js";
import {Viewport} from "pixi-viewport"
import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";
import Group from "../layout/group";
import Edge from "../layout/edge";
import Rectangle from "../layout/rectangle";
import LayoutUtil from "../layouter/layoutUtil";
import LayoutAnalysis from "../bench/layoutAnalysis";
import * as _ from "lodash";
import PerformanceAnalysis from "../bench/performanceAnalysis";

export default class Renderer {
    private _viewport;
    private _layout = null;

    constructor(domContainer) {
        const app = new PIXI.Application({
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

    show(layouter: Layouter, name: string) {
        Loader.load(name).then((graph) => {
            const layout = layouter.layout(graph);
            this.render(layout);
            const layoutAnalysis = new LayoutAnalysis(layout);
            console.log(layoutAnalysis.bendsMetric());
            console.log(layoutAnalysis.crossingsMetric());
            const performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(time => {
                console.log(time + " ms");
            });

            // center and fit the graph in the viewport
            const box = layout.boundingBox();
            this._viewport.moveCorner((box.width - this._viewport.worldWidth) / 2, (box.height - this._viewport.worldHeight) / 2);
            this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
        });
    }

    render(layout: Group) {
        this._layout = LayoutUtil.flattenLayout(layout);
        layout.render(this._viewport);
    }
}