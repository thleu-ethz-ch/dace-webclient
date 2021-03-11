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

true
export default abstract class Layouter {
    protected _options: any;

    constructor(options: object = {}) {
        this._options = _.defaults(options, {
            connectorSpacing: 10,
            targetEdgeLength: 50,
            withLabels: false,
            bundle: true,
            minimizeConnectorCrossings: true,
        });
    }false

    public getOptionsForAnalysis(): object {
        return _.pick(this._options, ['targetEdgeLength']);
    }

    public layout(renderGraph: RenderGraph): LayoutGraph {
        const layoutGraph = this.createLayoutGraph(renderGraph);

        if (this._options['bundle']) {
            this._createBundles(layoutGraph);
        }

        this.doLayout(layoutGraph);
        if (this._options['minimizeConnectorCrossings']) {
            this._placeConnectorsHeuristically(renderGraph);
        } else {
            this._placeConnectorsCenter(layoutGraph);
            this._matchEdgesToConnectors(layoutGraph);
        }
        this._copyLayoutInfo(layoutGraph, renderGraph);

        return layoutGraph;
    }

    protected abstract doLayout(graph: LayoutGraph): void;

    private _placeConnectorsHeuristically(graph: RenderGraph): void {
        _.forEach(graph.allGraphs(), (renderGraph: RenderGraph) => {
            const inConnectorsByNode = new Map();
            const outConnectorsByNode = new Map();
            const connectorGraph =  new OrderGraph();
            const connectorIdMap = new Map();

            // add nodes with connectors
            _.forEach(renderGraph.nodes(), (node: RenderNode) => {
                inConnectorsByNode.set(node.layoutNode, []);
                outConnectorsByNode.set(node.layoutNode, []);
                let hasScopedConnectors = false;
                _.forEach(node.inConnectors, (connector: RenderConnector) => {
                    hasScopedConnectors ||= (node.layoutNode.connector("IN", connector.name).isScoped);
                });
                if (hasScopedConnectors) {
                    // create one group for all connectors
                    const group = new OrderGroup({node: node, type: "ALL"});
                    connectorGraph.addGroup(group);
                    _.forEach(node.inConnectors, (connector: RenderConnector) => {
                        const isScoped = node.layoutNode.connector("IN", connector.name).isScoped
                        const orderNode = new OrderNode({type: isScoped ? "ALL" : "IN", name: connector.name});
                        group.addNode(orderNode);
                        connectorIdMap.set(node.id + "IN" + connector.name, orderNode.id);
                        if (isScoped) {
                            connectorIdMap.set(node.id + "OUTOUT_" + connector.name.substr(3), orderNode.id);
                        }
                    });
                    _.forEach(node.outConnectors, (connector: RenderConnector) => {
                        if (!node.layoutNode.connector("OUT", connector.name).isScoped) {
                            const orderNode = new OrderNode({type: "OUT", name: connector.name});
                            group.addNode(orderNode);
                            connectorIdMap.set(node.id + "OUT" + connector.name, orderNode.id);
                        }
                    });
                } else {
                    // create separate groups for in-connectors and out-connectors
                    if (node.inConnectors.length > 0) {
                        const group = new OrderGroup({node: node, type: "IN"});
                        connectorGraph.addGroup(group);
                        _.forEach(node.inConnectors, (connector: RenderConnector) => {
                            const orderNode = new OrderNode({type: "IN", name: connector.name});
                            group.addNode(orderNode);
                            connectorIdMap.set(node.id + "IN" + connector.name, orderNode.id);
                        });
                    }
                    if (node.outConnectors.length > 0) {
                        const group = new OrderGroup({node: node, type: "OUT"});
                        connectorGraph.addGroup(group);
                        _.forEach(node.outConnectors, (connector: RenderConnector) => {
                            const orderNode = new OrderNode({type: "OUT", name: connector.name});
                            group.addNode(orderNode);
                            connectorIdMap.set(node.id + "OUT" + connector.name, orderNode.id);
                        });
                    }
                }
            });

            // add edges between connectors (nodes)
            _.forEach(renderGraph.edges(), (edge: RenderEdge) => {
                if (edge.srcConnector !== null && edge.dstConnector !== null) {
                    const srcId = connectorIdMap.get(edge.src + "OUT" + edge.srcConnector);
                    const dstId = connectorIdMap.get(edge.dst + "IN" + edge.dstConnector);
                    connectorGraph.addEdge(new OrderEdge(srcId, dstId));
                }
            });

            // add edges between nodes (groups)
            const addedEdges = new Set();
            _.forEach(connectorGraph.edges(), (edge: OrderEdge) => {
                const srcGroup = connectorGraph.node(edge.src).group;
                const dstGroup = connectorGraph.node(edge.dst).group;
                const id = srcGroup.id + "_" + dstGroup.id;
                if (!addedEdges.has(id)) {
                    connectorGraph.addEdge(new OrderEdge(srcGroup.id, dstGroup.id, "GROUP"));
                    addedEdges.add(id);
                }
            });

            // add non-connector nodes on top (dominating)
            _.forEach(connectorGraph.sourceGroups(), (source: OrderGroup) => {
                if (source.reference.type === "OUT") {
                    return;
                }
                const orderGroup = new OrderGroup(null, true);
                connectorGraph.addGroup(orderGroup);
                connectorGraph.addEdge(new OrderEdge(orderGroup.id, source.id, "GROUP"));
                const sortedEdges = _.sortBy(renderGraph.inEdges(source.reference.node.id), (edge: RenderEdge) => {
                    return edge.layoutEdge.points[edge.layoutEdge.points.length - 3].x;
                });
                _.forEach(sortedEdges, (edge: RenderEdge) => {
                    const orderNode = new OrderNode(null);
                    orderGroup.addNode(orderNode);
                    const dstId = connectorIdMap.get(edge.dst + "IN" + edge.dstConnector);
                    connectorGraph.addEdge(new OrderEdge(orderNode.id, dstId));
                });
            });
            // add non-connector nodes on bottom (dominated)
            _.forEach(connectorGraph.sinkGroups(), (sink: OrderGroup) => {
                if (sink.reference.type === "IN") {
                    return;
                }
                const orderGroup = new OrderGroup(null, true);
                connectorGraph.addGroup(orderGroup);
                connectorGraph.addEdge(new OrderEdge(sink.id, orderGroup.id, "GROUP"));
                const sortedEdges = _.sortBy(renderGraph.outEdges(sink.reference.node.id), (edge: RenderEdge) => {
                    return edge.layoutEdge.points[2].x;
                });
                _.forEach(sortedEdges, (edge: RenderEdge) => {
                    const orderNode = new OrderNode(edge.id);
                    orderGroup.addNode(orderNode);
                    const srcId = connectorIdMap.get(edge.src + "OUT" + edge.srcConnector);
                    connectorGraph.addEdge(new OrderEdge(srcId, orderNode.id));
                });
            });

            _.forEach(connectorGraph.components(), (connectorGraph: OrderGraph) => {
                if (connectorGraph.groups().length > 0) {
                    connectorGraph.order();
                    _.forEach(connectorGraph.groups(), group => {
                        if (group.reference !== null) {
                            const layoutNode = <LayoutNode>group.reference.node.layoutNode;
                            if (group.reference.type === "ALL") {
                                _.forEach(group.order, pos => {
                                    const connectorType = group.nodes[pos].reference.type;
                                    if (connectorType === "ALL" || connectorType === "IN") {
                                        const inConnector = layoutNode.connector("IN", group.nodes[pos].reference.name);
                                        inConnectorsByNode.get(layoutNode).push(inConnector);
                                        if (connectorType === "ALL") {
                                            const outConnector = layoutNode.connector("OUT", "OUT_" + group.nodes[pos].reference.name.substr("3"));
                                            outConnectorsByNode.get(layoutNode).push(outConnector);
                                        }
                                    } else {
                                        const outConnector = layoutNode.connector("OUT", group.nodes[pos].reference.name);
                                        outConnectorsByNode.get(layoutNode).push(outConnector);
                                    }
                                });
                            } else if (group.reference.type === "IN") {
                                _.forEach(group.order, pos => {
                                    const inConnector = layoutNode.connector("IN", group.nodes[pos].reference.name);
                                    inConnectorsByNode.get(layoutNode).push(inConnector);
                                });
                            } else {
                                _.forEach(group.order, pos => {
                                    const outConnector = layoutNode.connector("OUT", group.nodes[pos].reference.name);
                                    outConnectorsByNode.get(layoutNode).push(outConnector);
                                });
                            }
                        }
                    });
                    // assign x coordinates to connectors (also y, but those are trivial)
                    _.forEach(connectorGraph.orderedGroups(), (connectorGroup: OrderGroup) => {
                        if (connectorGroup.reference === null) {
                            return;
                        }
                        const renderNode = connectorGroup.reference.node;
                        const layoutNode = renderNode.layoutNode;
                        const inConnectors = inConnectorsByNode.get(layoutNode) || [];
                        const outConnectors = outConnectorsByNode.get(layoutNode) || [];
                        if (inConnectors.length + outConnectors.length === 0) {
                            return; // skip nodes with no connectors
                        }
                        const inPositions = new Map();
                        const outPositions = new Map();
                        const inNeighborXSum = [];
                        const outNeighborXSum = [];
                        const inNeighborCount = [];
                        const outNeighborCount = [];
                        _.forEach(inConnectors, (connector, pos) => {
                            inPositions.set(connector.name, pos);
                            inNeighborXSum[pos] = 0;
                            inNeighborCount[pos] = 0;
                        });
                        _.forEach(outConnectors, (connector, pos) => {
                            outPositions.set(connector.name, pos);
                            outNeighborXSum[pos] = 0;
                            outNeighborCount[pos] = 0;
                        });
                        // gather values to calculate mean neighbor value
                        if (inConnectors.length > 0) {
                            _.forEach(renderGraph.inEdges(renderNode.id), (renderEdge: RenderEdge) => {
                                const layoutEdge = renderEdge.layoutEdge;
                                const connectorPos = inPositions.get(layoutEdge.dstConnector);
                                inNeighborXSum[connectorPos] += layoutEdge.points[layoutEdge.points.length - 3].x;
                                inNeighborCount[connectorPos]++;
                            });
                        }
                        if (outConnectors.length > 0) {
                            _.forEach(renderGraph.outEdges(renderNode.id), (renderEdge: RenderEdge) => {
                                const layoutEdge = renderEdge.layoutEdge;
                                const connectorPos = outPositions.get(layoutEdge.srcConnector);
                                outNeighborXSum[connectorPos] += layoutEdge.points[2].x;
                                outNeighborCount[connectorPos]++;
                            });
                        }
                        _.forEach(inConnectors, (connector, pos) => {
                            if (connector.isScoped) {
                                const outConnector = connector.counterpart;
                                const outPos = outPositions.get(outConnector.name);
                                const inSum = inNeighborXSum[pos];
                                const inCount = inNeighborCount[pos];
                                inNeighborXSum[pos] += outNeighborXSum[outPos];
                                inNeighborCount[pos] += outNeighborCount[outPos];
                                outNeighborXSum[outPos] += inSum;
                                outNeighborCount[outPos] += inCount;
                            }
                        });

                        const inX = [];
                        const outX = [];
                        const inIdealX = [];
                        const outIdealX = [];
                        const inForce = [];
                        const outForce = [];
                        const SPACE = this._options['connectorSpacing'];
                        const firstConnector = inConnectors[0] || outConnectors[0];
                        const CW = firstConnector.width;
                        const leftBoundary = layoutNode.x + renderNode.connectorPadding;
                        const rightBoundary = layoutNode.x + layoutNode.width - renderNode.connectorPadding - CW;
                        const inY = layoutNode.y - CW / 2;
                        const outY = layoutNode.y + layoutNode.height - CW / 2;
                        let absMinX = [leftBoundary];
                        let minX = leftBoundary;
                        let maxX = rightBoundary - (inConnectors.length - 1) * (CW + SPACE);
                        let leftMostMovable = 0;
                        _.forEach(inConnectors, (connector: LayoutConnector, pos: number) => {
                            inIdealX[pos] = inNeighborXSum[pos] / inNeighborCount[pos] - CW / 2;
                            inX[pos] = Math.max(minX, Math.min(maxX, inIdealX[pos]));
                            inForce[pos] = inIdealX[pos] - inX[pos];
                            while (inX[pos] > absMinX[pos] && inForce[pos] < 0) {
                                let maxMove = inX[pos] - absMinX[pos];
                                let negativeCharged = 0;
                                let forceSum = 0;
                                for (let i = leftMostMovable; i <= pos; ++i) {
                                    forceSum += inForce[i];
                                    if (inForce[i] < 0) {
                                        negativeCharged++;
                                        maxMove = Math.min(maxMove, -inForce[i]);
                                    }
                                }
                                const positiveCharged = pos - leftMostMovable + 1 - negativeCharged;
                                if (forceSum >= 0) {
                                    break;
                                }
                                if (positiveCharged > negativeCharged) {
                                    break;
                                }
                                let move = maxMove;
                                if (positiveCharged === negativeCharged) {
                                    move = Math.min(-0.5 * forceSum, maxMove);
                                }
                                // move whole group as far to the left as possible
                                for (let i = leftMostMovable; i <= pos; ++i) {
                                    inX[i] -= move;
                                    inForce[i] = inIdealX[i] - inX[i];
                                    if (inX[i] === absMinX[i]) {
                                        leftMostMovable = i + 1;
                                        absMinX[i + 1] = absMinX[i] + (CW + SPACE);
                                    }
                                }
                                if (positiveCharged === negativeCharged) {
                                    break;
                                }
                            }
                            if (inX[pos] === absMinX[pos]) {
                                leftMostMovable = pos + 1;
                            }
                            minX = inX[pos] + (CW + SPACE);
                            absMinX[pos + 1] = absMinX[pos] + (CW + SPACE);
                            maxX += (CW + SPACE);
                        });
                        minX = leftBoundary;
                        absMinX = [leftBoundary];
                        maxX = rightBoundary - (outConnectors.length - 1) * (CW + SPACE);
                        leftMostMovable = 0;
                        _.forEach(outConnectors, (connector: LayoutConnector, pos: number) => {
                            if (connector.isScoped) {
                                outX[pos] = inX[inPositions.get(connector.counterpart.name)];
                                absMinX[pos] = outX[pos];
                            } else {
                                outIdealX[pos] = outNeighborXSum[pos] / outNeighborCount[pos] - CW / 2;
                                outX[pos] = Math.max(minX, Math.min(maxX, outIdealX[pos]));
                                outForce[pos] = outIdealX[pos] - outX[pos];
                                while (outX[pos] > absMinX[pos] && outForce[pos] < 0) {
                                    let maxMove = outX[pos] - absMinX[pos];
                                    let negativeCharged = 0;
                                    let forceSum = 0;
                                    for (let i = leftMostMovable; i <= pos; ++i) {
                                        forceSum += outForce[i];
                                        if (outForce[i] < 0) {
                                            negativeCharged++;
                                            maxMove = Math.min(maxMove, -outForce[i]);
                                        }
                                    }
                                    const positiveCharged = pos - leftMostMovable + 1 - negativeCharged;
                                    if (forceSum >= 0) {
                                        break;
                                    }
                                    if (positiveCharged > negativeCharged) {
                                        break;
                                    }
                                    let move = maxMove;
                                    if (positiveCharged === negativeCharged) {
                                        move = Math.min(-0.5 * forceSum, maxMove);
                                    }
                                    // move whole group as far to the left as possible
                                    for (let i = leftMostMovable; i <= pos; ++i) {
                                        outX[i] -= move;
                                        outForce[i] = outIdealX[i] - outX[i];
                                        if (outX[i] === absMinX[i]) {
                                            leftMostMovable = i + 1;
                                            absMinX[i + 1] = absMinX[i] + (CW + SPACE);
                                        }
                                    }
                                    if (positiveCharged === negativeCharged) {
                                        break;
                                    }
                                }
                            }
                            if (outX[pos] === absMinX[pos]) {
                                leftMostMovable = pos + 1;
                            }
                            minX = outX[pos] + (CW + SPACE);
                            absMinX[pos + 1] = absMinX[pos] + (CW + SPACE);
                            maxX += (CW + SPACE);
                        });
                        _.forEach(inConnectors, (connector: LayoutConnector, pos: number) => {
                            connector.setPosition(inX[pos], inY);
                            const edgeInPos = connector.position().add(new Vector(connector.width / 2, 0));
                            _.forEach(renderGraph.inEdges(renderNode.id), (edge: RenderEdge) => {
                                if (edge.dstConnector === connector.name) {
                                    edge.layoutEdge.points[edge.layoutEdge.points.length - 1] = edgeInPos;
                                }
                                let bundled = false;
                                const points = edge.layoutEdge.points;
                                const n = points.length;
                                if (edge.layoutEdge.bundle !== null) {
                                    const connectors = edge.layoutEdge.bundle.connectors;
                                    let xSum = 0;
                                    if (connectors.length > 1) {
                                        // move middle point to mean connector position
                                        _.forEach(connectors, (name: string) => {
                                            xSum += inX[inPositions.get(name)];
                                        });
                                        points[n - 2].x = xSum / connectors.length;
                                        bundled = true;
                                    }
                                }
                                if (!bundled && n === 3) {
                                    // straighten line
                                    points[n - 2].x = (points[n - 1].x + points[n - 3].x) / 2;
                                    points[n - 2].y = (points[n - 1].y + points[n - 3].y) / 2;
                                }
                            });
                        });
                        _.forEach(outConnectors, (connector: LayoutConnector, pos: number) => {
                            connector.setPosition(outX[pos], outY);
                            const edgeOutPos = connector.position().add(new Vector(connector.width / 2, connector.width));
                            _.forEach(renderGraph.outEdges(renderNode.id), (edge: RenderEdge) => {
                                if (edge.srcConnector === connector.name) {
                                    edge.layoutEdge.points[0] = edgeOutPos;
                                }
                                let bundled = false;
                                const points = edge.layoutEdge.points;
                                if (edge.layoutEdge.bundle !== null) {
                                    const connectors = edge.layoutEdge.bundle.connectors;
                                    let xSum = 0;
                                    if (connectors.length > 1) {
                                        // move middle point to mean connector position
                                        _.forEach(connectors, (name: string) => {
                                            xSum += outX[outPositions.get(name)];
                                        });
                                        points[1].x = xSum / connectors.length;
                                        bundled = true;
                                    }
                                }
                                if (!bundled && points.length === 3) {
                                    // straighten line
                                    points[1].x = (points[0].x + points[2].x) / 2;
                                    points[1].y = (points[0].y + points[2].y) / 2;
                                }
                            });
                        });
                    });
                }
            });
        });
    }

