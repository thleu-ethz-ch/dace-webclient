import * as _ from "lodash";
import Assert from "../util/assert";
import Box from "../geometry/box";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import Layouter from "./layouter";
import LayoutConnector from "../layoutGraph/layoutConnector";
import LayoutComponent from "../layoutGraph/layoutComponent";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import Node from "../graph/node";
import OrderGraph from "../order/orderGraph";
import OrderGroup from "../order/orderGroup";
import OrderNode from "../order/orderNode";
import OrderRank from "../order/orderRank";
import RankGraph from "../rank/rankGraph";
import RankNode from "../rank/rankNode";
import Timer from "../util/timer";
import Vector from "../geometry/vector";
import LayoutBundle from "../layoutGraph/layoutBundle";
import LevelNode from "../levelGraph/levelNode";
import LevelGraph from "../levelGraph/levelGraph";
import Segment from "../geometry/segment";
import {CONNECTOR_SIZE, CONNECTOR_SPACING} from "../util/constants";

export default class SugiyamaLayouter extends Layouter
{
    private _crossingsPerRank = [];
    private _segmentsPerRank = [];
    private _segments = [];
    private _segmentId = 0;

    protected doLayout(graph: LayoutGraph): void {
        if (graph.nodes().length === 0) {
            return;
        }
        Timer.start("doLayout()");

        // STEP 1: REMOVE CYCLES
        Timer.start("removeCycles");
        this._removeCycles(graph);
        Timer.stop("removeCycles");
        Assert.assert(!graph.hasCycle(), "graph has cycle");

        // STEP 2: ASSIGN RANKS
        Timer.start("assignRanks");
        this._assignRanks(graph);
        Timer.stop("assignRanks");
        Assert.assertNone(graph.allNodes(), node => node.rank < 0, "invalid rank assignment");

        // STEP 3: ADD VIRTUAL NODES
        Timer.start("addVirtualNodes");
        this._addVirtualNodes(graph);
        Timer.stop("addVirtualNodes");
        Assert.assertAll(graph.allEdges(), edge => {
            const srcNode = edge.graph.node(edge.src)
            return edge.isReplica || (srcNode.rank + srcNode.rankSpan === edge.graph.node(edge.dst).rank);
        }, "edge not between neighboring ranks");

        Timer.start("orderRanks");
        this._orderRanks(graph);
        Timer.stop("orderRanks");

        // STEP 4: ASSIGN COORDINATES
        Timer.start("assignCoordinates");
        this._assignCoordinates(graph);
        Timer.stop("assignCoordinates");
        Assert.assertNone(graph.allNodes(), node => typeof node.y !== "number" || isNaN(node.y), "invalid y assignment");
        Assert.assertNone(graph.allNodes(), node => typeof node.x !== "number" || isNaN(node.x), "invalid x assignment");

        // STEP 4b (OPTIONAL): MAXIMIZE ANGLES
        if (this._options['maximizeAngles']) {
            this._maximizeAngles(graph);
        }

        // STEP 5: RESTORE CYCLES
        Timer.start("restoreCycles");
        this._restoreCycles(graph);
        Timer.stop("restoreCycles");

        Timer.stop("doLayout()");
    }

