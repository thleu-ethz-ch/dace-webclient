import {Container, Graphics} from "pixi.js";
import {Viewport} from "pixi-viewport"
import * as _ from "lodash";
import * as PIXI from "pixi.js";
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
import Tasklet from "../renderGraph/tasklet";
import Text from "../shapes/text";
import Timer from "../util/timer";
import UpwardTrapezoid from "../shapes/upwardTrapezoid";
import Vector from "../geometry/vector";
import LayoutGraph from "../layoutGraph/layoutGraph";
import SdfgState from "../renderGraph/sdfgState";
import InterstateEdge from "../renderGraph/interstateEdge";
import MapExit from "../renderGraph/mapExit";
import MapEntry from "../renderGraph/mapEntry";
import RendererContainer from "./rendererContainer";
import Line from "../shapes/line";
import Circle from "../shapes/circle";
import GenericEdge from "../renderGraph/genericEdge";
import sub = PIXI.groupD8.sub;

export default abstract class Renderer {
    protected _container: RendererContainer;
    protected _coordinateContainer: HTMLElement;
    protected _additionalShapes: Array<Shape> = [];

    protected constructor(coordinateContainer) {
        this._coordinateContainer = coordinateContainer;
    }

    protected _showCoordinates(title, point): void {
        this._coordinateContainer.innerHTML = title + ": " + point.x.toFixed(0) + " / " + point.y.toFixed(0);
    }

    protected abstract _render(graph: RenderGraph, view?: any): void;

    public abstract getTextSize(text: string, fontSize: number, fontFamily: string): Size;

    show(layouter: Layouter, name: string): void {
        Loader.load(name).then((graph: RenderGraph) => {
            /*graph = new RenderGraph();
            const accessNode00 = graph.addNode(new AccessNode("AccessNode"));
            const mapEntry1 = graph.addNode(new MapEntry("MapEntry"));
            const tasklet1 = graph.addNode(new Tasklet("Tasklet"));
            const mapExit1 = graph.addNode(new MapExit("MapExit"));
            const mapEntry2 = graph.addNode(new MapEntry("MapEntry"));
            const mapExit2 = graph.addNode(new MapExit("MapExit"));
            const accessNode10 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode11 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode12 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode20 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode21 = graph.addNode(new AccessNode("AccessNode"));
            const mapEntry3 = graph.addNode(new MapEntry("MapEntry"));
            const accessNode22 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode23 = graph.addNode(new AccessNode("AccessNode"));
            const tasklet3 = graph.addNode(new Tasklet("Tasklet"));
            const accessNode30 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode31 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode32 = graph.addNode(new AccessNode("AccessNode"));
            const mapExit3 = graph.addNode(new MapExit("MapExit"));
            const accessNode40 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode41 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode50 = graph.addNode(new AccessNode("AccessNode"));
            const accessNode51 = graph.addNode(new AccessNode("AccessNode"));
            graph.node(mapExit1).scopeEntry = mapEntry1;
            graph.node(tasklet1).scopeEntry = mapEntry1;
            graph.node(mapExit2).scopeEntry = mapEntry2;
            graph.node(mapExit3).scopeEntry = mapEntry3;
            graph.node(tasklet3).scopeEntry = mapEntry3;
            graph.addEdge(new GenericEdge(accessNode00, mapEntry1));
            graph.addEdge(new GenericEdge(accessNode00, accessNode10));
            graph.addEdge(new GenericEdge(mapEntry1, tasklet1));
            graph.addEdge(new GenericEdge(tasklet1, mapExit1));
            graph.addEdge(new GenericEdge(mapExit1, mapEntry2));
            graph.addEdge(new GenericEdge(mapEntry2, mapExit2));
            graph.addEdge(new GenericEdge(accessNode10, accessNode20));
            graph.addEdge(new GenericEdge(accessNode10, accessNode21));
            graph.addEdge(new GenericEdge(accessNode11, accessNode21));
            graph.addEdge(new GenericEdge(accessNode21, accessNode30));
            graph.addEdge(new GenericEdge(mapEntry3, tasklet3));
            graph.addEdge(new GenericEdge(tasklet3, mapExit3));
            graph.addEdge(new GenericEdge(mapExit3, accessNode50));
            graph.addEdge(new GenericEdge(mapExit3, accessNode51));
            graph.addEdge(new GenericEdge(accessNode30, accessNode40));
            graph.addEdge(new GenericEdge(accessNode40, accessNode51));
            graph.addEdge(new GenericEdge(accessNode12, accessNode22));
            graph.addEdge(new GenericEdge(accessNode22, accessNode30));
            graph.addEdge(new GenericEdge(accessNode22, accessNode31));
            graph.addEdge(new GenericEdge(accessNode31, accessNode41));
            graph.addEdge(new GenericEdge(accessNode23, accessNode32));
            graph.addEdge(new GenericEdge(accessNode32, accessNode41));*/

            // set node sizes
            _.forEach(graph.allNodes(), (node: RenderNode) => {
                node.labelSize = this._labelSize(node);
                node.updateSize(node.labelSize);
            });
            // set edge label sizes
            _.forEach(graph.allEdges(), (edge: RenderEdge) => {
                edge.labelSize = this._edgeLabelSize(edge);
            });

            layouter.layout(graph).then((layout: LayoutGraph) => {
                /*const layoutAnalysis = new LayoutAnalysis(layout);
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
                /*const box = graph.boundingBox();
                console.log("Total size: " + box.width.toFixed(0) + "x" + box.height.toFixed(0));
                console.log("Segment crossings: " + layoutAnalysis.segmentCrossings());*/

                Timer.printTimes();
                this._render(graph);
            });
        });
    }

