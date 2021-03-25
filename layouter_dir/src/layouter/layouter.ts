import * as _ from "lodash";
import LayoutConnector from "../layoutGraph/layoutConnector";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import RenderConnector from "../renderGraph/renderConnector";
import RenderEdge from "../renderGraph/renderEdge";
import RenderGraph from "../renderGraph/renderGraph";
import RenderNode from "../renderGraph/renderNode";
import OrderGraph from "../order/orderGraph";
import OrderGroup from "../order/orderGroup";
import OrderEdge from "../order/orderEdge";
import OrderNode from "../order/orderNode";
import Vector from "../geometry/vector";
import Segment from "../geometry/segment";
import Edge from "../graph/edge";
import Assert from "../util/assert";

true
export default abstract class Layouter {
    protected _options: any;

    constructor(options: object = {}) {
        this._options = _.defaults(options, {
            connectorSpacing: 10,
            targetEdgeLength: 50,
            withLabels: false,
            bundle: false,
            minimizeConnectorCrossings: false,
            maximizeAngles: false,
            alignInAndOut: false
        });
    }

    public getOptionsForAnalysis(): object {
        return _.pick(this._options, ['targetEdgeLength']);
    }

    public layout(renderGraph: RenderGraph): LayoutGraph {
        const layoutGraph = this.createLayoutGraph(renderGraph);

        if (this._options['bundle']) {
            this._createBundles(layoutGraph);
        }

        this.doLayout(layoutGraph);
        /*if (this._options['minimizeConnectorCrossings']) {
            this._placeConnectorsHeuristically(renderGraph);
        } else {
            this._placeConnectorsCenter(layoutGraph);
            this._matchEdgesToConnectors(layoutGraph);
        }*/
        if (this._options['maximizeAngles']) {
            this._maximizeAngles(layoutGraph);
        }
        this._copyLayoutInfo(layoutGraph, renderGraph);

        return layoutGraph;
    }

    protected abstract doLayout(graph: LayoutGraph): void;


