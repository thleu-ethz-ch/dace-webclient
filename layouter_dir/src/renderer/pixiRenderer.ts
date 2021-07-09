import {Viewport} from "pixi-viewport";
import * as _ from "lodash";
import * as PIXI from "pixi.js";
import Renderer from "./renderer";
import PixiContainer from "./pixiContainer";
import RenderGraph from "../renderGraph/renderGraph";
import Shape from "../shapes/shape";
import size from "../geometry/size";
import Size from "../geometry/size";

export default class PixiRenderer extends Renderer {
    private readonly _app;
    private readonly _viewport;

    constructor(domContainer, coordinateContainer = null) {
        super(coordinateContainer);
        this._app = new PIXI.Application({
            width: domContainer.clientWidth,
            height: domContainer.clientHeight,
            antialias: true,
        });
        this._app.renderer.backgroundColor = 0xFFFFFF;
        domContainer.appendChild(this._app.view);

        this._viewport = new Viewport({
            screenWidth: domContainer.clientWidth,
            screenHeight: domContainer.clientHeight,
            worldWidth: domContainer.clientWidth,
            worldHeight: domContainer.clientHeight,
            interaction: this._app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        });
        this._app.stage.addChild(this._viewport);

        this._container = new PixiContainer();
        this._viewport.addChild((<PixiContainer>this._container).pixiContainer);

        if (this._coordinateContainer !== null) {
            this._viewport.interactive = true;
            this._viewport.on('mousemove', _.throttle((e) => {
                const mousePos = e.data.getLocalPosition(this._viewport);
                this._showCoordinates("mouse", mousePos);
            }, 10));
            this._showCoordinates("center", this._viewport.center);
        }

        this._viewport.drag().pinch().wheel().decelerate();

        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                this.savePng("screenshot.png");
            }
        });
    }

    /**
     * Adapted from https://www.html5gamedevs.com/topic/31190-saving-pixi-content-to-image/.
     */
    savePng(fileName): void {
        this._app.renderer.extract.canvas(this._viewport.children[0]).toBlob(function (b) {
            const a = document.createElement('a');
            document.body.append(a);
            a.download = fileName;
            a.href = URL.createObjectURL(b);
            a.click();
            a.remove();
        }, 'image/png');
    }

    /**
     * Shows a graph in the designated container.
     * @param graph Graph with layout information for all nodes and edges (x, y, width, height).
     * @param view = {centerX: number, centerY: number, zoom: number}
     */
    _render(graph: RenderGraph, view: any = "auto"): void {
        this._container.removeChildren();

        if (view !== null) {
            if (view === "auto") {
                const box = graph.boundingBox();
                this._viewport.moveCenter((box.width - this._viewport.width) / 2, (box.height - this._viewport.width) / 2);
                this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
            } else {
                this._viewport.moveCenter(view.centerX, view.centerY);
                this._viewport.setZoom(view.zoom, true);
            }
        }

        const shapes = this._getShapesForGraph(graph);
        _.forEach(shapes, (shape: Shape) => {
            this._container.addChild(shape)
        });
        _.forEach(this._additionalShapes, (shape: Shape) => {
            this._container.addChild(shape)
        });

        this._container.render();
    }

    public getTextSize(text: string, fontSize: number, fontFamily: string): Size {
        const fontStyle = new PIXI.TextStyle({fontFamily: 'Arial', fontSize: fontSize});
        return PIXI.TextMetrics.measureText(text, fontStyle);
    }
}
