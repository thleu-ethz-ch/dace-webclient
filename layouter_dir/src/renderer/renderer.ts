import * as _ from "lodash";
import * as PIXI from "pixi.js";
import {Viewport} from "pixi-viewport"
import AccessNode from "../renderGraph/accessNode";
import Box from "../geometry/box";
import Color from "./color";
import DagreLayouter from "../layouter/dagreLayouter";
import DownwardTrapezoid from "../shapes/downwardTrapezoid";
import EdgeShape from "../shapes/edgeShape";
import Ellipse from "../shapes/ellipse";
import FoldedCornerRectangle from "../shapes/foldedCornerRectangle";
import GenericContainerNode from "../renderGraph/genericContainerNode";
import GenericNode from "../renderGraph/genericNode";
import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";
import LayoutAnalysis from "../bench/layoutAnalysis";
import Memlet from "../renderGraph/memlet";
import Octagon from "../shapes/octagon";
import Rectangle from "../shapes/rectangle";
import RenderEdge from "../renderGraph/renderEdge";
import RenderGraph from "../renderGraph/renderGraph";
import RenderNode from "../renderGraph/renderNode";
import RenderConnector from "../renderGraph/renderConnector";
import Shape from "../shapes/shape";
import Size from "../geometry/size";
import Text from "../shapes/text";
import Timer from "../util/timer";
import UpwardTrapezoid from "../shapes/upwardTrapezoid";
import Vector from "../geometry/vector";

export default class Renderer {
    private readonly _viewport;

