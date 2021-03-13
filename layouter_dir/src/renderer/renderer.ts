import * as _ from "lodash";
import * as PIXI from "pixi.js";
import {Viewport} from "pixi-viewport"
import Layouter from "../layouter/layouter";
import Loader from "../parse/loader";
import LayoutAnalysis from "../bench/layoutAnalysis";
import RenderGraph from "../renderGraph/renderGraph";
import RenderNode from "../renderGraph/renderNode";
import Shape from "../shapes/shape";
import Ellipse from "../shapes/ellipse";
import RenderConnector from "../renderGraph/renderConnector";
import Text from "../shapes/text";
import FoldedCornerRectangle from "../shapes/foldedCornerRectangle";
import Rectangle from "../shapes/rectangle";
import Color from "./color";
import Octagon from "../shapes/octagon";
import RenderEdge from "../renderGraph/renderEdge";
import EdgeShape from "../shapes/edgeShape";
import UpwardTrapezoid from "../shapes/upwardTrapezoid";
import DownwardTrapezoid from "../shapes/downwardTrapezoid";
import Size from "../geometry/size";
import Vector from "../geometry/vector";
import Box from "../geometry/box";
import OrderGraph from "../order/orderGraph";
import OrderGroup from "../order/orderGroup";
import OrderRank from "../order/orderRank";
import OrderNode from "../order/orderNode";
import Edge from "../graph/edge";

export default class Renderer {
    private readonly _viewport;

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
            interaction: app.renderer.plugins.interaction, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        });
        app.stage.addChild(this._viewport);


        /*const orderGraph = new OrderGraph();
        const rank1 = new OrderRank(true);
        const rank2 = new OrderRank(true);
        const group1 = new OrderGroup("Group 1", true);
        const group2 = new OrderGroup("Group 2", true);
        const group3 = new OrderGroup("Group 3");
        const node11 = new OrderNode("1.1");
        const node12 = new OrderNode("1.2");
        const node21 = new OrderNode("2.1");
        const node22 = new OrderNode("2.2");
        const node31 = new OrderNode("3.1");
        const node32 = new OrderNode("3.2");
        orderGraph.addRank(rank1);
        orderGraph.addRank(rank2);
        rank1.addGroup(group1);
        rank1.addGroup(group2);
        rank2.addGroup(group3);
        group1.addNode(node11);
        group1.addNode(node12);
        group2.addNode(node21);
        group2.addNode(node22);
        group3.addNode(node31);
        group3.addNode(node32);
        orderGraph.addEdge(new Edge(node11.id, node32.id));
        orderGraph.addEdge(new Edge(node12.id, node32.id));
        orderGraph.addEdge(new Edge(node21.id, node32.id));
        orderGraph.addEdge(new Edge(node22.id, node31.id));
        orderGraph.order();
        console.log(orderGraph);*/

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

        const logCoordinate = (e) => {
            console.log(this._viewport.center);
        }
        //this._viewport.on('moved', logCoordinate).on('zoomed', logCoordinate);
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
            console.log("Weighted cost: " + layoutAnalysis.cost(true).toFixed(0));
            /*const performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(time => {
                console.log(time + " ms");
            });*/

            // center and fit the graph in the viewport
            const box = graph.boundingBox();

            this._viewport.moveCorner((box.width - this._viewport.worldWidth) / 2, (box.height - this._viewport.worldHeight) / 2);
            this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
            /*this._viewport.moveCenter(6997.541591078397, 16317.334381731042);
            this._viewport.setZoom(1, true);*/

            this.render(graph);
        });
    }

    /**
     * Shows a graph in the designated container.
     * @param graph Graph with layout information for all nodes and edges (x, y, width, height).
     */
    render(graph: RenderGraph) {
        _.forEach(this._getShapesForGraph(graph), (shape) => {
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
                break;
            case "Tasklet":
                shapes.push(new Octagon(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
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
        const shapes: Array<Shape> = [new EdgeShape(edge, _.clone(edge.points))];
        if (edge.labelX) {
            const labelSize = this._edgeLabelSize(edge);
            const labelBackground = new Rectangle(null, edge.labelX - 3, edge.labelY - 3, labelSize.width + 6, labelSize.height + 6, new Color(255, 255, 255, 0.8), Color.TRANSPARENT);
            labelBackground.zIndex = 2;
            shapes.push(labelBackground);
            shapes.push(new Text(edge.labelX, edge.labelY, edge.label(), edge.labelFontSize, 0x666666));
        }
        return shapes;
    }

}