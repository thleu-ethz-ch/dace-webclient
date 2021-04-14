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
import {Container, Graphics} from "pixi.js";
import MapEntry from "../renderGraph/mapEntry";
import MapExit from "../renderGraph/mapExit";
import Tasklet from "../renderGraph/tasklet";

export default class Renderer {
    private readonly _app;
    private readonly _viewport;
    private readonly _container;

    constructor(domContainer, coordinateContainer = null) {
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

        this._container = new Container();
        this._viewport.addChild(this._container);

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

            /*graph = new RenderGraph();
            const a = new AccessNode("AccessNode", "a");
            const b = new AccessNode("AccessNode", "b");
            const c = new AccessNode("AccessNode", "c");
            const d = new AccessNode("AccessNode", "d");
            const e = new AccessNode("AccessNode", "e");
            const f = new AccessNode("AccessNode", "f");
            const aboveB = new AccessNode("AccessNode", "aboveB");
            const map1Entry = new MapEntry("MapEntry", "map1Entry");
            const map1Tasklet1 = new Tasklet("Tasklet", "map1Tasklet1");
            const map1Tasklet2 = new Tasklet("Tasklet", "map1Tasklet2");
            const map1Exit = new MapExit("MapExit", "map1Exit");
            const map2Entry = new MapEntry("MapEntry", "map2Entry");
            const map2Exit = new MapExit("MapExit", "map2Exit");
            map2Entry.setConnectors(["in1", "in2", "in3"], []);
            graph.addNode(aboveB);
            graph.addNode(a);
            graph.addNode(b);
            graph.addNode(map1Entry);
            graph.addNode(map2Entry);
            graph.addNode(map1Tasklet1);
            graph.addNode(map1Tasklet2);
            graph.addNode(map2Exit);
            graph.addNode(c);
            graph.addNode(map1Exit);
            graph.addNode(d);
            graph.addNode(e);
            graph.addNode(f);

            map1Tasklet1.scopeEntry = map1Entry.id;
            map1Tasklet2.scopeEntry = map1Entry.id;
            map1Exit.scopeEntry = map1Entry.id;
            map2Exit.scopeEntry = map2Entry.id;

            graph.addEdge(new Memlet(aboveB.id, b.id, null, null));
            graph.addEdge(new Memlet(a.id, map2Entry.id, null, "in1"));
            graph.addEdge(new Memlet(b.id, map2Entry.id, null, "in2"));
            graph.addEdge(new Memlet(b.id, map2Entry.id, null, "in3"));
            graph.addEdge(new Memlet(c.id, e.id, null, null));
            let edgeId = graph.addEdge(new Memlet(map1Entry.id, map1Tasklet1.id, null, null));
            graph.edge(edgeId).weight = Number.POSITIVE_INFINITY;
            edgeId = graph.addEdge(new Memlet(map1Tasklet1.id, map1Tasklet2.id, null, null));
            graph.edge(edgeId).weight = Number.POSITIVE_INFINITY;
            edgeId = graph.addEdge(new Memlet(map1Tasklet2.id, map1Exit.id, null, null));
            graph.edge(edgeId).weight = Number.POSITIVE_INFINITY;
            graph.addEdge(new Memlet(map2Entry.id, map2Exit.id, null, null));
            graph.addEdge(new Memlet(map2Exit.id, d.id, null, null));
            graph.addEdge(new Memlet(map2Exit.id, e.id, null, null));
            graph.addEdge(new Memlet(map1Exit.id, f.id, null, null));
            graph.addEdge(new Memlet(d.id, f.id, null, null));
            graph.addEdge(new Memlet(e.id, f.id, null, null));*/

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
            /*if (layoutAnalysis.validate()) {
                console.log("Layout satisfies constraints.");
            } else {
                console.log("Layout violates constraints.");
            }*/
            //console.log("Weighted cost: " + layoutAnalysis.cost(true).toFixed(0));
            /*const performanceAnalysis = new PerformanceAnalysis(layouter);
            performanceAnalysis.measure(name, 1).then(time => {
                console.log(time + " ms");
            });*/

            // center and fit the graph in the viewport
            const box = graph.boundingBox();
            console.log("Total size: " + box.width.toFixed(0) +  "x" + box.height.toFixed(0));
            console.log("Segment crossings: " + layoutAnalysis.segmentCrossings());

            //Timer.printTimes();

            this.render(graph);
        });
    }

    drawSimpleGraph(nodes, heavyEdges, lightEdges) {
        const GRID = 20;
        const NODE = 5;
        _.forEach(nodes, node => {
            const circle = new PIXI.Graphics();
            circle.beginFill(0);
            circle.drawCircle(GRID * node[0], GRID * node[1], NODE / 2);
            circle.endFill();
            this._container.addChild(circle);
        });
        _.forEach(heavyEdges, edge => {
            const line = new PIXI.Graphics();
            line.lineStyle(2);
            line.moveTo(GRID * edge[0][0], GRID * edge[0][1]);
            line.lineTo(GRID * edge[1][0], GRID * edge[1][1]);
            this._container.addChild(line);
        });
        _.forEach(lightEdges, edge => {
            const line = new PIXI.Graphics();
            line.lineStyle(1);
            line.moveTo(GRID * edge[0][0], GRID * edge[0][1]);
            line.lineTo(GRID * edge[1][0], GRID * edge[1][1]);
            this._container.addChild(line);
        });
    }

    /**
     * Adapted from https://www.html5gamedevs.com/topic/31190-saving-pixi-content-to-image/.
     */
    savePng(fileName) {
        this._app.renderer.extract.canvas(this._viewport.children[0]).toBlob(function(b){
            var a = document.createElement('a');
            document.body.append(a);
            a.download = fileName;
            a.href = URL.createObjectURL(b);
            a.click();
            a.remove();
        }, 'image/png');
    }

    renderLive() {
        let prevStoredGraph = null;
        const layouter = new DagreLayouter();

        const addSubgraph = (parent, obj) => {
            _.forEach(obj.nodes, (nodeObj, id) => {
                if (nodeObj.child !== null) {
                    const node = new GenericContainerNode("GenericContainerNode");
                    node.setLabel(nodeObj.label || "");
                    node.updateSize(this._labelSize(node));
                    parent.addNode(node, id);
                    const childGraph =  new RenderGraph();
                    node.setChildGraph(childGraph);
                    addSubgraph(node.childGraph, nodeObj.child);
                } else {
                    const node = new GenericNode("GenericNode");
                    node.setLabel(nodeObj.label || "");
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

    renderOrderGraph(step: number = 0) {
        const renderGraph = new RenderGraph();
        let y = 0;
        const stepObj = JSON.parse(window.localStorage.getItem("orderGraph"))[step];
        console.log(stepObj);
        const nodeMap = new Map();
        const groupsPerRank = [];
        const widths = [];
        _.forEach(stepObj.ranks, rank => {
            const rankY = y;
            let x = 0;
            const groups = [];
            _.forEach(rank, group => {
                y = rankY;
                const groupNode = new GenericContainerNode("GenericContainerNode", group.label || "");
                const groupGraph = new RenderGraph();
                groupNode.setChildGraph(groupGraph);
                groupNode.x = x;
                groupNode.y = y;
                x += groupNode.childPadding;
                y += groupNode.childPadding;
                let groupHeight = 0;
                _.forEach(group.nodes, nodeObj => {
                    const node = new GenericNode("GenericNode", nodeObj.id.toString() || "");
                    groupGraph.addNode(node, parseInt(nodeObj.id));
                    nodeMap.set(node.id, node);
                    node.x = x;
                    node.y = y;
                    const size = this._labelSize(node);
                    node.width = size.width;
                    node.height = size.height;
                    x += node.width + 30;
                    groupHeight = Math.max(groupHeight, node.height);
                });
                x -= 30;
                x += groupNode.childPadding;
                y += groupHeight + groupNode.childPadding;
                groupNode.width = x - groupNode.x;
                groupNode.height = y - groupNode.y;
                x += 50;
                renderGraph.addNode(groupNode);
                groups.push(groupNode);
            });
            x -= 50;
            widths.push(x);
            y += 50;
            groupsPerRank.push(groups);
        });
        const maxWidth = _.max(widths);
        _.forEach(widths, (width, r) => {
            const offset = (maxWidth - width) / 2
            _.forEach(groupsPerRank[r], (group: RenderNode) => {
                group.x += offset;
                _.forEach(group.childGraph.nodes(), (node: RenderNode) => {
                    node.x += offset;
                });
            });
        });
        this.render(renderGraph);
        _.forEach(stepObj.edges, edgeObj => {
            const srcNode = nodeMap.get(edgeObj.src);
            const srcPos = srcNode.boundingBox().bottomCenter();
            const dstNode = nodeMap.get(edgeObj.dst);
            const dstPos = dstNode.boundingBox().topCenter();
            const line = new Graphics();
            const weight = (edgeObj.weight === "INFINITY" ? Number.POSITIVE_INFINITY : parseInt(edgeObj.weight));
            line.lineStyle(Math.min(weight, 4));
            line.moveTo(srcPos.x, srcPos.y);
            line.lineTo(dstPos.x, dstPos.y);
            this._container.addChild(line);
        });
    }

    /**
     * Shows a graph in the designated container.
     * @param graph Graph with layout information for all nodes and edges (x, y, width, height).
     * @param view = {centerX: number, centerY: number, zoom: number}
     */
    render(graph: RenderGraph, view = null) {
        this._container.removeChildren();

        const box = graph.boundingBox();

        if (view !== null) {
            this._viewport.moveCenter(view.centerX, view.centerY);
            this._viewport.setZoom(view.zoom, true);
        } else {
            //this._viewport.moveCenter((box.width - this._viewport.width) / 2, (box.height - this._viewport.width) / 2);
            //this._viewport.setZoom(Math.min(1, this._viewport.worldWidth / box.width, this._viewport.worldHeight / box.height), true);
        }

        const shapes = this._getShapesForGraph(graph);
        _.forEach(shapes, (shape) => {
            shape.render(this._container);
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