    /**
     * Places the scoped connectors in the middle and the unscoped evenly on both sides.
     */
    private _placeConnectorsCenter(graph: LayoutGraph): void {
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

    private _matchEdgesToConnectors(layoutGraph: LayoutGraph): void {
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
                _.forEach(node.inConnectors, (connector: RenderConnector) => {
                    layoutNode.addConnector("IN", connector.name, connector.width);
                });
                _.forEach(node.outConnectors, (connector: RenderConnector) => {
                    layoutNode.addConnector("OUT", connector.name, connector.width);
                });
                node.layoutNode = layoutNode;
                layoutNode.label = node.type() + " " + node.id; // for debugging
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
                    scopeNode.label = "Map"; // for debugging
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
                let srcNode = <RenderNode><unknown>renderGraph.node(edge.src);
                let dstNode = <RenderNode><unknown>renderGraph.node(edge.dst);
                let srcLayoutNode = srcNode.layoutNode;
                let dstLayoutNode = dstNode.layoutNode;
                if (srcNode.layoutGraph !== dstNode.layoutGraph) {
                    if (dstNode.layoutGraph.entryNode === dstLayoutNode) {
                        dstLayoutNode = <LayoutNode>dstNode.layoutGraph.parentNode;
                    } else {
                        srcLayoutNode = <LayoutNode>srcNode.layoutGraph.parentNode;
                    }
                }
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
                console.log("  ".repeat(level) + node.label);
                if (node.childGraph !== null) {
                    printLayout(node.childGraph, level + 1);
                }
            });
        }
        //printLayout(layoutGraph); // for debugging

        return layoutGraph;
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

}
