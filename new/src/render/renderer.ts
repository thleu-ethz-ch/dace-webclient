import * as PIXI from "pixi.js";
import {Viewport} from "pixi-viewport"
import Layouter from "../layout/layouter";
import Loader from "../parse/loader";
import Layout from "../layout/layout";

export default class Renderer {
    private _viewport;

    constructor(domContainer) {
        const app = new PIXI.Application({
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

        app.stage.on('mouseover', (object) => {
            console.log(object);
        });


        const update = () => {
            requestAnimationFrame(update);
            app.renderer.render(app.stage);
        }
        update();

        this._viewport.drag().pinch().wheel().decelerate();
    }

    show(name: string) {
        Loader.load(name).then((graph) => {
            const layout = Layouter.layout(graph);
            this.render(layout);

            // center and fit the graph in the viewport
            const box = layout.boundingBox();
            this._viewport.moveCorner((box.width - this._viewport.worldWidth) / 2, (box.height - this._viewport.worldHeight) / 2);
            this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
        });
    }

    render(layout: Layout) {
        layout.render(this._viewport);
    }
}