    /**
     * Places the scoped connectors in the middle and the unscoped evenly on both sides.
     */
    protected _placeConnectorsCenter(graph: LayoutGraph): void {
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
            const inConnectorsScoped = _.filter(node.inConnectors, connector => connector.isScoped);
            const inConnectorsUnscoped = _.filter(node.inConnectors, connector => !connector.isScoped);
            const outConnectorsScoped = _.filter(node.outConnectors, connector => connector.isScoped);
            const outConnectorsUnscoped = _.filter(node.outConnectors, connector => !connector.isScoped);

            const hasMoreInThanOut = inConnectorsUnscoped.length > outConnectorsUnscoped.length ? 1 : 0;
            const hasMoreOutThanIn = outConnectorsUnscoped.length > inConnectorsUnscoped.length ? 1 : 0;

            const arrangedInConnectors = [];
            const arrangedOutConnectors = [];
            for (let i = 0; i < inConnectorsUnscoped.length; ++i) {
                const isLeft = i < (inConnectorsUnscoped.length - hasMoreInThanOut) / 2;
                arrangedInConnectors[i + (isLeft ? 0 : inConnectorsScoped.length)] = inConnectorsUnscoped[i];
            }
            let offset = Math.ceil((inConnectorsUnscoped.length - hasMoreInThanOut) / 2);
            for (let i = 0; i < inConnectorsScoped.length; ++i) {
                arrangedInConnectors[i + offset] = inConnectorsScoped[i];
            }
            for (let i = 0; i < outConnectorsUnscoped.length; ++i) {
                let isLeft = i < (outConnectorsUnscoped.length - hasMoreOutThanIn) / 2;
                arrangedOutConnectors[i + (isLeft ? 0 : outConnectorsScoped.length)] = outConnectorsUnscoped[i];
            }
            offset = Math.ceil((outConnectorsUnscoped.length - hasMoreOutThanIn) / 2);
            for (let i = 0; i < outConnectorsScoped.length; ++i) {
                arrangedOutConnectors[i + offset] = outConnectorsScoped[i];
            }

            const connectorDifference = node.inConnectors.length - node.outConnectors.length;
            if (node.inConnectors.length > 0) {
                let inConnectorsWidth = node.inConnectors.length * node.inConnectors[0].diameter + (node.inConnectors.length - 1) * this._options.connectorSpacing;
                if (connectorDifference % 2 === -1 && inConnectorsScoped.length > 0) {
                    inConnectorsWidth += node.inConnectors[0].diameter + this._options.connectorSpacing;
                }
                const firstX = node.x + (node.width - inConnectorsWidth) / 2;
                const y = node.y - node.inConnectors[0].diameter / 2;
                _.forEach(arrangedInConnectors, (connector: LayoutConnector, i) => {
                    connector.setPosition(firstX + (connector.diameter + this._options.connectorSpacing) * i, y);
                });
            }
            if (node.outConnectors.length > 0) {
                let outConnectorsWidth = node.outConnectors.length * node.outConnectors[0].diameter + (node.outConnectors.length - 1) * this._options.connectorSpacing;
                if (connectorDifference % 2 === 1 && inConnectorsScoped.length > 0) {
                    outConnectorsWidth += node.outConnectors[0].diameter + this._options.connectorSpacing;
                }
                const firstX = node.x + (node.width - outConnectorsWidth) / 2;
                const y = node.y + node.height - node.outConnectors[0].diameter / 2;
                _.forEach(arrangedOutConnectors, (connector, i) => {
                    connector.setPosition(firstX + (connector.diameter + this._options.connectorSpacing) * i, y);
                });
            }
        });
    }

    protected _matchEdgesToConnectors(layoutGraph: LayoutGraph): void {
        _.forEach(layoutGraph.allEdges(), (edge: LayoutEdge) => {
            if (edge.srcConnector !== null) {
                const srcNode = <LayoutNode>edge.graph.node(edge.src);
                let srcConnector = srcNode.connector("OUT", edge.srcConnector);
                if (srcConnector === undefined && srcNode.childGraph !== null) {
                    const childGraph = <LayoutGraph>srcNode.childGraph;
                    if (childGraph.exitNode !== null) {
                        srcConnector = childGraph.exitNode.connector("OUT", edge.srcConnector);
                    }
                }
                if (srcConnector === undefined) {
                    return;
                }
                const position = srcConnector.position();
                position.x += srcConnector.diameter / 2;
                position.y += srcConnector.diameter;
                edge.points[0] = position;
            }
            if (edge.dstConnector !== null) {
                const dstNode = <LayoutNode>edge.graph.node(edge.dst);
                let dstConnector = dstNode.connector("IN", edge.dstConnector);
                if (dstConnector === undefined && dstNode.childGraph !== null) {
                    const childGraph = <LayoutGraph>dstNode.childGraph;
                    if (childGraph.entryNode !== null) {
                        dstConnector = childGraph.entryNode.connector("IN", edge.dstConnector);
                    }
                }
                if (dstConnector === undefined) {
                    return;
                }
                const position = dstConnector.position();
                position.x += dstConnector.diameter / 2;
                edge.points[edge.points.length - 1] = position;
            }
        });
    }

    private createLayoutGraph(renderGraph: RenderGraph): LayoutGraph {
        const transformSubgraph = (renderGraph: RenderGraph): LayoutGraph => {
            let mayHaveCycles = false;
            if (renderGraph.parentNode === null || renderGraph.parentNode.type() === "NestedSDFG") {
                mayHaveCycles = true;
            }
            const layoutGraph = new LayoutGraph(mayHaveCycles);

            // add nodes and create groups for scopes (maps etc.)
            const createLayoutNode = (node: RenderNode) => {
                const layoutNode = new LayoutNode(node.size(), node.childPadding);
                if (node.type() === "AccessNode") {
                    layoutNode.isAccessNode = true;
                }
                _.forEach(node.inConnectors, (connector: RenderConnector) => {
                    layoutNode.addConnector("IN", connector.name, connector.width);
                });
                _.forEach(node.outConnectors, (connector: RenderConnector) => {
                    layoutNode.addConnector("OUT", connector.name, connector.width);
                });
                node.layoutNode = layoutNode;
                layoutNode.setLabel(node.type() + " " + node.id + " (" + node.label() + ")"); // for debugging
                return layoutNode;
            };

            // create layout nodes for scope entries and scopes around them
            const layoutChildren = new Map();
            _.forEach(renderGraph.nodes(), (node: RenderNode) => {
                if (node.type().endsWith("Entry")) {
                    // check if corresponding exit node exists
                    let exitExists = false;
                    _.forEach(renderGraph.nodes(), (node2: RenderNode) => {
                        if (node2.type().endsWith("Exit") && node2.scopeEntry === node.id) {
                            exitExists = true;
                        }
                    });
                    if (!exitExists) {
                        return;
                    }

                    const entryNode = createLayoutNode(node);
                    const scopeNode = new LayoutNode();
                    const scopeGraph = new LayoutGraph();
                    scopeNode.setChildGraph(scopeGraph);
                    scopeGraph.addNode(entryNode);
                    node.layoutGraph = scopeGraph;
                    node.layoutNode = entryNode;
                    scopeGraph.entryNode = entryNode;
                    layoutChildren.set(scopeNode, []);
                    scopeNode.setLabel("Map with entry " + entryNode.label()); // for debugging
                }
            });

            // create unscoped layout nodes and assign children (other than the entry) to the scope node
            _.forEach(renderGraph.nodes(), (node: RenderNode) => {
                if (node.scopeEntry === null) {
                    if (node.layoutNode) {
                        layoutGraph.addNode(node.layoutGraph.parentNode);
                    } else {
                        layoutGraph.addNode(createLayoutNode(node));
                        node.layoutGraph = layoutGraph;
                    }
                } else {
                    layoutChildren.get((<RenderNode>renderGraph.node(node.scopeEntry)).layoutGraph.parentNode).push(node);
                }
            });

            // recursively add scope children
            const addScopeChildren = (layoutGraph: LayoutGraph) => {
                _.forEach(layoutGraph.nodes(), (node: LayoutNode) => {
                    if (layoutChildren.has(node)) {
                        _.forEach(layoutChildren.get(node), (renderNode: RenderNode) => {
                            if (renderNode.layoutNode) {
                                // renderNode is an entry node
                                node.childGraph.addNode(renderNode.layoutGraph.parentNode);
                            } else {
                                const layoutNode = createLayoutNode(renderNode);
                                node.childGraph.addNode(layoutNode);
                                renderNode.layoutGraph = <LayoutGraph>node.childGraph;
                                if (renderNode.type().endsWith("Exit")) {
                                    (<LayoutGraph>node.childGraph).exitNode = layoutNode;
                                }
                            }
                        });
                    }
                    if (node.childGraph !== null) {
                        addScopeChildren(<LayoutGraph>node.childGraph);
                    }
                });
            };
            addScopeChildren(layoutGraph);

            // add edges
            _.forEach(renderGraph.edges(), (edge: RenderEdge) => {
                let srcNode = renderGraph.node(edge.src);
                let dstNode = renderGraph.node(edge.dst);
                let srcLayoutNode = srcNode.layoutNode;
                let dstLayoutNode = dstNode.layoutNode;
                if (srcNode.layoutGraph !== dstNode.layoutGraph) {
                    if (dstNode.layoutGraph.entryNode === dstLayoutNode) {
                        dstLayoutNode = dstNode.layoutGraph.parentNode;
                    } else {
                        srcLayoutNode = srcNode.layoutGraph.parentNode;
                    }
                }
                Assert.assert(srcLayoutNode.graph === dstLayoutNode.graph, "edge between different graphs", edge);
                edge.layoutEdge = new LayoutEdge(srcLayoutNode.id, dstLayoutNode.id, edge.srcConnector, edge.dstConnector, edge.labelSize);
                srcLayoutNode.graph.addEdge(edge.layoutEdge);
            });

            // recursively transform subgraph
            _.forEach(renderGraph.nodes(), (node: RenderNode) => {
                if (node.childGraph !== null) {
                    node.layoutNode.setChildGraph(transformSubgraph(node.childGraph));
                }
            });
            renderGraph.layoutGraph = layoutGraph;
            return layoutGraph;
        }
        const layoutGraph = transformSubgraph(renderGraph);

        const printLayout = (graph: LayoutGraph, level: number = 0) => {
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                console.log("  ".repeat(level) + node.label());
                if (node.childGraph !== null) {
                    printLayout(node.childGraph, level + 1);
                }
            });
        }
        //printLayout(layoutGraph); // for debugging

        return layoutGraph;
    }

    private _createBundles(layoutGraph: LayoutGraph): void
    {
        _.forEach(layoutGraph.allGraphs(), (graph: LayoutGraph) => {
            const bundles = new Map();
            _.forEach(graph.edges(), (edge: LayoutEdge) => {
                if ((edge.srcConnector !== null || edge.dstConnector !== null) && (edge.srcConnector === null || edge.dstConnector === null)) {
                    const key = edge.src + "_" + edge.dst;
                    const connector = edge.srcConnector || edge.dstConnector;
                    if (!bundles.has(key)) {
                        const bundle = {weight: 1, connectors: [connector]};
                        bundles.set(key, bundle);
                        edge.bundle = bundle;
                    } else {
                        const bundle = bundles.get(key);
                        bundle.weight++;
                        bundle.connectors.push(connector);
                        edge.bundle = bundle;
                    }
                }
            });
        });
    }

    private _maximizeAngles(layoutGraph: LayoutGraph) {
        const segments = [];
        const endpoints = [];
        let segmentId = 0;
        _.forEach(layoutGraph.allEdges(), (edge: LayoutEdge) => {
            if (edge.graph.mayHaveCycles) {
                return; // skip state graph edges
            }
            _.forEach(edge.rawSegments(), (segment: Segment) => {
                endpoints.push([segment.start, segmentId]);
                endpoints.push([segment.end, segmentId]);
                segments[segmentId++] = segment;
            });
        });
        const intersections = [[], []];
        const dimensions = ["x", "y"];
        _.forEach(dimensions, (dimension, i) => {
            const pointsSorted = _.sortBy(endpoints, ([point, segmentId]) => {
                return point[dimension];
            });
            const openSegments: Set<number> = new Set();
            _.forEach(pointsSorted, ([point, segmentId]) => {
                if (openSegments.has(segmentId)) {
                    openSegments.delete(segmentId);
                } else {
                    openSegments.forEach((otherSegmentId) => {
                        let key = Math.min(segmentId, otherSegmentId) + "_" + Math.max(segmentId, otherSegmentId);
                        intersections[i].push(key)
                    });
                    openSegments.add(segmentId);
                }
            });
        });
        const crossings = _.intersection(intersections[0], intersections[1]);
        const forces = [];
        _.forEach(crossings, key => {
            const ids = key.split("_");
            const segmentA = segments[ids[0]];
            const segmentB = segments[ids[1]];
            const vectorA = segmentA.vector();
            const vectorB = segmentB.vector();
            if (vectorA.x === 0 || vectorB.x === 0 || Math.sign(vectorA.x) !== -Math.sign(vectorB.x)) {
                return; // only consider "head-on" crossings -> <-
            }
            const y1y2 = vectorA.y * vectorB.y;
            const x1x2 = vectorA.x * vectorB.x;
            const b = vectorA.y + vectorB.y;
            const force = (-b + Math.sqrt(b * b - 4 * (y1y2 + x1x2))) / 2;
            const t = (segmentA.start.x - segmentB.start.x) / (vectorB.x - vectorA.x);
            const intersectionY = segmentA.start.y + t * vectorA.y;
            forces.push([intersectionY, force]);
        });
        const sortedForces = _.sortBy(forces, ([intersectionY, force]) => intersectionY);
        const points = [];
        const oldTops = new Map();
        _.forEach(layoutGraph.allNodes(), (node: LayoutNode) => {
            points.push([node.y, "NODE", node, "TOP"]);
            points.push([node.y + node.height, "NODE", node, "BOTTOM"]);
            oldTops.set(node, node.y);
        });
        _.forEach(layoutGraph.allEdges(), (edge: LayoutEdge) => {
            _.forEach(edge.points, (point: Vector, i: number) => {
                points.push([point.y, "EDGE", edge, i]);
            });
        });
        const pointsSorted = _.sortBy(points, ([pointY, type, object, position]) => pointY);
        let forcePointer = 0;
        let totalForce = 0;
        const movedSet = new Set();
        _.forEach(pointsSorted, ([pointY, type, object, position]) => {
            let forceSum = 0;
            let forceCount = 0;
            while (forcePointer < sortedForces.length && sortedForces[forcePointer][0] < pointY) {
                forceSum += sortedForces[forcePointer][1];
                forceCount++;
                forcePointer++;
            }
            if (forceCount > 0) {
                totalForce += forceSum / forceCount;
            }
            if (type === "NODE") {
                if (position === "TOP") {
                    object.translateWithoutChildren(0, totalForce);
                } else { // "BOTTOM"
                    const oldHeight = object.height;
                    object.height += totalForce + oldTops.get(object) - object.y; // new_height = old_height + totalForce + old_top - new_top
                    const heightDiff = object.height - oldHeight;
                    _.forEach(object.outConnectors, (connector: LayoutConnector) => {
                        connector.y += heightDiff;
                    });
                }
            } else { // "EDGE"
                if (movedSet.has(object.points[position])) {
                    throw new Error("MOVE TWICE");
                }
                movedSet.add(object.points[position]);
                object.points[position].y += totalForce;
            }
        });
    }

    private _copyLayoutInfo(layoutGraph: LayoutGraph, renderGraph: RenderGraph) {
        _.forEach(renderGraph.allNodes(), (node: RenderNode) => {
            _.assign(node, node.layoutNode.boundingBox());
            _.forEach(_.concat(node.inConnectors), (connector: RenderConnector) => {
                _.assign(connector, node.layoutNode.connector("IN", connector.name).boundingBox());
            });
            _.forEach(_.concat(node.outConnectors), (connector: RenderConnector) => {
                _.assign(connector, node.layoutNode.connector("OUT", connector.name).boundingBox());
            });

            delete node.layoutGraph;
            delete node.layoutNode;
        });
        _.forEach(renderGraph.allEdges(), (edge: RenderEdge) => {
            _.assign(edge, _.pick(edge.layoutEdge, ['points']));
            edge.updateBoundingBox();
            delete edge.layoutEdge;
        });
        _.forEach(renderGraph.allGraphs(), (graph: RenderGraph) => {
            delete graph.layoutGraph;
        });
    }



}