    showDag(layouter: Layouter, name: string): void {
        Loader.loadDag(name).then((graph: RenderGraph) => {
            // set node sizes
            _.forEach(graph.allNodes(), (node: RenderNode) => {
                node.labelSize = this._labelSize(node);
                node.updateSize(node.labelSize);
            });
            layouter.layout(graph).then((layout: LayoutGraph) => {
                this._render(graph);
            });
        });
    }

    drawSimpleGraph(nodes: Array<[number, number, number?]>,
                    heavyEdges: Array<[[number, number], [number, number], number?]>,
                    lightEdges: Array<[[number, number], [number, number], number?]>,
                    dashedLines: Array<[number, number, number]> = []): void {
        const GRID = 40;
        const NODE = 12;
        _.forEach(dashedLines, (line: [number, number, number]) => {
            const y = GRID * line[0];
            const x0 = GRID * line[1];
            const x1 = GRID * line[2];
            for (let x = x0; x < x1; x += 3) {
                const circle = new Circle(null, x, y, 1, Color.fromNumber(0x999999));
                this._container.addChild(circle);
            }
        });
        _.forEach(heavyEdges, (edge: [[number, number], [number, number], number?]) => {
            const line = new Line(null, GRID * edge[0][0], GRID * edge[0][1], GRID * edge[1][0], GRID * edge[1][1], 3, Color.fromNumber(edge[2] || 0));
            this._container.addChild(line);
        });
        _.forEach(lightEdges, (edge: [[number, number], [number, number], number?]) => {
            const line = new Line(null, GRID * edge[0][0], GRID * edge[0][1], GRID * edge[1][0], GRID * edge[1][1], 1, Color.fromNumber(edge[2] || 0));
            this._container.addChild(line);
        });
        _.forEach(nodes, (node: [number, number, number?]) => {
            const circle = new Circle(null, GRID * node[0], GRID * node[1], NODE / 2, Color.fromNumber(node[2] || 0));
            this._container.addChild(circle);
        });
    }