    private _removeCycles(graph: LayoutGraph): void {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.mayHaveCycles) {
                // remove normal cycles
                subgraph.removeCycles();

                // remove self-loops
                _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                    if (edge.src === edge.dst) {
                        subgraph.node(edge.src).selfLoop = edge;
                        subgraph.removeEdge(edge.id);
                    }
                });
            }
        });
    }

    private _assignRanks(graph: LayoutGraph): void {
        graph.minRank = 0;
        graph.maxRank = 0;
        _.forEach(graph.components(), (component: LayoutComponent) => {
            // first determine the rank span of all nodes
            _.forEach(component.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    this._assignRanks(node.childGraph);
                    if (node.childGraph.maxRank === Number.POSITIVE_INFINITY) {
                        throw new Error("INIFINITE MAX RANK");
                    }
                    node.rankSpan = node.childGraph.maxRank - node.childGraph.minRank + 1;
                }
            });

            const rankGraph = new RankGraph();
            _.forEach(component.nodes(), node => {
                rankGraph.addNode(new RankNode(node.label()), node.id);
            });
            _.forEach(component.edges(), edge => {
                rankGraph.addEdge(new Edge(edge.src, edge.dst, component.node(edge.src).rankSpan));
            });
            rankGraph.rank();

            _.forEach(component.nodes(), node => {
                node.rank = rankGraph.node(node.id).rank;
            });

            if (this._options['alignInAndOut']) {
                _.forEach(component.sources, (source: LayoutNode) => {
                    if (source.isAccessNode) {
                        source.rank = component.minRank();
                    }
                });
                _.forEach(component.sinks(), (sink: LayoutNode) => {
                    if (sink.isAccessNode) {
                        sink.rank = component.maxRank();
                    }
                });
            }
            graph.maxRank = Math.max(graph.maxRank, component.maxRank());
        });
    }

    private _addVirtualNodes(graph: LayoutGraph, component: LayoutComponent = null) {
        // place intermediate nodes between long edges
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            if (edge.isReplica) {
                return;
            }
            let srcNode = edge.graph.node(edge.src);
            let dstNode = edge.graph.node(edge.dst);
            if (srcNode.rank + srcNode.rankSpan < dstNode.rank) {
                let tmpSrcId = srcNode.id;
                let tmpDstId;
                const dstConnector = edge.dstConnector;
                let bundle = ((edge.srcBundle !== null) && (edge.srcBundle.edges.length > 1));
                for (let tmpDstRank = srcNode.rank + srcNode.rankSpan; tmpDstRank < dstNode.rank; ++tmpDstRank) {
                    const newNode = new LayoutNode({width: 0, height: 0}, 0, !bundle, bundle);
                    bundle = ((edge.dstBundle !== null) && (edge.dstBundle.edges.length > 1) && (tmpDstRank === dstNode.rank - 2));
                    newNode.rank = tmpDstRank;
                    newNode.setLabel("virtual node on edge from " + srcNode.label() + " to " + dstNode.label());
                    tmpDstId = edge.graph.addNode(newNode, null, component !== null);
                    if (component !== null) {
                        component.addNode(newNode.id);
                    }
                    if (tmpDstRank === srcNode.rank + srcNode.rankSpan) {
                        // original edge is redirected from source to first virtual node
                        edge.graph.removeEdge(edge.id, component !== null);
                        edge.dst = tmpDstId;
                        edge.dstConnector = null;
                        edge.graph.addEdge(edge, edge.id, component !== null);
                        // add bundle edges
                        if (edge.srcBundle !== null && edge.srcBundle.edges.length > 1) {
                            _.forEach(edge.srcBundle.edges, (bundleEdge: LayoutEdge) => {
                                if (bundleEdge.isReplica) {
                                    bundleEdge.graph.removeEdge(bundleEdge.id, component !== null);
                                    bundleEdge.dst = tmpDstId;
                                    bundleEdge.graph.addEdge(bundleEdge, bundleEdge.id, component !== null);
                                }
                            });
                        }
                    } else {
                        const tmpEdge = new LayoutEdge(tmpSrcId, tmpDstId);
                        if (!bundle) {
                            tmpEdge.weight = Number.POSITIVE_INFINITY;
                        }
                        tmpEdge.isInverted = edge.isInverted;
                        edge.graph.addEdge(tmpEdge, null, component !== null);
                        if (component !== null) {
                            component.addEdge(tmpEdge.id);
                        }
                    }
                    tmpSrcId = tmpDstId;
                }
                // last virtual edge has the original dstConnector
                const tmpEdge = new LayoutEdge(tmpSrcId, dstNode.id, null, dstConnector);
                tmpEdge.isInverted = edge.isInverted;
                edge.graph.addEdge(tmpEdge, null, component !== null);
                if (component !== null) {
                    component.addEdge(tmpEdge.id);
                }
                // add bundle edges
                if ((edge.dstBundle !== null) && (edge.dstBundle.edges.length > 1)) {
                    _.forEach(edge.dstBundle.edges, (bundleEdge: LayoutEdge) => {
                        if (bundleEdge.isReplica) {
                            bundleEdge.graph.removeEdge(bundleEdge.id, component !== null);
                            bundleEdge.src = tmpSrcId;
                            bundleEdge.graph.addEdge(bundleEdge, bundleEdge.id, component !== null);
                        }
                    });
                }
            }
        });

        // add a virtual node in every empty child graph
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.nodes().length === 0) {
                const newNode = new LayoutNode({width: 0, height: 0}, 0, true);
                newNode.rank = subgraph.minRank;
                newNode.setLabel("placeholder inside parent " + (subgraph.parentNode !== null ? subgraph.parentNode.label() : ""));
                subgraph.addNode(newNode);
            }
        });
    }

    private _orderRanks(graph: LayoutGraph) {

        /**
         * STEP 1: ORDER NODES
         * This is done strictly hierarchically.
         * Child graphs are represented as a chain over multiple ranks in their parent.
         */

        const nodeMap: Map<number, number> = new Map(); // map from level node to corresponding order node

        // child graphs are visited before their parents
        _.forEachRight(graph.allGraphs(), (subgraph: LayoutGraph) => {
            _.forEach(subgraph.components(), (component: LayoutComponent, c: number) => {
                this._addVirtualNodes(subgraph, component);
                const levelGraph = component.levelGraph();

                // init graph and ranks
                const orderGraph = new OrderGraph();
                const orderGroups = new Array(component.maxRank() + 1);
                for (let r = component.minRank(); r <= component.maxRank(); ++r) {
                    const orderRank = new OrderRank();
                    orderGraph.addRank(orderRank);
                    orderGroups[r] = new OrderGroup(null);
                    orderRank.addGroup(orderGroups[r]);
                }

                // add nodes
                _.forEach(levelGraph.nodes(), (levelNode: LevelNode) => {
                    const orderNode = new OrderNode(levelNode, levelNode.layoutNode.isVirtual, levelNode.label());
                    orderGroups[levelNode.rank].addNode(orderNode, levelNode.id);
                    nodeMap.set(levelNode.id, orderNode.id);
                });

                // add normal edges between nodes; for each pair of nodes, sum up the weights of edges in-between
                _.forEach(levelGraph.edges(), (edge: Edge<any, any>) => {
                    orderGraph.addEdge(new Edge(edge.src, edge.dst, edge.weight));
                });

                Assert.assertAll(subgraph.edges(), edge => {
                    const srcNode = edge.graph.node(edge.src)
                    return edge.isReplica || (srcNode.rank + srcNode.rankSpan === edge.graph.node(edge.dst).rank);
                }, "edge not between neighboring ranks");

                // do order
                let debug = false;
                // commented out: debug one subgraph
                /*if (subgraph.parentNode !== null && subgraph.parentNode.label() === "slice___tmp0_125") {
                    debug = true;
                }*/
                orderGraph.order(false, {"shuffles": this._options["shuffles"], "resolveY": this._options["resolveY"], "debug": debug});//subgraph.nodes().length === 851);

                // copy node order into layout graph
                const newOrderNodes: Set<OrderNode> = new Set();
                const unfoundLevelNodes: Set<LevelNode> = new Set();
                _.forEach(levelGraph.nodes(), (node: LevelNode) => {
                    unfoundLevelNodes.add(node);
                });
                _.forEach(orderGraph.nodes(), (orderNode: OrderNode) => {
                    Assert.assertNumber(orderNode.position, "position of node " + orderNode.label() + " is not a valid number");
                    let levelNode: LevelNode = orderNode.reference;
                    if (levelNode === null) {
                        // virtual node was created by orderGraph.order() => add this node to layout graph
                        const newLayoutNode = new LayoutNode({width: 0, height: 0}, 0, true);
                        newLayoutNode.setLabel(orderNode.label());
                        newLayoutNode.rank = orderNode.rank;
                        const newNodeId = subgraph.addNode(newLayoutNode, null, true);
                        component.addNode(newNodeId);
                        newOrderNodes.add(orderNode);
                        levelNode = levelGraph.addLayoutNode(newLayoutNode);
                        orderNode.reference = levelNode;
                    } else {
                        unfoundLevelNodes.delete(levelNode);
                        if (levelNode.isFirst) {
                            levelNode.layoutNode.rank = levelNode.layoutNode.rank + orderNode.rank - orderNode.initialRank;
                        }
                    }
                    levelNode.rank = orderNode.rank;
                    subgraph.maxRank = Math.max(subgraph.maxRank, levelNode.rank);
                    levelNode.position = orderNode.position;
                    Assert.assert(levelNode.position !== null, "position is null");
                });
                if (subgraph.parentNode !== null) {
                    const prevRankSpan = subgraph.parentNode.rankSpan;
                    const newRankSpan = subgraph.maxRank - subgraph.minRank + 1;
                    const diff = newRankSpan - prevRankSpan;
                    if (diff !== 0) {
                        subgraph.parentNode.rankSpan = newRankSpan;
                        _.forEach(subgraph.parentNode.graph.bfs(subgraph.parentNode.id), (node: LayoutNode) => {
                            if (node !== subgraph.parentNode) {
                                if (diff > 0) {
                                    node.offsetRank(diff);
                                }
                            }
                        });
                        subgraph.parentNode.graph.maxRank = Math.max(subgraph.parentNode.graph.maxRank, subgraph.parentNode.rank + subgraph.parentNode.rankSpan - 1);
                    }
                }
                // remove from layout graph nodes that were removed in order graph
                unfoundLevelNodes.forEach((levelNode: LevelNode) => {
                    Assert.assert(levelNode.layoutNode.isVirtual, "non-virtual node removed from order graph");
                    Assert.assert(subgraph.inEdges(levelNode.layoutNode.id).length === 1, "virtual node has not exactly one in-edge");
                    Assert.assert(subgraph.outEdges(levelNode.layoutNode.id).length === 1, "virtual node has not exactly one out-edge");
                    _.forEach(levelGraph.inEdges(levelNode.id), inEdge => {
                        levelGraph.removeEdge(inEdge.id);
                    });
                    _.forEach(levelGraph.outEdges(levelNode.id), outEdge => {
                        levelGraph.removeEdge(outEdge.id);
                    });
                    // reroute layout edge directly from parent to child
                    const inEdge = subgraph.inEdges(levelNode.layoutNode.id)[0];
                    const outEdge = subgraph.outEdges(levelNode.layoutNode.id)[0];
                    subgraph.removeEdge(inEdge.id, true);
                    subgraph.removeEdge(outEdge.id, true);
                    inEdge.dstConnector = outEdge.dstConnector;
                    inEdge.dst = outEdge.dst;
                    subgraph.addEdge(inEdge, inEdge.id, true);
                    levelGraph.addLayoutEdge(inEdge);
                    component.removeEdge(outEdge.id);
                    component.removeNode(levelNode.layoutNode.id);
                    subgraph.removeNode(levelNode.layoutNode.id, true);
                    levelGraph.removeNode(levelNode.id);
                });

                // find for all new nodes the dominating and dominated non-new node
                const visited = _.fill(new Array(orderGraph.maxId() + 1), false);
                const newNodesPerEdge: Map<string, Array<LevelNode>> = new Map();
                newOrderNodes.forEach((orderNode: OrderNode) => {
                    if (visited[orderNode.id]) {
                        return; // start and end node already set
                    }
                    let tmpOrderNode = orderNode;
                    const nodes = [orderNode.reference];
                    while (newOrderNodes.has(tmpOrderNode) && orderGraph.inEdges(tmpOrderNode.id).length > 0) {
                        tmpOrderNode = orderGraph.node(orderGraph.inEdges(tmpOrderNode.id)[0].src);
                        if (newOrderNodes.has(tmpOrderNode)) {
                            nodes.push(tmpOrderNode.reference);
                            visited[orderNode.id] = true;
                        }
                    }
                    const startNode = tmpOrderNode;
                    _.reverse(nodes);
                    tmpOrderNode = orderNode;
                    while (newOrderNodes.has(tmpOrderNode) && orderGraph.outEdges(tmpOrderNode.id).length > 0) {
                        tmpOrderNode = orderGraph.node(orderGraph.outEdges(tmpOrderNode.id)[0].dst);
                        if (newOrderNodes.has(tmpOrderNode)) {
                            nodes.push(tmpOrderNode.reference);
                            visited[orderNode.id] = true;
                        }
                    }
                    const endNode = tmpOrderNode;
                    const key = startNode.id + "_" + endNode.id;
                    newNodesPerEdge.set(key, nodes);
                    Assert.assertAll(nodes, levelNode => levelNode.layoutNode.isVirtual, "non-virtual node in new path");
                });

                levelGraph.invalidateRanks();
                const ranks = levelGraph.ranks();

                // remove from layout graph edges that were removed in order graph
                _.forEach(levelGraph.edges(), levelEdge => {
                    const orderSrcNodeId = nodeMap.get(levelEdge.src);
                    const orderDstNodeId = nodeMap.get(levelEdge.dst);
                    if (orderGraph.edgeBetween(orderSrcNodeId, orderDstNodeId) === undefined) {
                        levelGraph.removeEdge(levelEdge.id);
                        const srcLayoutNode = levelGraph.node(levelEdge.src).layoutNode;
                        const dstLayoutNode = levelGraph.node(levelEdge.dst).layoutNode;
                        const key = orderSrcNodeId + "_" + orderDstNodeId;
                        _.forEach(subgraph.edgesBetween(srcLayoutNode.id, dstLayoutNode.id), (layoutEdge: LayoutEdge, e) => {
                            let newNodes = _.clone(newNodesPerEdge.get(key));
                            const dstConnector = layoutEdge.dstConnector;
                            Assert.assertAll(newNodes, levelNode => levelNode.layoutNode.isVirtual, "non-virtual node in new path");
                            if (e > 0) {
                                let clonedNewNodes = [];
                                // create a copy of all new nodes because each edge needs its own virtual nodes
                                _.forEach(newNodes, (levelNode: LevelNode) => {
                                    // virtual node was created by orderGraph.order() => add this node to layout graph
                                    const newLayoutNode = new LayoutNode({width: 0, height: 0}, 0, true);
                                    newLayoutNode.setLabel(levelNode.label());
                                    newLayoutNode.rank = levelNode.layoutNode.rank;
                                    subgraph.addNode(newLayoutNode, null, true);
                                    component.addNode(newLayoutNode.id);
                                    const newLevelNode = levelGraph.addLayoutNode(newLayoutNode);
                                    const rank = ranks[newLayoutNode.rank];
                                    for (let pos = levelNode.position; pos < rank.length; ++pos) {
                                        rank[pos].position++;
                                    }
                                    rank.splice(levelNode.position - 1, 0, newLevelNode);
                                    newLevelNode.position = levelNode.position - 1;
                                    clonedNewNodes.push(newLevelNode);
                                    subgraph.maxRank = Math.max(subgraph.maxRank, newLevelNode.rank);
                                });
                                newNodes = clonedNewNodes;
                            }
                            newNodes.push(orderGraph.node(orderDstNodeId).reference);
                            subgraph.removeEdge(layoutEdge.id, true);
                            layoutEdge.dst = newNodes[0].layoutNode.id;
                            layoutEdge.dstConnector = null;
                            subgraph.addEdge(layoutEdge, layoutEdge.id, true);
                            levelGraph.addLayoutEdge(layoutEdge);
                            for (let n = 1; n < newNodes.length; ++n) {
                                const tmpSrcLayoutNodeId = newNodes[n - 1].layoutNode.id;
                                const tmpDstLayoutNodeId = newNodes[n].layoutNode.id;
                                const tmpDstConnector = ((n === newNodes.length - 1) ? dstConnector : null);
                                const newLayoutEdge = new LayoutEdge(tmpSrcLayoutNodeId, tmpDstLayoutNodeId, null, tmpDstConnector);
                                subgraph.addEdge(newLayoutEdge, null, true);
                                component.addEdge(newLayoutEdge.id);
                                levelGraph.addLayoutEdge(newLayoutEdge);
                            }
                        });
                    }
                });

                levelGraph.invalidateRanks();

                Assert.assert(subgraph.components()[c] === component, "component has changed");
            });
        });

        Assert.assertAll(graph.allEdges(), edge => {
            const srcNode = edge.graph.node(edge.src)
            return edge.isReplica || (srcNode.rank + srcNode.rankSpan === edge.graph.node(edge.dst).rank);
        }, "edge not between neighboring ranks");

        // transform relative ranks to absolute
        const makeRanksAbsolute = (subgraph: LayoutGraph, offset: number) => {
            subgraph.minRank += offset;
            subgraph.maxRank += offset;
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    makeRanksAbsolute(node.childGraph, offset + node.rank);
                }
                node.rank += offset;
            });
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                _.forEach(component.levelGraph().nodes(), (node: LevelNode) => {
                    node.rank += offset;
                });
            });
        };
        makeRanksAbsolute(graph, 0);

        /**
         * STEP 2: ORDER CONNECTORS
         * In this step, scope insides and outsides are handled in the same order graph.
         * If there are nested scopes, they are flattened.
         */

        const orderGraph = new OrderGraph;
        const orderRanks = [];
        for (let r = 0; r <= graph.maxRank; ++r) {
            orderRanks[r] = new OrderRank();
            orderGraph.addRank(orderRanks[r]);
        }

        const connectorMap = new Map();
        const generalInMap = new Map(); // invisible in-connectors
        const generalOutMap = new Map(); // invisible out-connectors
        const generalBottomInMap = new Map(); // invisible in-connectors at the bottom of states
        const generalTopOutMap = new Map(); // invisible in-connectors at the bottom of states

        // add nodes
        const addConnectorsForSubgraph = (subgraph: LayoutGraph, indizes: Array<number>) => {
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                // visit child graphs first
                let indizesPerLayoutNode = new Map();
                _.forEach(component.levelGraph().ranks(), (rank: Array<LevelNode>) => {
                    _.forEach(rank, (levelNode: LevelNode) => {
                        if (levelNode.layoutNode.childGraph !== null && levelNode.layoutNode.childGraph.entryNode !== null) {
                            let indizes = indizesPerLayoutNode.get(levelNode.layoutNode);
                            if (indizes === undefined) {
                                indizes = [];
                                indizesPerLayoutNode.set(levelNode.layoutNode, indizes);
                            }
                            indizes.push(levelNode.position);
                        }
                    });
                });
                _.forEach(component.nodes(), (layoutNode: LayoutNode) => {
                    if (layoutNode.childGraph !== null) {
                        addConnectorsForSubgraph(layoutNode.childGraph, indizesPerLayoutNode.get(layoutNode) || null);
                    }
                });

                _.forEach(component.levelGraph().ranks(), (rank: Array<LevelNode>, r) => {
                    let index = 0;
                    _.forEach(rank, (levelNode: LevelNode) => {
                        const node = levelNode.layoutNode;
                        if (node.childGraph !== null && node.childGraph.entryNode !== null) {
                            index += node.childGraph.maxIndex() + 1;
                            return; // do not add connectors for scope nodes
                        }
                        let connectorGroup;
                        if (node.childGraph === null || component.minRank() + r === node.rank) {
                            // add input connectors
                            connectorGroup = new OrderGroup(node, node.label());
                            connectorGroup.position = index;
                            if (indizes !== null) {
                                connectorGroup.position += indizes[r];
                            }
                            orderRanks[node.rank].addGroup(connectorGroup);
                            _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                                const connectorNode = new OrderNode(connector, false, connector.name);
                                connectorGroup.addNode(connectorNode);
                                connectorMap.set(connector, connectorNode.id);
                                if (connector.isScoped) {
                                    connectorMap.set(connector.counterpart, connectorNode.id);
                                }
                            });
                            if (node.inConnectors.length === 0) {
                                const inNode = new OrderNode(null, false, "generalInConnector");
                                connectorGroup.addNode(inNode);
                                generalInMap.set(node, inNode.id);
                                // add invisible out-connector at top of state-node (if necessary)
                                if (subgraph.mayHaveCycles && _.some(subgraph.inEdges(node.id), "isInverted")) {
                                    const topOutNode = new OrderNode("topOut", false, "generalTopOutConnector");
                                    connectorGroup.addNode(topOutNode);
                                    generalTopOutMap.set(node, topOutNode.id);
                                }
                            }
                        }
                        if (node.childGraph === null || component.minRank() + r === node.rank + node.rankSpan - 1) {
                            Assert.assertImplies(node.rankSpan > 1, !node.hasScopedConnectors, "multirank node with scoped connectors");
                            if (!node.hasScopedConnectors) {
                                // keep in- and out-connectors separated from each other if they are not scoped
                                connectorGroup = new OrderGroup(node, node.label());
                                orderRanks[node.rank + node.rankSpan - 1].addGroup(connectorGroup);
                                connectorGroup.position = index;
                                if (indizes !== null) {
                                    connectorGroup.position += indizes[r];
                                }
                            }

                            // add output connectors
                            _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                                if (!connector.isScoped) {
                                    const connectorNode = new OrderNode(connector, false, connector.name);
                                    connectorGroup.addNode(connectorNode);
                                    connectorMap.set(connector, connectorNode.id);
                                }
                            });
                            if (node.outConnectors.length === 0) {
                                const outNode = new OrderNode(null, false, "generalOutConnector");
                                connectorGroup.addNode(outNode);
                                generalOutMap.set(node, outNode.id);
                                // add invisible in-connector at bottom of state-node (if necessary)
                                if (subgraph.mayHaveCycles && _.some(subgraph.outEdges(node.id), "isInverted")) {
                                    const bottomInNode = new OrderNode("bottomIn", false, "generalBottomInConnector");
                                    connectorGroup.addNode(bottomInNode);
                                    generalBottomInMap.set(node, bottomInNode.id);
                                }
                            }
                        }
                        index++;
                    });
                });
            });
        };
        addConnectorsForSubgraph(graph, null);
        // add connector edges
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            let srcNode = edge.graph.node(edge.src);
            if (srcNode.childGraph !== null && srcNode.childGraph.exitNode !== null) {
                srcNode = srcNode.childGraph.exitNode;
            }
            let dstNode = edge.graph.node(edge.dst);
            if (dstNode.childGraph !== null && dstNode.childGraph.entryNode !== null) {
                dstNode = dstNode.childGraph.entryNode;
            }
            let srcOrderNodeId;
            if (edge.srcConnector !== null) {
                srcOrderNodeId = connectorMap.get(srcNode.connector("OUT", edge.srcConnector));
            } else {
                if (edge.isInverted) {
                    srcOrderNodeId = generalBottomInMap.get(srcNode);
                } else {
                    srcOrderNodeId = generalOutMap.get(srcNode);
                }
            }
            let dstOrderNodeId;
            if (edge.dstConnector !== null) {
                dstOrderNodeId = connectorMap.get(dstNode.connector("IN", edge.dstConnector));
            } else {
                if (edge.isInverted) {
                    dstOrderNodeId = generalTopOutMap.get(dstNode);
                } else {
                    dstOrderNodeId = generalInMap.get(dstNode);
                }
            }
            orderGraph.addEdge(new Edge(srcOrderNodeId, dstOrderNodeId, 1));
        });

        // order connectors
        orderGraph.order(true, this._options["shuffles"]);

        // copy order information from order graph to layout graph
        _.forEach(orderGraph.groups(), (orderGroup: OrderGroup) => {
            Assert.assertNumber(orderGroup.position, "position is not a valid number");
            const layoutNode: LayoutNode = orderGroup.reference;
            if (layoutNode !== null) {
                const connectors = {"IN": [], "OUT": []};
                _.forEach(orderGroup.orderedNodes(), (orderNode: OrderNode) => {
                    if (orderNode.reference !== null) {
                        if (orderNode.reference === "bottomIn") {
                            layoutNode.bottomInConnectorIndex = orderNode.position;
                        } else if (orderNode.reference === "topOut") {
                            layoutNode.topOutConnectorIndex = orderNode.position;
                        } else {
                            const connector = orderNode.reference;
                            connectors[connector.type].push(connector);
                            if (connector.isScoped) {
                                connectors["OUT"].push(connector.counterpart);
                            }
                        }
                    }
                });
                if (connectors["IN"].length > 0 || connectors["OUT"].length > 0) {
                   if (connectors["IN"].length > 0 && layoutNode.inConnectorBundles.length > 0) {
                        this._bundleConnectors(connectors["IN"], connectors["OUT"], layoutNode.inConnectorBundles);
                    }
                    if (connectors["OUT"].length > 0 && layoutNode.outConnectorBundles.length > 0) {
                        this._bundleConnectors(connectors["OUT"], connectors["IN"], layoutNode.outConnectorBundles);
                    }
                    if (connectors["IN"].length > 0) {
                        layoutNode.inConnectors = connectors["IN"];
                        Assert.assertAll(layoutNode.inConnectors, connector => connector !== undefined, "undefined inconnector");
                    }
                    if (connectors["OUT"].length > 0) {
                        layoutNode.outConnectors = connectors["OUT"];
                        Assert.assertAll(layoutNode.outConnectors, connector => connector !== undefined, "undefined outconnector");
                    }
                }
            }
        });
    }

    private _bundleConnectors(connectors: Array<LayoutConnector>, counterPartConnectors: Array<LayoutConnector>, bundles: Array<LayoutBundle>) {
        // order bundles by the mean of their connectors positions
        // within a bundle, the connectors do not change their relative position
        let connectorByName = new Map();
        let indexByConnector = new Map();
        _.forEach(connectors, (connector: LayoutConnector, pos: number) => {
            connectorByName.set(connector.name, connector);
            indexByConnector.set(connector.name, pos);
        });
        let bundleMeans = [];
        _.forEach(bundles, (bundle: LayoutBundle) => {
            bundle.connectors = _.sortBy(bundle.connectors, (name: string) => indexByConnector.get(name));
            bundleMeans.push([bundle, _.mean(_.map(bundle.connectors, (name: string) => indexByConnector.get(name)))]);
        });
        connectors.length = 0;
        _.forEach(_.sortBy(bundleMeans, "1"), ([bundle, mean]) => {
            _.forEach(bundle.connectors, (name: string) => {
                const connector = connectorByName.get(name);
                connectors.push(connector);
            });
        });

        // reflect unbroken sequences of scoped connectors on other side
        const scopeGroups = [];
        let group = [];
        _.forEach(connectors, (connector: LayoutConnector, pos: number) => {
            if (connector.isScoped) {
                group.push(connector);
            }
            if ((pos === connectors.length - 1) || !connectors[pos + 1].isScoped) {
                scopeGroups.push(group);
                group = [];
            }
        });
        const counterMeans = [];
        let scopeCount = 0;
        let scopeSum = 0;
        let scopeGroupPointer = 0;
        _.forEach(counterPartConnectors, (connector: LayoutConnector, pos: number) => {
            if (connector.isScoped) {
                scopeSum += pos;
                if (++scopeCount === scopeGroups[scopeGroupPointer].length) {
                    counterMeans.push([_.map(scopeGroups[scopeGroupPointer++], "counterpart"), pos / scopeCount]);
                    scopeCount = 0;
                    scopeSum = 0;
                }
            } else {
                counterMeans.push([[connector], pos]);
            }
        });
        counterPartConnectors.length = 0;
        _.forEach(_.sortBy(counterMeans, "1"), ([connectors, mean]) => {
            _.forEach(connectors, (connector: LayoutConnector) => {
                counterPartConnectors.push(connector);
            });
        });
    }

    /**
     * Assigns coordinates to the nodes, the connectors and the edges.
     * @param graph
     * @param offsetX
     * @param offsetY
     * @private
     */
    private _assignCoordinates(graph: LayoutGraph, offsetX: number = 0, offsetY: number = 0) {
        // assign y
        const rankTops = _.fill(new Array(graph.maxRank + 2), Number.POSITIVE_INFINITY);
        const rankBottoms = _.fill(new Array(graph.maxRank + 1), Number.NEGATIVE_INFINITY);

        const globalRanks = graph.globalRanks();

        rankTops[0] = 0;
        for (let r = 0; r < globalRanks.length; ++r) {
            this._crossingsPerRank[r] = [];
            this._segmentsPerRank[r] = [];
            let maxBottom = 0;
            _.forEach(globalRanks[r], (node: LayoutNode) => {
                node.y = rankTops[r];
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.childGraph.minRank === node.rank) {
                        node.y += parent.padding;
                    }
                });
                let height = node.height;
                if (node.inConnectors.length > 0) {
                    node.y += CONNECTOR_SIZE / 2;
                }
                if (node.outConnectors.length > 0) {
                    height += CONNECTOR_SIZE / 2;
                }
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.childGraph.maxRank === node.rank) {
                        height += parent.padding;
                        if (parent.outConnectors.length > 0) {
                            height += CONNECTOR_SIZE / 2;
                        }
                    }
                });
                maxBottom = Math.max(maxBottom, node.y + height);
            });
            rankBottoms[r] = maxBottom;
            rankTops[r + 1] = maxBottom + this._options["targetEdgeLength"];
        }

        // assign x and set size; assign edge and connector coordinates

        const placeSubgraph = (subgraph: LayoutGraph, offset: number) => {
            // place all subgraphs in order to know their size
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    placeSubgraph(node.childGraph, node.padding);
                }
            });

            // assign x
            let x = offset;
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                this._assignX(component, x);
                x += component.boundingBox().width + this._options["targetEdgeLength"];
            });

            // place self-loops
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.selfLoop !== null) {
                    node.selfLoop.points = [
                        new Vector(node.x + node.width + node.padding - this._options["targetEdgeLength"], node.y + node.height - 10),
                        new Vector(node.x + node.width + node.padding , node.y + node.height - 10),
                        new Vector(node.x + node.width + node.padding , node.y + 10),
                        new Vector(node.x + node.width + node.padding - this._options["targetEdgeLength"], node.y + 10),
                    ];
                }
            });

            // set parent bounding box
            if (subgraph.parentNode !== null) {
                const boundingBox = subgraph.boundingBox(false);
                if (subgraph.parentNode.outConnectors.length > 0) {
                    boundingBox.height -= CONNECTOR_SIZE / 2;
                }
                subgraph.parentNode.updateSize({width: boundingBox.width + 2 * subgraph.parentNode.padding, height: boundingBox.height + 2 * subgraph.parentNode.padding});
                if (subgraph.parentNode.selfLoop !== null) {
                    subgraph.parentNode.updateSize({width: subgraph.parentNode.width + this._options["targetEdgeLength"], height: 0});
                }
                Assert.assert(subgraph.parentNode.width >= 0 && subgraph.parentNode.height >= 0, "node has invalid size", subgraph.parentNode);
                if (subgraph.entryNode !== null) {
                    const left = boundingBox.x;
                    subgraph.entryNode.setWidth(boundingBox.width);
                    subgraph.entryNode.setPosition(new Vector(left, subgraph.entryNode.y));
                    subgraph.exitNode.setWidth(boundingBox.width);
                    subgraph.exitNode.setPosition(new Vector(left, subgraph.exitNode.y));
                }
            }

            // place connectors
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                this._placeConnectors(node, rankTops, rankBottoms);
            });

            /**
             * PLACE EDGES
             * (self-loops handled above)
             */

            const getInPoint = (node: LayoutNode, edge: LayoutEdge): Vector => {
                let inPoint = node.boundingBox().topCenter();
                if (edge.dstConnector !== null) {
                    let dstConnector = node.connector("IN", edge.dstConnector);
                    if (dstConnector !== undefined) {
                        inPoint = dstConnector.boundingBox().topCenter();
                    }
                } else if (node.topOutConnectorIndex !== null) {
                    if (edge.isInverted) {
                        inPoint.x += (node.topOutConnectorIndex - 0.5) * 2 * this._options["connectorSpacing"];
                    } else {
                        inPoint.x += (0.5 - node.topOutConnectorIndex) * 2 * this._options["connectorSpacing"];
                    }
                }
                inPoint.y = rankTops[node.rank];
                return inPoint;
            };

            const getInProxyPoint = (node: LayoutNode, inPoint: Vector): Vector => {
                const proxyPoint = inPoint.clone();
                proxyPoint.y = rankTops[node.rank];
                return proxyPoint;
            };

            const getOutPoint = (node: LayoutNode, edge: LayoutEdge): Vector => {
                let outPoint = node.boundingBox().bottomCenter();
                if (edge.srcConnector !== null) {
                    let srcConnector = node.connector("OUT", edge.srcConnector);
                    if (srcConnector !== undefined) {
                        outPoint = srcConnector.boundingBox().bottomCenter();
                    }
                } else if (node.bottomInConnectorIndex !== null) {
                    if (edge.isInverted) {
                        outPoint.x += (node.bottomInConnectorIndex - 0.5) * 2 * this._options["connectorSpacing"];
                    } else {
                        outPoint.x += (0.5 - node.bottomInConnectorIndex) * 2 * this._options["connectorSpacing"];
                    }
                }
                return outPoint;
            };

            const getOutProxyPoint = (node: LayoutNode, outPoint: Vector): Vector => {
                const proxyPoint = outPoint.clone();
                proxyPoint.y = rankBottoms[node.rank + node.rankSpan - 1];
                return proxyPoint;
            };

            // mark nodes that do not need proxies
            const noInProxyNodes = new Set();
            const noOutProxyNodes = new Set();
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                _.forEach(component.levelGraph().ranks(), (rank: Array<LevelNode>, r: number) => {
                    _.forEach(rank, (levelNode: LevelNode, pos) => {
                        const node = levelNode.layoutNode;

                        let leftBoundary = Number.NEGATIVE_INFINITY;
                        if (pos > 0) {
                            leftBoundary = rank[pos - 1].layoutNode.boundingBox().right();
                        }
                        let rightBoundary = Number.POSITIVE_INFINITY;
                        if (pos < rank.length - 1) {
                            rightBoundary = rank[pos + 1].layoutNode.boundingBox().left();
                        }

                        if (!node.isVirtual && node.graph.inEdges(node.id).length > 0 && node.inConnectorBundles.length === 0) {
                            let minPos = Number.POSITIVE_INFINITY;
                            let maxPos = Number.NEGATIVE_INFINITY
                            _.forEach(node.graph.inEdges(node.id), (edge: LayoutEdge) => {
                                const dstPoint = getInPoint(node, edge);
                                const dstProxyPoint = getInProxyPoint(node, dstPoint);
                                if (_.isEqual(dstPoint, dstProxyPoint)) {
                                    return;
                                }
                                const srcPoint = getOutPoint(node.graph.node(edge.src), edge);
                                const intersection = dstPoint.clone().sub(dstPoint.clone().sub(srcPoint).setY(dstPoint.y - dstProxyPoint.y));
                                minPos = Math.min(minPos, intersection.x);
                                maxPos = Math.max(maxPos, intersection.x);
                            });
                            if (minPos > leftBoundary && maxPos < rightBoundary) {
                                noInProxyNodes.add(node);
                            }
                        }
                        if (!node.isVirtual && node.graph.outEdges(node.id).length > 0 && node.outConnectorBundles.length === 0) {
                            let minPos = Number.POSITIVE_INFINITY;
                            let maxPos = Number.NEGATIVE_INFINITY
                            _.forEach(node.graph.outEdges(node.id), (edge: LayoutEdge) => {
                                const srcPoint = getOutPoint(node, edge);
                                const srcProxyPoint = getOutProxyPoint(node, srcPoint);
                                if (_.isEqual(srcPoint, srcProxyPoint)) {
                                    return;
                                }
                                const dstPoint = getInPoint(node.graph.node(edge.dst), edge);
                                const intersection = srcPoint.clone().add(dstPoint.clone().sub(srcPoint).setY(srcProxyPoint.y - srcPoint.y));
                                minPos = Math.min(minPos, intersection.x);
                                maxPos = Math.max(maxPos, intersection.x);
                            });
                            if (minPos > leftBoundary && maxPos < rightBoundary) {
                                noOutProxyNodes.add(node);
                            }
                        }
                    });
                });
            });

            _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                if (edge.isReplica) {
                    return; // replica edges are added with their primary
                }
                let startNode = subgraph.node(edge.src);
                if (startNode.isVirtual) {
                    return; // do not assign points to this edge
                }
                if (startNode.childGraph !== null && startNode.childGraph.exitNode !== null) {
                    startNode = startNode.childGraph.exitNode;
                }

                const startPoint = getOutPoint(startNode, edge);
                const startProxyPoint = (edge.srcBundle !== null ? edge.srcBundle.position() : getOutProxyPoint(startNode, startPoint));
                edge.points = [startPoint];
                if (!_.isEqual(startPoint, startProxyPoint) && !noOutProxyNodes.has(startNode)) {
                    edge.points.push(startProxyPoint);
                }

                let nextNode = subgraph.node(edge.dst);
                let tmpEdge = null;
                while (nextNode.isVirtual || nextNode.isBundle) {
                    const nextPoint = getInPoint(nextNode, edge);
                    const nextInProxyPoint = getInProxyPoint(nextNode, nextPoint);
                    const nextOutProxyPoint = getOutProxyPoint(nextNode, nextPoint);
                    if (!_.isEqual(nextInProxyPoint, nextPoint)) {
                        edge.points.push(nextInProxyPoint);
                    }
                    edge.points.push(nextPoint);
                    if (!_.isEqual(nextOutProxyPoint, nextPoint)) {
                        edge.points.push(nextOutProxyPoint);
                    }
                    tmpEdge = subgraph.outEdges(nextNode.id)[0];
                    nextNode = subgraph.node(tmpEdge.dst);
                }
                let endNode = nextNode;
                if (endNode.childGraph !== null && endNode.childGraph.entryNode !== null) {
                    endNode = endNode.childGraph.entryNode;
                }
                if (tmpEdge !== null) {
                    edge.dstConnector = tmpEdge.dstConnector;
                }
                const endPoint = getInPoint(endNode, edge);
                const endProxyPoint = (edge.dstBundle !== null ? edge.dstBundle.position() : getInProxyPoint(endNode, endPoint));
                if (!_.isEqual(endProxyPoint, endPoint) && !noInProxyNodes.has(endPoint)) {
                    edge.points.push(endProxyPoint);
                }
                edge.points.push(endPoint);

                // redirect edge from start to end
                if (tmpEdge !== null) {
                    edge.graph.removeEdge(edge.id);
                    edge.dst = tmpEdge.dst;
                    edge.graph.addEdge(edge, edge.id);
                }

                // place replicas
                if (edge.srcBundle !== null) {
                    _.forEach(edge.srcBundle.edges, (bundleEdge: LayoutEdge) => {
                        if (bundleEdge.isReplica) {
                            bundleEdge.points = _.cloneDeep(edge.points);
                            bundleEdge.points[0] = getOutPoint(startNode, bundleEdge);
                        }
                    });
                }
                if (edge.dstBundle !== null) {
                    _.forEach(edge.dstBundle.edges, (bundleEdge: LayoutEdge) => {
                        if (bundleEdge.isReplica) {
                            bundleEdge.points = _.cloneDeep(edge.points);
                            bundleEdge.points[bundleEdge.points.length - 1] = getInPoint(endNode, bundleEdge);
                        }
                    });
                }
            });

            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                // remove virtual nodes and edges
                if (node.isVirtual) {
                    Assert.assert(subgraph.inEdges(node.id).length <= 1, "virtual node has more than 1 in-edge", node, subgraph.inEdges(node.id));
                    Assert.assert(subgraph.outEdges(node.id).length <= 1, "virtual node has more than 1 out-edge", node, subgraph.outEdges(node.id));
                    _.forEach(subgraph.inEdges(node.id), (inEdge) => {
                        subgraph.removeEdge(inEdge.id);
                    });
                    _.forEach(subgraph.outEdges(node.id), (outEdge) => {
                        subgraph.removeEdge(outEdge.id);
                    });
                    subgraph.removeNode(node.id);
                }

                // place self-loops visually outside their state
                if (node.selfLoop !== null) {
                    node.setWidth(node.width - this._options["targetEdgeLength"]);
                }

            });

            // mark crossings for later maximization angles
            if (this._options['maximizeAngles']) {
                this._markCrossings(subgraph, rankTops, rankBottoms);
            }
        };
        placeSubgraph(graph, 0);
    }

    private _assignX(component: LayoutComponent, offset = 0) {
        /*const levelGraph = component.levelGraph();
        const ranks = levelGraph.ranks();

        // create dependency graph from left to right
        const depGraph = new Graph<any, any>();
        for (let r = 0; r < ranks.length; ++r) {
            for (let i = 0; i < ranks[r].length; ++i) {
                if (depGraph.node(ranks[r][i].layoutNode.id) === undefined) {
                    depGraph.addNode(new Node(), ranks[r][i].id);
                }
            }
            for (let i = 1; i < ranks[r].length; ++i) {
                depGraph.addEdge(new Edge(ranks[r][i - 1].id, ranks[r][i].id));
            }
        }
        Assert.assert(!depGraph.hasCycle(), "dependency graph has cycle");

        // assign minimum x to all nodes based on their left neighbor(s)
        _.forEach(depGraph.toposort(), (depNode: Node<any, any>) => {
            const levelNode = levelGraph.node(depNode.id);
            const layoutNode = levelNode.layoutNode;
            let left = offset - this._options["targetEdgeLength"];
            _.forEach(depGraph.inEdges(depNode.id), (inEdge: Edge<any, any>) => {
                const leftNode = levelGraph.node(inEdge.src);
                Assert.assertNumber(leftNode.x, "invalid x for left node");
                left = Math.max(left, leftNode.x + leftNode.width);
            });

            levelNode.x = left + this._options["targetEdgeLength"];
            layoutNode.x = levelNode.x;
        });*/
        const alignGraphs = [
            component.levelGraph().clone(),
            component.levelGraph().clone(),
            component.levelGraph().clone(),
            component.levelGraph().clone(),
        ];

        this._alignMedian(alignGraphs[0], "UP", "LEFT");
        this._alignMedian(alignGraphs[1], "UP", "RIGHT");
        this._alignMedian(alignGraphs[2], "DOWN", "LEFT");
        this._alignMedian(alignGraphs[3], "DOWN", "RIGHT");

        // align left-most and right-most nodes
        let minMaxX = Number.POSITIVE_INFINITY;
        _.forEach(alignGraphs, (alignGraph: LevelGraph) => {
            minMaxX = Math.min(minMaxX, alignGraph.maxX());
        });
        _.forEach([1, 3], (i: number) => {
            const alignGraph = alignGraphs[i];
            const maxX = alignGraph.maxX();
            if (maxX === minMaxX) {
                return; // no need to adjust this graph
            }
            const diff = minMaxX - maxX;
            _.forEach(alignGraph.nodes(), (node: LevelNode) => {
                node.x += diff;
            });
        });

        let minX = Number.POSITIVE_INFINITY;
        _.forEach(component.levelGraph().nodes(), (node: LevelNode) => {
            let xs = _.sortBy(_.map(alignGraphs, alignGraph => alignGraph.node(node.id).x));
            let x = (xs[1] + xs[2]) / 2;
            //x = alignGraphs[0].node(node.id).x;
            x -= node.layoutNode.width / 2;
            minX = Math.min(minX, x);
            node.layoutNode.setPosition(new Vector(offset + x, node.layoutNode.y));
        });
        const diff = 0 - minX;
        _.forEach(component.nodes(), (node: LayoutNode) => {
            node.translate(diff, 0);
        });
    }

    private _alignMedian(levelGraph: LevelGraph, neighbors: "UP" | "DOWN", preference: "LEFT" | "RIGHT") {
        _.forEach(levelGraph.ranks(), rank => {
            Assert.assertAll(rank, node => node.position !== null, "position is null");
        });
        const ranks = levelGraph.ranks();
        const firstRank = (neighbors === "UP" ? 1 : (ranks.length - 2));
        const lastRank = (neighbors === "UP" ? (ranks.length - 1) : 0);
        const verticalDir = (neighbors === "UP" ? 1 : -1);
        const neighborOutMethod = (neighbors === "UP" ? "outEdges" : "inEdges");
        const neighborInMethod = (neighbors === "UP" ? "inEdges" : "outEdges");
        const neighborEdgeInAttr = (neighbors === "UP" ? "dst" : "src");

        const blockPerNode = new Array(levelGraph.maxId() + 1);
        const nodesPerBlock = new Array(levelGraph.maxId() + 1);
        const blockWidths = new Array(levelGraph.maxId() + 1);
        const blockGraph = new RankGraph();
        const auxBlockGraph = new Graph();

        const r = firstRank - verticalDir;
        let blockId = 0;
        for (let n = 0; n < ranks[r].length; ++n) {
            blockGraph.addNode(new RankNode(blockId.toString()));
            auxBlockGraph.addNode(new Node(blockId.toString()), blockId);
            blockPerNode[ranks[r][n].id] = blockId;
            nodesPerBlock[blockId] = [ranks[r][n].id];
            blockWidths[blockId] = ranks[r][n].layoutNode.width;
            blockId++;
        }
        for (let n = 1; n < ranks[r].length; ++n) {
            const edgeLength = (ranks[r][n - 1].layoutNode.width + ranks[r][n].width) / 2 + this._options["targetEdgeLength"];
            blockGraph.addEdge(new Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
        }
        for (let r = firstRank; r - verticalDir !== lastRank; r += verticalDir) {
            // create sorted list of neighbors
            const neighbors: Array<Array<number>> = new Array(ranks[r].length);
            const neighborsUsable: Array<Array<boolean>> = new Array(ranks[r].length);
            _.forEach(ranks[r], (node: LevelNode, n) => {
                neighbors[n] = [];
                neighborsUsable[n] = [];
            });
            _.forEach(ranks[r - verticalDir], (neighbor: LevelNode, n) => {
                _.forEach(levelGraph[neighborOutMethod](neighbor.id), (edge: Edge<any, any>) => {
                    const node = levelGraph.node(edge[neighborEdgeInAttr]);
                    neighbors[node.position].push(n);
                });
            });

            // mark segments that cross a heavy segment as non-usable

            let heavyLeft = -1;
            let n = 0;
            for (let tmpN = 0; tmpN < ranks[r].length; ++tmpN) {
                if (tmpN === ranks[r].length - 1 || _.filter(levelGraph[neighborInMethod](ranks[r][tmpN].id), edge => edge.weight === Number.POSITIVE_INFINITY).length > 0) {
                    let heavyRight = ranks[r - verticalDir].length + 1;
                    if (_.filter(levelGraph[neighborInMethod](ranks[r][tmpN].id), edge => edge.weight === Number.POSITIVE_INFINITY).length > 0) {
                        heavyRight = neighbors[tmpN][0];
                    }
                    while (n <= tmpN) {
                        _.forEach(neighbors[n], (neighborPos: number, neighborIndex: number) => {
                            neighborsUsable[n][neighborIndex] = neighborPos >= heavyLeft && neighborPos <= heavyRight;
                        });
                        n++;
                    }
                    heavyLeft = heavyRight;
                }
            }

            // the following is all for assertion
            /*Assert.assertAll(neighbors, (nodeNeighbors, n) => neighborsUsable[n].length === nodeNeighbors.length, "neighborsUsable[n] has not the same length as neighbors[n]");
            const segments = [];
            for (let n = 0; n < ranks[r].length; ++n) {
                _.forEach(levelGraph[neighborInMethod](ranks[r][n].id), edge => {
                    const segment: [number, number, boolean] = [
                        levelGraph.node(edge[neighborEdgeOutAttr]).position,
                        n,
                        edge.weight === Number.POSITIVE_INFINITY
                    ];
                    segments.push(segment);
                    //Assert.assertImplies(segment[2], neighborsUsable[segment[1]][_.indexOf(neighbors[segment[1]], segment[0])], "heavy segment is not usable");
                });
            }
            for (let i = 0; i < segments.length; ++i) {
                for (let j = i + 1; j < segments.length; ++j) {
                    if ((segments[i][0] < segments[j][0]) !== (segments[i][1] < segments[j][1])) {
                        Assert.assert(!segments[i][2] || !segments[j][2], "heavy-heavy crossing");
                        Assert.assertImplies(segments[i][2], !neighborsUsable[segments[j][1]][_.indexOf(neighbors[segments[j][1]], segments[j][0])], "heavy-light crossing", segments[i], segments[j]);
                        Assert.assertImplies(segments[j][2], !neighborsUsable[segments[i][1]][_.indexOf(neighbors[segments[i][1]], segments[i][0])], "heavy-light crossing", segments[i], segments[j], neighbors[segments[i][1]], neighborsUsable[segments[i][1]]);
                    }
                }
            }*/

            let maxNeighborTaken = (preference === "LEFT" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
            const compare = (preference === "LEFT" ? ((a, b) => a < b) : ((a, b) => a > b));
            const nMin = (preference === "LEFT" ? 0 : ranks[r].length - 1);
            const nMax = (preference === "LEFT" ? ranks[r].length - 1 : 0);
            const horizontalDir = (preference === "LEFT" ? 1 : -1);
            for (let n = nMin; n - horizontalDir !== nMax; n += horizontalDir) {
                let neighbor = null;
                if (neighbors[n].length > 0) {
                    const leftMedian = Math.floor((neighbors[n].length - 1) / 2);
                    const rightMedian = Math.floor((neighbors[n].length) / 2);
                    const tryOrder = (preference === "LEFT" ? [leftMedian, rightMedian] : [rightMedian, leftMedian]);
                    _.forEach(tryOrder, (neighborIndex: number) => {
                        if (neighbor !== null) {
                            return; // already found
                        }
                        if (neighborsUsable[n][neighborIndex] && compare(maxNeighborTaken, neighbors[n][neighborIndex])) {
                            neighbor = ranks[r - verticalDir][neighbors[n][neighborIndex]];
                            maxNeighborTaken = neighbors[n][neighborIndex];
                        }
                    });
                }
                if (neighbor === null) {
                    blockGraph.addNode(new RankNode(blockId.toString()));
                    auxBlockGraph.addNode(new Node(blockId.toString()), blockId);
                    blockPerNode[ranks[r][n].id] = blockId;
                    nodesPerBlock[blockId] = [ranks[r][n].id];
                    blockWidths[blockId] = ranks[r][n].layoutNode.width;
                    blockId++;
                } else {
                    const blockId = blockPerNode[neighbor.id];
                    blockPerNode[ranks[r][n].id] = blockId;
                    nodesPerBlock[blockId].push(ranks[r][n].id);
                    blockWidths[blockId] = Math.max(blockWidths[blockId], ranks[r][n].layoutNode.width);
                }
            }
            for (let n = 1; n < ranks[r].length; ++n) {
                const edgeLength = (ranks[r][n - 1].layoutNode.width + ranks[r][n].layoutNode.width) / 2 + this._options["targetEdgeLength"];
                blockGraph.addEdge(new Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
            }
        }

        // compact
        blockGraph.rank();
        _.forEach(levelGraph.nodes(), (node: LevelNode) => {
            node.x = blockGraph.node(blockPerNode[node.id]).rank;
        });

        // move blocks that are only connected on the right side as far right as possible
        _.forEach(levelGraph.edges(), edge => {
            if (blockPerNode[edge.src] !== blockPerNode[edge.dst]) {
                auxBlockGraph.addEdge(new Edge(blockPerNode[edge.src], blockPerNode[edge.dst]));
            }
        });
        _.forEach(auxBlockGraph.nodes(), block => {
            const blockId = block.id;
            const nodeX = levelGraph.node(nodesPerBlock[blockId][0]).x + blockWidths[blockId] / 2;
            let hasLeftEdge = false;
            let hasRightEdge = false;
            _.forEach(auxBlockGraph.neighbors(blockId), neighbor => {
                const neighborX = levelGraph.node(nodesPerBlock[neighbor.id][0]).x - blockWidths[neighbor.id] / 2;
                if (nodeX < neighborX) {
                    hasRightEdge = true;
                } else {
                    hasLeftEdge = true;
                }
            });
            if (hasRightEdge && !hasLeftEdge) {
                // figure how much the block can be moved
                let minRightEdgeLength = Number.POSITIVE_INFINITY;
                _.forEach(blockGraph.outEdges(blockId), outEdge => {
                    const neighborX = levelGraph.node(nodesPerBlock[outEdge.dst][0]).x - blockWidths[outEdge.dst] / 2;
                    minRightEdgeLength = Math.min(minRightEdgeLength, neighborX - nodeX);
                });
                // move it
                if (minRightEdgeLength > this._options["targetEdgeLength"]) {
                    const offset = minRightEdgeLength - this._options["targetEdgeLength"];
                    _.forEach(nodesPerBlock[blockId], nodeId => {
                        levelGraph.node(nodeId).x += offset;
                    });
                }
            }
        });
    }

    private _restoreCycles(graph: LayoutGraph) {
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            if (edge.isInverted) {
                edge.graph.invertEdge(edge.id);
                edge.points = _.reverse(edge.points);
                edge.isInverted = false;
            }
        });
    }

    private _placeConnectors(node: LayoutNode, rankTops: Array<number>, rankBottoms: Array<number>) {
        if (node.inConnectors.length === 0 && node.outConnectors.length === 0) {
            return; // no connectors
        }
        let tmpInConnectors = [];
        let tmpOutConnectors = [];
        const SPACE = CONNECTOR_SPACING;
        const SIZE = CONNECTOR_SIZE;
        const inY = node.y - SIZE / 2;
        const outY = node.y + node.height - SIZE / 2;
        let inPointer = 0;
        let outPointer = 0;
        let x = node.x;

        const placeTmpConnectors = (x, tmpInConnectors: Array<LayoutConnector>, tmpOutConnectors: Array<LayoutConnector>) => {
            let length = Math.max(tmpInConnectors.length, tmpOutConnectors.length) * (SIZE + SPACE) - SPACE;
            let inSpace = SPACE;
            let inOffset = 0;
            if (tmpInConnectors.length < tmpOutConnectors.length) {
                inSpace = (length - (tmpInConnectors.length * SIZE)) / (tmpInConnectors.length + 1);
                inOffset = inSpace;
            }
            let outSpace = SPACE;
            let outOffset = 0;
            if (tmpOutConnectors.length < tmpInConnectors.length) {
                outSpace = (length - (tmpOutConnectors.length * SIZE)) / (tmpOutConnectors.length + 1);
                outOffset = outSpace;
            }
            _.forEach(tmpInConnectors, (connector, i) => {
                connector.x = x + inOffset + i * (inSpace + SIZE);
                connector.y = inY;
            });
            _.forEach(tmpOutConnectors, (connector, i) => {
                connector.x = x + outOffset + i * (outSpace + SIZE);
                connector.y = outY;
            });
            return x + length + SPACE;
        }

        while (inPointer < node.inConnectors.length || outPointer < node.outConnectors.length) {
            if (inPointer === node.inConnectors.length) {
                tmpOutConnectors.push(node.outConnectors[outPointer++]);
            } else if(outPointer === node.outConnectors.length) {
                tmpInConnectors.push(node.inConnectors[inPointer++]);
            } else {
                let scoped = false;
                if (node.inConnectors[inPointer].isScoped) {
                    scoped = true;
                    while (!node.outConnectors[outPointer].isScoped) {
                        tmpOutConnectors.push(node.outConnectors[outPointer++]);
                    }
                } else if (node.outConnectors[outPointer].isScoped) {
                    scoped = true;
                    while (!node.inConnectors[inPointer].isScoped) {
                        tmpInConnectors.push(node.inConnectors[inPointer++]);
                    }
                } else {
                    tmpInConnectors.push(node.inConnectors[inPointer++]);
                    tmpOutConnectors.push(node.outConnectors[outPointer++]);
                }
                if (scoped) {
                    x = placeTmpConnectors(x, tmpInConnectors, tmpOutConnectors);
                    let scopedConnectorIn = node.inConnectors[inPointer++];
                    scopedConnectorIn.x = x;
                    scopedConnectorIn.y = inY;
                    let scopedConnectorOut = node.outConnectors[outPointer++];
                    scopedConnectorOut.x = x;
                    scopedConnectorOut.y = outY;
                    x += SIZE + SPACE;
                    tmpInConnectors = [];
                    tmpOutConnectors = [];
                }
            }
        }
        placeTmpConnectors(x, tmpInConnectors, tmpOutConnectors);
        let auxBox = new Box(
            node.x,
            node.y,
            Math.max(node.inConnectors.length, node.outConnectors.length) * (SPACE + SIZE) - SPACE,
            SIZE
        ).centerIn(node.boundingBox());
        _.forEach(node.inConnectors, (connector: LayoutConnector) => {
            connector.translate(auxBox.x - node.x, 0);
        });
        _.forEach(node.outConnectors, (connector: LayoutConnector) => {
            connector.translate(auxBox.x - node.x, 0);
        });

        // place bundles
        _.forEach(node.inConnectorBundles, (inBundle: LayoutBundle) => {
            const top = rankTops[node.rank];
            inBundle.y = Math.min(top, node.y - CONNECTOR_SIZE / 2 - this._options["targetEdgeLength"] / 3);
            inBundle.x = _.mean(_.map(inBundle.connectors, (name: string) => node.connector("IN", name).x)) + SIZE / 2;
        });
        _.forEach(node.outConnectorBundles, (outBundle: LayoutBundle) => {
            const bottom = rankBottoms[node.rank + node.rankSpan - 1];
            outBundle.y = Math.max(bottom, node.y + node.height + CONNECTOR_SIZE / 2 + this._options["targetEdgeLength"] / 3);
            outBundle.x = _.mean(_.map(outBundle.connectors, (name: string) => node.connector("OUT", name).x)) + SIZE / 2;
        });
    }

    private _markCrossings(layoutGraph: LayoutGraph, rankTops: Array<number>, rankBottoms: Array<number>) {
        const endpointsPerRank = new Array(rankTops.length);
        for (let r = 1; r < rankTops.length; ++r) {
            endpointsPerRank[r] = [];
        }
        _.forEach(layoutGraph.edges(), (edge: LayoutEdge) => {
            _.forEach(edge.rawSegments(), (segment: Segment) => {
                let startRank = _.sortedIndexOf(rankBottoms, segment.start.y);
                let endRank = _.sortedIndexOf(rankTops, segment.end.y);
                if (startRank > -1 && endRank > -1 && startRank + 1 === endRank) {
                    endpointsPerRank[endRank].push([segment.start, this._segmentId]);
                    endpointsPerRank[endRank].push([segment.end, this._segmentId]);
                    this._segments[this._segmentId++] = segment;
                    this._segmentsPerRank[endRank].push(segment);
                }
            });
        });
        for (let r = 1; r < rankTops.length; ++r) {
            const pointsSorted = _.sortBy(endpointsPerRank[r], ([point, segmentId]) => {
                return point.x;
            });
            const openSegments: Set<number> = new Set();
            _.forEach(pointsSorted, ([point, segmentId]) => {
                if (openSegments.has(segmentId)) {
                    openSegments.delete(segmentId);
                } else {
                    openSegments.forEach((otherSegmentId) => {
                        if (this._segments[segmentId].end.x !== this._segments[otherSegmentId].end.x) {
                            this._crossingsPerRank[r].push([Math.min(segmentId, otherSegmentId), Math.max(segmentId, otherSegmentId)]);
                        }
                    });
                    openSegments.add(segmentId);
                }
            });
        }
    }

    private _maximizeAngles(layoutGraph: LayoutGraph) {
        const forces = [];
        _.forEach(this._crossingsPerRank, (crossings, r) => {
            let maxForce = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            const deltaXs = [];
            _.forEach(crossings, ids => {
                const segmentA = this._segments[ids[0]];
                const segmentB = this._segments[ids[1]];
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
                maxForce = Math.max(maxForce, force);
                maxY = Math.max(maxY, intersectionY);
                deltaXs.push([Math.abs(vectorA.x), Math.abs(vectorB.x)])
            });
            if (maxForce > 0) {
                const allDeltaXsSquared = [];
                _.forEach(this._segmentsPerRank[r], (segment: Segment) => {
                    const vector = segment.vector();
                    allDeltaXsSquared.push(vector.x * vector.x);
                });
                // golden-section search; adapted from https://en.wikipedia.org/wiki/Golden-section_search
                const goldenRatio = (Math.sqrt(5) + 1) / 2;
                let a = this._options["targetEdgeLength"];
                let b = this._options["targetEdgeLength"] + maxForce;
                let f = (deltaY) => {
                    let cost = 0;
                    _.forEach(deltaXs, ([deltaXA, deltaXB]) => {
                        const angle = Math.atan(deltaY / deltaXA) + Math.atan(deltaY / deltaXB);
                        cost += this._options["weightCrossings"] * (1 + Math.cos(2 * angle + 1)) / 2;
                    });
                    const deltaYSquared = deltaY * deltaY;
                    _.forEach(allDeltaXsSquared, deltaXSquared => {
                        cost += this._options["weightLenghts"] * Math.sqrt(deltaYSquared + deltaXSquared) / this._options["targetEdgeLength"];
                    });
                    return cost;
                }
                let c = b - (b - a) / goldenRatio;
                let d = a + (b - a) / goldenRatio
                while (Math.abs(b - a) > 1e-5) {
                    if (f(c) < f(d)) {
                        b = d;
                    } else {
                        a = c
                    }
                    // recompute c and d to counter loss of precision
                    c = b - (b - a) / goldenRatio
                    d = a + (b - a) / goldenRatio
                }
                forces.push([maxY, (b + a) / 2 - this._options["targetEdgeLength"]]);
            }
        });

        const sortedForces = _.sortBy(forces, ([intersectionY, force]) => intersectionY);
        Assert.assertEqual(sortedForces, forces, "forces are not sorted?");

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
        const pointsSorted = _.sortBy(points, "0"); // sort by y
        let forcePointer = 0;
        let totalForce = 0;
        const movedSet = new Set();
        _.forEach(pointsSorted, ([pointY, type, object, position]) => {
            while (forcePointer < sortedForces.length && sortedForces[forcePointer][0] < pointY) {
                totalForce += sortedForces[forcePointer][1];
                forcePointer++;
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
}