    constructor(domContainer, coordinateContainer = null) {
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
            interaction: app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        });
        app.stage.addChild(this._viewport);

        const showCoordinates = (title, point) => {
            coordinateContainer.innerHTML = title + ": " + point.x.toFixed(0) + " / " + point.y.toFixed(0);
        }

        if (coordinateContainer !== null) {
            this._viewport.interactive = true;
            this._viewport.on('mousemove', _.throttle((e) => {
                const mousePos = e.data.getLocalPosition(this._viewport);
                showCoordinates("mouse", mousePos);
            }, 10));

            showCoordinates("center", this._viewport.center);
        }

        this._viewport.drag().pinch().wheel().decelerate();
    }

    show(layouter: Layouter, name: string) {
        Loader.load(name).then((graph) => {

            // set node sizes
            _.forEach(graph.allNodes(), (node: RenderNode) => {
                node.updateSize(this._labelSize(node));
            });
            // set edge label sizes
            _.forEach(graph.allEdges(), (edge: RenderEdge) => {
                edge.labelSize = this._edgeLabelSize(edge);
            });

            const layout = layouter.layout(graph);

            const layoutAnalysis = new LayoutAnalysis(layout);
            if (layoutAnalysis.validate()) {
                console.log("Layout satisfies constraints.");
            } else {
                console.log("Layout violates constraints.");
            }
            //console.log("Weighted cost: " + layoutAnalysis.cost(true).toFixed(0));
            /*const performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(time => {
                console.log(time + " ms");
            });*/

            // center and fit the graph in the viewport
            const box = graph.boundingBox();
            console.log("Total size: " + box.width.toFixed(0) +  "x" + box.height.toFixed(0));
            console.log("Segment crossings: " + layoutAnalysis.segmentCrossings());

            Timer.printTimes();

            this.render(graph);
        });
    }

    renderLive() {
        let prevStoredGraph = null;
        const layouter = new DagreLayouter();

        const addSubgraph = (parent, obj) => {
            _.forEach(obj.nodes, (nodeObj, id) => {
                if (nodeObj.child !== null) {
                    const node = new GenericContainerNode("GenericContainerNode");
                    node.setLabel(nodeObj.label || "");
                    console.log(nodeObj.label);
                    node.updateSize(this._labelSize(node));
                    parent.addNode(node, id);
                    const childGraph =  new RenderGraph();
                    node.setChildGraph(childGraph);
                    addSubgraph(node.childGraph, nodeObj.child);
                } else {
                    const node = new GenericNode("GenericNode");
                    node.setLabel(nodeObj.label || "");
                    console.log(nodeObj.label);
                    node.updateSize(this._labelSize(node));
                    parent.addNode(node, id);
                }
            });
            _.forEach(obj.edges, edgeObj => {
                parent.addEdge(new Memlet(edgeObj.src, edgeObj.dst));
            });
        };

        const doRender = () => {
            const storedGraph = window.localStorage.getItem("storedGraph");
            if (storedGraph !== prevStoredGraph && storedGraph !== null) {
                prevStoredGraph = storedGraph;
                const renderGraph = new RenderGraph();
                addSubgraph(renderGraph, JSON.parse(storedGraph));
                layouter.layout(renderGraph);
                this.render(renderGraph);
            }
            setTimeout(doRender, 3000);
        };
        doRender();
    }

    /**
     * Shows a graph in the designated container.
     * @param graph Graph with layout information for all nodes and edges (x, y, width, height).
     * @param view = {centerX: number, centerY: number, zoom: number}
     */
    render(graph: RenderGraph, view = null) {
        this._viewport.removeChildren();
        const box = graph.boundingBox();
        this._viewport.moveCorner((box.width - this._viewport.worldWidth) / 2, (box.height - this._viewport.worldHeight) / 2);
        this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
        if (view !== null) {
            this._viewport.moveCenter(view.centerX, view.centerY);
            this._viewport.setZoom(view.zoom, true);
        }

        const shapes = this._getShapesForGraph(graph);
        _.forEach(shapes, (shape) => {
            shape.render(this._viewport);
        });
    }

    private _labelSize(node: RenderNode): Size {
        const textBox = (new Text(0, 0, node.label(), node.labelFontSize)).boundingBox();
        return {
            width: textBox.width + 2 * node.labelPaddingX,
            height: textBox.height + 2 * node.labelPaddingY,
        }
    }

    private _edgeLabelSize(edge: RenderEdge): Size {
        return (new Text(0, 0, edge.label(), edge.labelFontSize)).boundingBox().size();
    }

    /**
     * Adds an offset to center the label within the node (if necessary).
     */
    private _labelPosition(node: RenderNode): Vector {
        const labelSize = this._labelSize(node);
        const labelBox = new Box(
            node.x + node.labelPaddingX,
            node.y + node.labelPaddingY,
            labelSize.width,
            labelSize.height,
        );
        return labelBox.centerIn(node.boundingBox()).topLeft();
    }

    private _getShapesForGraph(graph: RenderGraph): Array<Shape> {
        const shapes = [];
        _.forEach(graph.nodes(), (node: RenderNode) => {
            _.forEach(this._getShapesForNode(node), shape => shapes.push(shape));
        });
        _.forEach(graph.edges(), (edge: RenderEdge) => {
            _.forEach(this._getShapesForEdge(edge), shape => shapes.push(shape));
        });
        return shapes;
    }

    private _getShapesForNode(node: RenderNode) {
        const shapes = [];
        switch (node.type()) {
            case "AccessNode":
            case "GenericNode":
                shapes.push(new Ellipse(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
                break;
            case "LibraryNode":
                shapes.push(new FoldedCornerRectangle(this, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()))
                break;
            case "NestedSDFG":
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height));
                break;
            case "SDFGState":
                const color = new Color(0xDE, 0xEB, 0xF7);
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height, color, color));
                shapes.push(new Text(node.x + 5, node.y + 5, node.label()));
                break;
            case "Tasklet":
                shapes.push(new Octagon(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
                break;
            case "GenericContainerNode":
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(node.x + 5, node.y + 5, node.label()));
                break;
        }
        if (node.type().endsWith("Entry")) {
            shapes.push(new UpwardTrapezoid(node, node.x, node.y, node.width, node.height));
            shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
        }
        if (node.type().endsWith("Exit")) {
            shapes.push(new DownwardTrapezoid(node, node.x, node.y, node.width, node.height));
            shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
        }

        // add child graph shapes
        if (node.childGraph !== null) {
            _.forEach(this._getShapesForGraph(node.childGraph), (shape: Shape) => {
                shapes.push(shape);
            });
        }

        // add connector shapes
        _.forEach(node.inConnectors, (connector: RenderConnector) => {
            shapes.push(new Ellipse(connector, connector.x, connector.y, connector.width, connector.height));
        });
        _.forEach(node.outConnectors, (connector: RenderConnector) => {
            shapes.push(new Ellipse(connector, connector.x, connector.y, connector.width, connector.height));
        });

        return shapes;
    }

    private _getShapesForEdge(edge: RenderEdge): Array<Shape> {
        const color = (edge instanceof Memlet ? Color.BLACK : new Color(0xBE, 0xCB, 0xD7));
        const shapes: Array<Shape> = [new EdgeShape(edge, _.clone(edge.points), color)];
        if (edge.labelX) {
            const labelSize = this._edgeLabelSize(edge);
            const labelBackground = new Rectangle(null, edge.labelX - 3, edge.labelY - 3, labelSize.width + 6, labelSize.height + 6, Color.WHITE.fade(0.8), Color.TRANSPARENT);
            labelBackground.zIndex = 2;
            shapes.push(labelBackground);
            shapes.push(new Text(edge.labelX, edge.labelY, edge.label(), edge.labelFontSize, 0x666666));
        }
        return shapes;
    }

}