    renderLive(): void {
        let prevStoredGraph = null;
        const layouter = new DagreLayouter();

        const addSubgraph = (parent, obj) => {
            _.forEach(obj.nodes, (nodeObj, id) => {
                if (nodeObj.child !== null) {
                    const node = new GenericContainerNode("GenericContainerNode");
                    node.setLabel(nodeObj.label || "");
                    node.updateSize(this._labelSize(node));
                    parent.addNode(node, id);
                    const childGraph = new RenderGraph();
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
                this._render(renderGraph);
            }
            setTimeout(doRender, 3000);
        };
        doRender();
    }

    renderOrderGraph(step: number = 0, resetView: boolean = false): void {
        const renderGraph = new RenderGraph();
        let y = 0;
        const stepObj = JSON.parse(window.localStorage.getItem("orderGraph"))[step];
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
                _.forEach(group.nodes, (nodeObj: any) => {
                    const node = new GenericNode(nodeObj.id.toString() || "", Color.WHITE, nodeObj.isVirtual ? Color.fromNumber(0xCCCCCC) : Color.BLACK); // might use nodeObj.id.toString() instead of nodeObj.label
                    groupGraph.addNode(node, parseInt(nodeObj.id));
                    nodeMap.set(node.id, node);
                    node.x = x;
                    node.y = y;
                    node.labelSize = this._labelSize(node);
                    node.width = node.labelSize.width;
                    node.height = node.labelSize.height;
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
            y += 200;
            groupsPerRank.push(groups);
        });
        const maxWidth = _.max(widths);
        _.forEach(widths, (width: number, r: number) => {
            const offset = (maxWidth - width) / 2
            _.forEach(groupsPerRank[r], (group: RenderNode) => {
                group.x += offset;
                _.forEach(group.childGraph.nodes(), (node: RenderNode) => {
                    node.x += offset;
                });
            });
        });
        this._additionalShapes.length = 0;
        _.forEach(stepObj.edges, (edgeObj: any) => {
            const srcNode = nodeMap.get(edgeObj.src);
            if (srcNode === undefined) {
                console.log(edgeObj.src);
            }
            const srcPos = srcNode.boundingBox().bottomCenter();
            const dstNode = nodeMap.get(edgeObj.dst);
            const dstPos = dstNode.boundingBox().topCenter();
            const weight = (edgeObj.weight === "INFINITY" ? Number.POSITIVE_INFINITY : parseInt(edgeObj.weight));
            const lineWidth = Math.min(weight, 4);
            const line = new Line(null, srcPos.x, srcPos.y, dstPos.x, dstPos.y, lineWidth);
            this._additionalShapes.push(line);
        });
        this._render(renderGraph, resetView ? "auto" : null);
    }



    private _labelSize(node: RenderNode): Size {
        const textBox = (new Text(this, 0, 0, node.label(), node.labelFontSize)).boundingBox();
        return {
            width: textBox.width + 2 * node.labelPaddingX,
            height: textBox.height + 2 * node.labelPaddingY,
        }
    }

    private _edgeLabelSize(edge: RenderEdge): Size {
        return (new Text(this, 0, 0, edge.label(), edge.labelFontSize)).boundingBox().size();
    }

    /**
     * Adds an offset to center the label within the node (if necessary).
     */
    private _labelPosition(node: RenderNode): Vector {
        const labelSize = node.labelSize;
        const labelBox = new Box(
            node.x + node.labelPaddingX,
            node.y + node.labelPaddingY,
            labelSize.width,
            labelSize.height,
        );
        return labelBox.centerIn(node.boundingBox()).topLeft();
    }

    protected _getShapesForGraph(graph: RenderGraph): Array<Shape> {
        const shapes = [];
        _.forEach(graph.nodes(), (node: RenderNode) => {
            _.forEach(this._getShapesForNode(node), shape => shapes.push(shape));
        });
        _.forEach(graph.edges(), (edge: RenderEdge) => {
            _.forEach(this._getShapesForEdge(edge), shape => shapes.push(shape));
        });
        return shapes;
    }

    private _getShapesForNode(node: RenderNode): Array<Shape> {
        const shapes = [];
        switch (node.type()) {
            case "AccessNode":
            case "GenericNode":
                shapes.push(new Ellipse(node, node.x, node.y, node.width, node.height, node.backgroundColor || Color.BLACK, node.borderColor || Color.BLACK));
                shapes.push(new Text(this, this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
                break;
            case "LibraryNode":
                shapes.push(new FoldedCornerRectangle(this, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this, this._labelPosition(node).x, this._labelPosition(node).y, node.label()))
                break;
            case "NestedSDFG":
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height));
                break;
            case "SDFGState":
                const color = new Color(0xDE, 0xEB, 0xF7);
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height, color, color));
                shapes.push(new Text(this, node.x + 5, node.y + 5, node.label()));
                break;
            case "Tasklet":
                shapes.push(new Octagon(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this, this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
                break;
            case "GenericContainerNode":
                shapes.push(new Rectangle(node, node.x, node.y, node.width, node.height));
                shapes.push(new Text(this, node.x + 5, node.y + 5, node.label()));
                break;
        }
        if (node.type().endsWith("Entry")) {
            shapes.push(new UpwardTrapezoid(node, node.x, node.y, node.width, node.height));
            shapes.push(new Text(this, this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
        }
        if (node.type().endsWith("Exit")) {
            shapes.push(new DownwardTrapezoid(node, node.x, node.y, node.width, node.height));
            shapes.push(new Text(this, this._labelPosition(node).x, this._labelPosition(node).y, node.label()));
        }

        // add child graph shapes
        if (node.childGraph !== null) {
            _.forEach(this._getShapesForGraph(node.childGraph), (shape: Shape) => {
                shapes.push(shape);
            });
        }

        // add connector shapes
        const backgroundColorUnscoped = Color.fromNumber(0xf0fdff);
        const backgroundColorScoped = Color.fromNumber(0xc1dfe6).fade(0.56);
        const borderColorUnscoped = Color.BLACK;
        const borderColorScoped = Color.BLACK.fade(0.56);
        _.forEach(node.inConnectors, (connector: RenderConnector) => {
            const backgroundColor = (connector.name.startsWith('IN_') ? backgroundColorScoped : backgroundColorUnscoped);
            const borderColor = (connector.name.startsWith('IN_') ? borderColorScoped : borderColorUnscoped);
            shapes.push(new Ellipse(connector, connector.x, connector.y, connector.width, connector.height, backgroundColor, borderColor));
        });
        _.forEach(node.outConnectors, (connector: RenderConnector) => {
            const backgroundColor = (connector.name.startsWith('OUT_') ? backgroundColorScoped : backgroundColorUnscoped);
            const borderColor = (connector.name.startsWith('OUT_') ? borderColorScoped : borderColorUnscoped);
            shapes.push(new Ellipse(connector, connector.x, connector.y, connector.width, connector.height, backgroundColor, borderColor));
        });
        return shapes;
    }

    private _getShapesForEdge(edge: RenderEdge): Array<Shape> {
        const shapes: Array<Shape> = [new EdgeShape(edge, _.clone(edge.points), edge.color(), edge.lineWidth(), edge.lineStyle())];
        if (edge.labelX) {
            const labelSize = this._edgeLabelSize(edge);
            const labelBackground = new Rectangle(null, edge.labelX - 3, edge.labelY - 3, labelSize.width + 6, labelSize.height + 6, Color.WHITE.fade(0.8), Color.TRANSPARENT);
            labelBackground.zIndex = 2;
            //shapes.push(labelBackground);
            shapes.push(new Text(this, edge.labelX, edge.labelY, edge.label(), edge.labelFontSize, Color.fromNumber(0x666666)));
        }
        return shapes;
    }
}
