import {CONNECTOR_SIZE, CONNECTOR_SPACING, DEBUG, EPSILON} from "../util/constants";
import {inPlaceSort, sort} from "fast-sort";
import * as _ from "lodash";
import * as seedrandom from "seedrandom";
import Assert from "../util/assert";
import Box from "../geometry/box";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import Layouter from "./layouter";
import LayoutBundle from "../layoutGraph/layoutBundle";
import LayoutConnector from "../layoutGraph/layoutConnector";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import LevelGraph from "../levelGraph/levelGraph";
import LevelNode from "../levelGraph/levelNode";
import Node from "../graph/node";
import OrderGraph from "../order/orderGraph";
import OrderGroup from "../order/orderGroup";
import OrderNode from "../order/orderNode";
import OrderRank from "../order/orderRank";
import RankGraph from "../rank/rankGraph";
import RankNode from "../rank/rankNode";
import Segment from "../geometry/segment";
import Shuffle from "../util/shuffle";
import Timer from "../util/timer";
import Vector from "../geometry/vector";

export default class HybridLayouter extends Layouter {
    constructor(options: object = {}) {
        super();
        this._options = _.defaults(options, this._options, {
            numIterations: 1000,
            stepSize: 1,
            weightSpring: 0,
            weightRepulsive: 1,
            weightRepulsiveNode: 1,
            weightMagnetic: 1,
            magneticStrength: 1,
            distanceExponent: 1,
            angleExponent: 1,
            decay: 1,
        });
    }

    protected async doLayout(graph: LayoutGraph): Promise<void> {
        if (graph.numNodes() === 0) {
            return;
        }

        Timer.start(["doLayout"]);

        // STEP 1: REMOVE CYCLES
        Timer.start(["doLayout", "removeCycles"]);
        this._removeCycles(graph);
        Timer.stop(["doLayout", "removeCycles"]);

        // STEP 2: ASSIGN RANKS
        Timer.start(["doLayout", "assignRanks"]);
        this._assignRanks(graph);
        Timer.stop(["doLayout", "assignRanks"]);

        // STEP 3: ADD VIRTUAL NODES
        Timer.start(["doLayout", "addVirtualNodes"]);
        this._addVirtualNodes(graph);
        Timer.stop(["doLayout", "addVirtualNodes"]);

        // STEP 4: ASSIGN Y COORDINATES (NODES & CONNECTORS)
        const [rankTops, rankBottoms] = await this._assignYCoordinates(graph);

        // STEP 5: ASSIGN X COORDINATES (NODES & CONNECTORS)
        await this._assignXCoordinates(graph);

        // STEP 6: PLACE EDGES
        await this._placeEdges(graph, rankTops, rankBottoms);

        // STEP 7: RESTORE CYCLES
        Timer.start(["doLayout", "restoreCycles"]);
        this._restoreCycles(graph);
        Timer.stop(["doLayout", "restoreCycles"]);

        Timer.stop(["doLayout"]);
    }

    private _removeCycles(graph: LayoutGraph): void {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.mayHaveCycles) {
                // remove self-loops
                _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                    if (edge.src === edge.dst) {
                        subgraph.node(edge.src).selfLoop = edge;
                        subgraph.removeEdge(edge.id);
                    }
                });

                // remove normal cycles
                const invertedEdges = subgraph.removeCycles();
                _.forEach(invertedEdges, (edge: LayoutEdge) => {
                    const newSrc = subgraph.node(edge.src);
                    const newDst = subgraph.node(edge.dst);
                    newSrc.addConnector("OUT", "bottomIn", true);
                    newDst.addConnector("IN", "topOut", true);
                    edge.srcConnector = "bottomIn";
                    edge.dstConnector = "topOut";
                    if (!_.some(subgraph.outEdges(newDst.id), edge => edge.srcConnector === null)) {
                        newDst.removeConnector("OUT", null);
                    }
                    if (!_.some(subgraph.inEdges(newSrc.id), edge => edge.dstConnector === null)) {
                        newSrc.removeConnector("IN", null);
                    }
                });
            }
        });
    }

    private _assignRanks(graph: LayoutGraph): void {
        const assignRanksForSubgraph = (subgraph: LayoutGraph) => {
            if (subgraph.numNodes() === 0) {
                return; // do nothing for empty subgraphs
            }

            // first determine the rank span of all nodes
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                _.forEach(node.childGraphs, (childGraph: LayoutGraph) => {
                    assignRanksForSubgraph(childGraph);
                });
            });

            const rankGraph = new RankGraph();
            _.forEach(subgraph.nodes(), node => {
                rankGraph.addNode(new RankNode(/*node.label()*/), node.id);
            });
            _.forEach(subgraph.edges(), edge => {
                rankGraph.addEdge(new Edge(edge.src, edge.dst, subgraph.node(edge.src).rankSpan));
            });
            rankGraph.rank();

            _.forEach(subgraph.nodes(), node => {
                node.rank = rankGraph.node(node.id).rank;
                subgraph.numRanks = Math.max(subgraph.numRanks, node.rank + node.rankSpan);
            });

            if (subgraph.parentNode !== null) {
                subgraph.parentNode.rankSpan = Math.max(subgraph.parentNode.rankSpan, subgraph.numRanks);
            }
        };
        assignRanksForSubgraph(graph);

        // transform ranking from local to global
        const makeRanksAbsolute = (subgraph: LayoutGraph, offset: number) => {
            subgraph.minRank = offset;
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                _.forEach(node.childGraphs, (childGraph: LayoutGraph) => {
                    makeRanksAbsolute(childGraph, offset + node.rank);
                });
                node.rank += offset;
                subgraph.numRanks = Math.max(subgraph.numRanks, node.rank + node.rankSpan - subgraph.minRank);
            });
        }
        makeRanksAbsolute(graph, 0);
    }

    private _addVirtualNodes(graph: LayoutGraph, addToLevelGraph: boolean = false): void {
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
                    const newNode = new LayoutNode({width: 0, height: 0}, 0, 0, !bundle, bundle);
                    bundle = ((edge.dstBundle !== null) && (edge.dstBundle.edges.length > 1) && (tmpDstRank === dstNode.rank - 2));
                    newNode.rank = tmpDstRank;
                    //newNode.setLabel("virtual node on edge from " + srcNode.label() + " to " + dstNode.label());
                    tmpDstId = edge.graph.addNode(newNode, null);
                    if (addToLevelGraph) {
                        const levelNode = newNode.graph.levelGraph().addLayoutNode(newNode);
                        levelNode.position = _.last(srcNode.levelNodes).position;
                    }
                    if (tmpDstRank === srcNode.rank + srcNode.rankSpan) {
                        // original edge is redirected from source to first virtual node
                        edge.graph.redirectEdge(edge.id, edge.src, tmpDstId);
                        edge.dstConnector = null;
                        // add bundle edges
                        if (edge.srcBundle !== null && edge.srcBundle.edges.length > 1) {
                            _.forEach(edge.srcBundle.edges, (bundleEdge: LayoutEdge) => {
                                if (bundleEdge.isReplica) {
                                    bundleEdge.graph.redirectEdge(bundleEdge.id, bundleEdge.src, tmpDstId);
                                }
                            });
                        }
                        if (addToLevelGraph) {
                            const levelEdge = edge.graph.levelGraph().edgeBetween(_.last(srcNode.levelNodes).id, _.first(dstNode.levelNodes).id);
                            if (levelEdge !== undefined) {
                                levelEdge.graph.removeEdge(levelEdge.id);
                            }
                            edge.graph.levelGraph().addLayoutEdge(edge);
                        }
                    } else {
                        const tmpEdge = new LayoutEdge(tmpSrcId, tmpDstId);
                        if (!bundle) {
                            tmpEdge.weight = Number.POSITIVE_INFINITY;
                        }
                        tmpEdge.isInverted = edge.isInverted;
                        edge.graph.addEdge(tmpEdge, null);
                        if (addToLevelGraph) {
                            edge.graph.levelGraph().addLayoutEdge(tmpEdge);
                        }
                    }
                    tmpSrcId = tmpDstId;
                }
                // last virtual edge has the original dstConnector
                const tmpEdge = new LayoutEdge(tmpSrcId, dstNode.id, null, dstConnector);
                tmpEdge.isInverted = edge.isInverted;
                edge.graph.addEdge(tmpEdge, null);
                if (addToLevelGraph) {
                    edge.graph.levelGraph().addLayoutEdge(tmpEdge);
                }
                // add bundle edges
                if ((edge.dstBundle !== null) && (edge.dstBundle.edges.length > 1)) {
                    _.forEach(edge.dstBundle.edges, (bundleEdge: LayoutEdge) => {
                        if (bundleEdge.isReplica) {
                            bundleEdge.graph.redirectEdge(bundleEdge.id, tmpSrcId, bundleEdge.dst);
                        }
                    });
                }
            }
        });
    }

    private _updateLevelNodeRanks(graph: LayoutGraph): void {
        _.forEach(graph.allNodes(), (layoutNode: LayoutNode) => {
            _.forEach(layoutNode.levelNodes, (levelNode: LevelNode, r: number) => {
                levelNode.rank = layoutNode.rank + r;
            });
        });
    }

    public async countCrossings(graph: LayoutGraph): Promise<number> {
        const orderGraph = this._createConnectorGraph(graph, true);
        return await orderGraph.order({
            resolveConflicts: false,
            countInitial: true,
            countOnly: true,
        });
    }

    private _createConnectorGraph(graph: LayoutGraph, isPreorder: boolean, shuffleNodes: boolean = false, shuffleConnectors: boolean = false): OrderGraph {
        const orderGraph = new OrderGraph(this._wasm);
        const orderRank = [];
        for (let r = 0; r < graph.numRanks; ++r) {
            orderRank[r] = new OrderRank(r);
            orderGraph.addRank(orderRank[r]);
        }

        const connectorMap = new Map();
        const levelNodeMap = new Map();

        // add nodes
        const addConnectorsForSubgraph = (subgraph: LayoutGraph, indizes: Array<number> = null) => {
            _.forEach(subgraph.levelGraph().ranks(), (rank: Array<LevelNode>, r) => {
                let index = (indizes === null ? 0 : indizes[r]);
                if (shuffleNodes) {
                    rank = Shuffle.shuffle(rank);
                }
                _.forEach(rank, (levelNode: LevelNode) => {
                    levelNode.position = index;
                    const node = levelNode.layoutNode;
                    if (levelNode.isLast) {
                        let childIndizes = null;
                        if (node.isScopeNode) {
                            childIndizes = _.map(node.levelNodes, "position");
                        }
                        _.forEach(node.childGraphs, (childGraph: LayoutGraph) => {
                            addConnectorsForSubgraph(childGraph, childIndizes);
                        });
                    }
                    if (node.isScopeNode) {
                        index += node.childGraphs[0].maxNodesPerRank();
                        return; // do not add connectors for scope nodes
                    }
                    let connectorGroup;
                    const shuffleHierarchy = [null];
                    _.forEachRight(node.parents(), parent => {
                        shuffleHierarchy.push(parent);
                    });
                    if (isPreorder || levelNode.isFirst) {
                        connectorGroup = new OrderGroup(levelNode);
                        connectorGroup.shuffleHierarchy = shuffleHierarchy;
                        orderRank[levelNode.rank].addGroup(connectorGroup);
                        connectorGroup.position = index;
                        if (levelNode.isFirst) {
                            // add input connectors
                            let connectors = node.inConnectors;
                            if (shuffleConnectors) {
                                connectors = Shuffle.shuffle(connectors);
                            }
                            _.forEach(connectors, (connector: LayoutConnector) => {
                                const connectorNode = new OrderNode(connector, false, false, /*connector.name*/);
                                connectorGroup.addNode(connectorNode);
                                connectorMap.set(connector, connectorNode.id);
                                if (connector.isScoped) {
                                    connectorMap.set(connector.counterpart, connectorNode.id);
                                }
                            });
                        }
                    }
                    if (isPreorder || levelNode.isLast) {
                        if (!isPreorder && !node.hasScopedConnectors) {
                            connectorGroup = new OrderGroup(levelNode);
                            connectorGroup.shuffleHierarchy = shuffleHierarchy;
                            orderRank[levelNode.rank].addGroup(connectorGroup);
                            connectorGroup.position = index;
                        }
                        if (levelNode.isLast) {
                            // add output connectors
                            let connectors = node.outConnectors;
                            if (shuffleConnectors) {
                                connectors = Shuffle.shuffle(connectors);
                            }
                            _.forEach(connectors, (connector: LayoutConnector) => {
                                if (!connector.isScoped) {
                                    const connectorNode = new OrderNode(connector, false, false, /*connector.name*/);
                                    connectorGroup.addNode(connectorNode);
                                    connectorMap.set(connector, connectorNode.id);
                                }
                            });
                        }
                    }
                    if (isPreorder && node.rankSpan > 1) {
                        const orderNode = new OrderNode(null, false, false, /*node.label()*/);
                        connectorGroup.addNode(orderNode);
                        levelNodeMap.set(levelNode, orderNode);
                    }
                    index++;
                });
            });
        };
        addConnectorsForSubgraph(graph);

        // add edges
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            let srcNode = edge.graph.node(edge.src);
            if (srcNode.isScopeNode) {
                srcNode = srcNode.childGraphs[0].exitNode;
            }
            let dstNode = edge.graph.node(edge.dst);
            if (dstNode.isScopeNode) {
                dstNode = dstNode.childGraphs[0].entryNode;
            }
            if (DEBUG) {
                Assert.assert(dstNode.rank > srcNode.rank, "edge not between neighboring ranks", edge, srcNode, dstNode);
            }

            let srcOrderNodeId = connectorMap.get(srcNode.connector("OUT", edge.srcConnector));
            /*if (srcOrderNodeId === undefined) {
                srcOrderNodeId = connectorMap.get(srcNode.connector("OUT", "bottomIn"));
            }*/
            let dstOrderNodeId = connectorMap.get(dstNode.connector("IN", edge.dstConnector));
            /*if (dstOrderNodeId === undefined) {
                dstOrderNodeId = connectorMap.get(srcNode.connector("IN", "topOut"));
            }*/
            orderGraph.addEdge(new Edge(srcOrderNodeId, dstOrderNodeId, 1));
        });

        if (isPreorder) {
            // add intranode edges
            _.forEach(graph.allNodes(), (node: LayoutNode) => {
                if (!node.isScopeNode && node.rankSpan > 1) {
                    for (let r = 0; r < node.levelNodes.length - 1; ++r) {
                        const srcNode = node.levelNodes[r];
                        const dstNode = node.levelNodes[r + 1];
                        let srcOrderNode = levelNodeMap.get(srcNode);
                        let dstOrderNode = levelNodeMap.get(dstNode);
                        orderGraph.addEdge(new Edge(srcOrderNode.id, dstOrderNode.id, 1));
                    }
                }
            });
        }

        return orderGraph;
    }

    public async doOrder(graph: LayoutGraph, shuffle: boolean = false): Promise<void> {
        /**
         * STEP 1 (OPTIONAL): ORDER NODES BASED ON CONNECTORS
         * In this step, scope insides and outsides are handled in the same order graph.
         * If there are nested scopes, they are flattened.
         */
        if (this._options["preorderConnectors"]) {
            // order
            const connectorOrderGraph = this._createConnectorGraph(graph, true, shuffle);
            await connectorOrderGraph.order({
                method: "springs",
                orderGroups: true,
                resolveConflicts: false,
            });

            // copy order information from order graph to layout graph
            _.forEach(connectorOrderGraph.groups(), (orderGroup: OrderGroup) => {
                const levelNode = orderGroup.reference;
                if (levelNode !== null) {
                    levelNode.position = orderGroup.position;
                    let tmpNode = levelNode;
                    while (tmpNode.layoutNode.graph.entryNode !== null) {
                        tmpNode = tmpNode.layoutNode.graph.parentNode.levelNodes[tmpNode.rank - tmpNode.layoutNode.graph.parentNode.rank];
                        tmpNode.position = levelNode.position;
                    }
                }
            });
        }

        /**
         * STEP 2: ORDER NODES (OPTIONAL) & RESOLVE CONFLICTS
         * This is done strictly hierarchically.
         * Child graphs are represented as a chain over multiple ranks in their parent.
         */

        const nodeMap: Map<number, number> = new Map(); // map from level node to corresponding order node

        // child graphs are visited before their parents (guaranteed by forEachRight)
        const allGraphs = graph.allGraphs();
        for (let i = allGraphs.length - 1; i >= 0; --i) {
            const subgraph = allGraphs[i];
            this._addVirtualNodes(subgraph, true);

            const levelGraph = subgraph.levelGraph();
            levelGraph.invalidateRankOrder();

            // init graph and ranks
            const orderGraph = new OrderGraph(this._wasm);
            const orderGroups = new Array(subgraph.numRanks);
            for (let r = subgraph.minRank; r < subgraph.minRank + subgraph.numRanks; ++r) {
                const orderRank = new OrderRank(r);
                orderGraph.addRank(orderRank);
                orderGroups[r] = new OrderGroup(null);
                orderRank.addGroup(orderGroups[r]);
            }

            // add nodes
            let levelNodes = _.clone(levelGraph.nodes());
            if (shuffle && !this._options["preorderConnectors"]) {
                Shuffle.shuffle(levelNodes);
            }
            _.forEach(levelNodes, (levelNode: LevelNode) => {
                const orderNode = new OrderNode(levelNode, levelNode.layoutNode.isVirtual || levelNode.layoutNode.isBundle, levelNode.layoutNode.rankSpan > 1, levelNode.layoutNode.label());
                orderGroups[levelNode.rank].addNode(orderNode, levelNode.id);
                nodeMap.set(levelNode.id, orderNode.id);
                if (this._options["preorderConnectors"]) {
                    orderNode.position = levelNode.position;
                }
            });

            // add edges
            // for each pair of nodes, sum up the weights of edges in-between
            _.forEach(levelGraph.edges(), (edge: Edge<any, any>) => {
                const existingEdge = orderGraph.edgeBetween(edge.src, edge.dst);
                if (existingEdge === undefined) {
                    orderGraph.addEdge(new Edge(edge.src, edge.dst, edge.weight));
                } else {
                    existingEdge.weight += edge.weight;
                }
            });

            if (DEBUG) {
                Assert.assertAll(orderGraph.edges(), edge => {
                    const srcNode = edge.graph.node(edge.src);
                    const dstNode = edge.graph.node(edge.dst);
                    return (srcNode.group.rank.rank + 1 === dstNode.group.rank.rank);
                }, "order graph edge not between neighboring ranks");
            }

            // do order
            await orderGraph.order({
                debug: false/*subgraph.numNodes() === 189*/,
                countInitial: this._options["preorderConnectors"],
                shuffles: this._options["shuffleGlobal"] ? 0 : (this._options["preorderConnectors"] ? 0 : this._options["numShuffles"]),
            });

            // copy node order into layout graph
            const newOrderNodes: Set<OrderNode> = new Set();

            _.forEach(orderGraph.nodes(), (orderNode: OrderNode) => {
                let levelNode: LevelNode = orderNode.reference;
                if (levelNode === null) {
                    // virtual node was created by orderGraph.order() => add this node to layout graph
                    const newLayoutNode = new LayoutNode({width: 0, height: 0}, 0, 0, true);
                    //newLayoutNode.setLabel(orderNode.label());
                    newLayoutNode.rank = orderNode.rank;
                    subgraph.addNode(newLayoutNode, null);
                    newOrderNodes.add(orderNode);
                    levelNode = levelGraph.addLayoutNode(newLayoutNode);
                    orderNode.reference = levelNode;
                } else {
                    if (levelNode.isFirst) {
                        levelNode.layoutNode.updateRank(orderNode.rank);//levelNode.layoutNode.rank + orderNode.rank - orderNode.initialRank;
                    }
                }
                subgraph.numRanks = Math.max(subgraph.numRanks, levelNode.rank - subgraph.minRank + 1);
                levelNode.position = orderNode.position;
            });

            let tmpSubgraph = subgraph;
            while (tmpSubgraph.parentNode !== null) {
                const parent = tmpSubgraph.parentNode;
                const prevRankSpan = parent.rankSpan;
                const newRankSpan = Math.max(prevRankSpan, tmpSubgraph.numRanks);
                const diff = newRankSpan - prevRankSpan;
                if (diff !== 0) {
                    const levelGraph = parent.graph.levelGraph();
                    parent.rankSpan = newRankSpan;

                    /**
                     * UPDATE LEVEL NODES REPRESENTATION IN PARENT
                     */
                    let positions = _.map(parent.levelNodes, "position");
                    positions.length = newRankSpan;
                    _.fill(positions, positions[prevRankSpan - 1], prevRankSpan);
                    const lastLevelNode = _.last(parent.levelNodes);
                    // add new nodes
                    const newNodes = [];
                    for (let r = 0; r < diff; ++r) {
                        const newNode = new LevelNode(parent, lastLevelNode.rank + r, 0);
                        levelGraph.addNode(newNode);
                        newNodes.push(newNode);
                    }
                    parent.levelNodes.length--;
                    Array.prototype.push.apply(parent.levelNodes, newNodes);
                    parent.levelNodes.push(lastLevelNode);
                    lastLevelNode.rank += diff;
                    // redirect last edge
                    const lastEdge = levelGraph.inEdges(lastLevelNode.id)[0];
                    levelGraph.redirectEdge(lastEdge.id, _.last(newNodes).id, lastLevelNode.id);
                    // update positions
                    _.forEach(parent.levelNodes, (levelNode: LevelNode, r: number) => {
                        levelNode.position = positions[r];
                    });
                    // add edges between new nodes
                    for (let r = prevRankSpan - 2; r < newRankSpan - 2; ++r) {
                        levelGraph.addEdge(new Edge(parent.levelNodes[r].id, parent.levelNodes[r + 1].id, Number.POSITIVE_INFINITY));
                    }
                    /////////////////////////////////////////////////////

                    _.forEach(parent.graph.bfs(parent.id), (node: LayoutNode) => {
                        if (node !== parent) {
                            node.offsetRank(diff);
                        }
                        node.graph.numRanks = Math.max(node.graph.numRanks, node.rank + node.rankSpan - node.graph.minRank);
                    });
                }
                tmpSubgraph = parent.graph;
            }

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
            });

            levelGraph.invalidateRankOrder();
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
                        if (layoutEdge.isReplica) {
                            return;
                        }
                        let newNodes = _.clone(newNodesPerEdge.get(key));
                        const dstConnector = layoutEdge.dstConnector;
                        if (e > 0) {
                            let clonedNewNodes = [];
                            // create a copy of all new nodes because each edge needs its own virtual nodes
                            _.forEach(newNodes, (levelNode: LevelNode) => {
                                // virtual node was created by orderGraph.order() => add this node to layout graph
                                const newLayoutNode = new LayoutNode({width: 0, height: 0}, 0, 0, true);
                                //newLayoutNode.setLabel(levelNode.label());
                                newLayoutNode.rank = levelNode.layoutNode.rank;
                                subgraph.addNode(newLayoutNode, null);
                                const newLevelNode = levelGraph.addLayoutNode(newLayoutNode);
                                const rank = ranks[newLayoutNode.rank - subgraph.minRank];
                                for (let pos = levelNode.position; pos < rank.length; ++pos) {
                                    rank[pos].position++;
                                }
                                rank.splice(levelNode.position - 1, 0, newLevelNode);
                                newLevelNode.position = levelNode.position - 1;
                                clonedNewNodes.push(newLevelNode);
                            });
                            newNodes = clonedNewNodes;
                        }
                        newNodes.push(orderGraph.node(orderDstNodeId).reference);
                        subgraph.removeEdge(layoutEdge.id);
                        layoutEdge.dst = newNodes[0].layoutNode.id;
                        layoutEdge.dstConnector = null;
                        subgraph.addEdge(layoutEdge, layoutEdge.id);
                        levelGraph.addLayoutEdge(layoutEdge);
                        for (let n = 1; n < newNodes.length; ++n) {
                            const tmpSrcLayoutNodeId = newNodes[n - 1].layoutNode.id;
                            const tmpDstLayoutNodeId = newNodes[n].layoutNode.id;
                            const tmpDstConnector = ((n === newNodes.length - 1) ? dstConnector : null);
                            const newLayoutEdge = new LayoutEdge(tmpSrcLayoutNodeId, tmpDstLayoutNodeId, null, tmpDstConnector);
                            subgraph.addEdge(newLayoutEdge, null);
                            levelGraph.addLayoutEdge(newLayoutEdge);
                        }
                    });
                }
            });
        }

        this._updateLevelNodeRanks(graph);

        /**
         * STEP 3: ORDER CONNECTORS
         */

            // order connectors
        const connectorOrderGraph = this._createConnectorGraph(graph, false, false, shuffle && !this._options["preorderConnectors"]);
        await connectorOrderGraph.order({
            resolveConflicts: false,
            shuffles: this._options["shuffleGlobal"] ? 0 : this._options["numShuffles"],
        });

        // copy order information from order graph to layout graph
        _.forEach(connectorOrderGraph.groups(), (orderGroup: OrderGroup) => {
            const levelNode = orderGroup.reference;
            if (levelNode !== null) {
                const layoutNode = levelNode.layoutNode;
                const connectors = {"IN": [], "OUT": []};
                _.forEach(orderGroup.orderedNodes(), (orderNode: OrderNode) => {
                    if (orderNode.reference !== null) {
                        const connector = orderNode.reference;
                        connectors[connector.type].push(connector);
                        if (connector.isScoped) {
                            connectors["OUT"].push(connector.counterpart);
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
                    }
                    if (connectors["OUT"].length > 0) {
                        layoutNode.outConnectors = connectors["OUT"];
                    }
                }
            }
        });
    }

    private async _orderAndCount(graph: LayoutGraph): Promise<number> {
        const graphCopy = graph.cloneForOrdering();
        await this.doOrder(graphCopy);
        return await this.countCrossings(graphCopy);
    }

    private async _orderRanks(graph: LayoutGraph): Promise<void> {
        if (!this._options["shuffleGlobal"] || this._options["numShuffles"] === 0) {
            await this.doOrder(graph);
        } else {
            if (!this._options["bundle"] && this._options["webWorkers"]) {
                const allGraphs = graph.allGraphs();
                const numNodesTotal = _.sum(_.map(allGraphs, subgraph => subgraph.numNodes()));
                const numInConnectorsTotal = _.sum(_.map(allGraphs, subgraph => _.sum(_.map(subgraph.nodes(), node => node.numInConnectors()))))
                const numOutConnectorsTotal = _.sum(_.map(allGraphs, subgraph => _.sum(_.map(subgraph.nodes(), node => node.numOutConnectors()))))
                const numEdgesTotal = _.sum(_.map(allGraphs, subgraph => subgraph.numEdges()));
                // DATA PASSED TO WORKER
                // metadata: level, parentNodeId, #nodes, #in-connectors, #out-connectors, #edges, minRank, numRanks
                // nodes: id, rank, rankSpan, isVirtual, isScopeNode
                // inConnectors: nodeId, counterPartId
                // outConnectors: nodeId, counterPartId
                // edges: id, srcId, dstId, srcConnectorId, dstConnectorId, weight
                const sizeMetadata = 8 * allGraphs.length;
                const sizeNodes = 5 * numNodesTotal;
                const sizeInConnectors = numInConnectorsTotal;
                const sizeOutConnectors = 2 * numOutConnectorsTotal;
                const sizeEdges = 8 * numEdgesTotal;
                let metadata, parents, nodes, edges, inConnectors, outConnectors;
                if (typeof (SharedArrayBuffer) !== "undefined") {
                    const numPerGraphSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * sizeMetadata);
                    metadata = new Int32Array(numPerGraphSab);
                    const nodesSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * sizeNodes);
                    nodes = new Int32Array(nodesSab);
                    const inConnectorsSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * sizeInConnectors);
                    inConnectors = new Int32Array(inConnectorsSab);
                    const outConnectorsSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * sizeOutConnectors);
                    outConnectors = new Int32Array(outConnectorsSab);
                    const edgesSab = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * sizeEdges);
                    edges = new Int32Array(edgesSab);
                } else {
                    metadata = new Array(sizeMetadata);
                    nodes = new Array(sizeNodes);
                    inConnectors = new Array(sizeInConnectors);
                    outConnectors = new Array(sizeOutConnectors);
                    edges = new Array(sizeEdges);
                }
                let n = 0;
                let i = 0;
                let o = 0;
                let e = 0;
                _.forEach(allGraphs, (subgraph: LayoutGraph, g: number) => {
                    const graphNodes = subgraph.nodes();
                    let numInConnectors = 0;
                    let numOutConnectors = 0;
                    _.forEach(graphNodes, (node: LayoutNode) => {
                        _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                            inConnectors[i++] = connector.node.id;
                            numInConnectors++;
                        });
                        _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                            outConnectors[o++] = connector.node.id;
                            outConnectors[o++] = (connector.isScoped ? connector.node.connectorIndex("IN", connector.counterpart.name) : -1);
                            numOutConnectors++;
                        });
                    });
                    const graphEdges = subgraph.edges();
                    metadata[8 * g] = (subgraph.parentNode === null ? 0 : subgraph.parentNode.parents().length + 1);
                    metadata[8 * g + 1] = (subgraph.parentNode === null ? -1 : subgraph.parentNode.id);
                    metadata[8 * g + 2] = graphNodes.length;
                    metadata[8 * g + 3] = numInConnectors;
                    metadata[8 * g + 4] = numOutConnectors;
                    metadata[8 * g + 5] = graphEdges.length;
                    metadata[8 * g + 6] = subgraph.minRank;
                    metadata[8 * g + 7] = subgraph.numRanks;
                    _.forEach(graphNodes, (node: LayoutNode) => {
                        nodes[n++] = node.id;
                        nodes[n++] = node.rank;
                        nodes[n++] = node.rankSpan;
                        nodes[n++] = node.isVirtual;
                        nodes[n++] = node.isScopeNode;
                    });
                    _.forEach(graphEdges, (edge: LayoutEdge) => {
                        edges[e++] = edge.id; // id
                        edges[e++] = edge.src; // srcNodeId
                        edges[e++] = edge.dst; // dstNodeId
                        let srcNode = subgraph.node(edge.src);
                        let dstNode = subgraph.node(edge.dst);
                        if (srcNode.isScopeNode) {
                            srcNode = srcNode.childGraphs[0].exitNode;
                        }
                        if (dstNode.isScopeNode) {
                            dstNode = dstNode.childGraphs[0].entryNode;
                        }
                        edges[e++] = srcNode.connectorIndex("OUT", edge.srcConnector) // srcConnectorId
                        edges[e++] = dstNode.connectorIndex("IN", edge.dstConnector) // dstConnectorId
                        edges[e++] = (edge.weight === Number.POSITIVE_INFINITY ? -1 : edge.weight); // weight
                    });
                });

                const promises = [this._orderAndCount(graph)];
                for (let s = 0; s < this._options["numShuffles"]; ++s) {
                    promises.push(this._pool.exec("orderRanks", [s + 1, allGraphs.length, metadata, nodes, inConnectors, outConnectors, edges, this._options["webAssembly"]]));
                }
                const results = await Promise.all(promises);
                let minCrossings = results[0];
                let minIndex = 0;
                _.forEach(results, (result: number, index: number) => {
                    if (result < minCrossings) {
                        minCrossings = result;
                        minIndex = index;
                    }
                });
                seedrandom(minIndex, {global: true});
                await this.doOrder(graph, minIndex > 0);
            } else {
                const graphCopy = graph.cloneForOrdering();
                await this.doOrder(graphCopy);
                let minCrossings = await this.countCrossings(graphCopy);
                let bestGraphCopy = graphCopy;
                for (let i = 0; i < this._options["numShuffles"]; ++i) {
                    if (minCrossings === 0) {
                        break;
                    }
                    const graphCopy = graph.cloneForOrdering();
                    await this.doOrder(graphCopy, true);
                    let numCrossings = await this.countCrossings(graphCopy);
                    if (numCrossings < minCrossings) {
                        minCrossings = numCrossings;
                        bestGraphCopy = graphCopy;
                    }
                }
                bestGraphCopy.copyInto(graph);
            }
        }
    }

    private _bundleConnectors(connectors: Array<LayoutConnector>, counterPartConnectors: Array<LayoutConnector>, bundles: Array<LayoutBundle>): void {
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
     * @private
     */
    private async _assignYCoordinates(graph: LayoutGraph): Promise<[Array<number>, Array<number>]> {
        const rankTops = _.fill(new Array(graph.numRanks + 1), Number.POSITIVE_INFINITY);
        const rankBottoms = _.fill(new Array(graph.numRanks), Number.NEGATIVE_INFINITY);

        const globalRanks = graph.globalRanks();

        rankTops[0] = 0;
        for (let r = 0; r < globalRanks.length; ++r) {
            let maxBottom = 0;
            _.forEach(globalRanks[r], (node: LayoutNode) => {
                node.y = rankTops[r];
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.rank === node.rank) {
                        node.y += parent.padding;
                    }
                });
                node.updateSize({width: 2 * node.padding, height: 2 * node.padding});
                let height = node.height;
                let hasRealInConnector = false;
                _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                    connector.y = node.y;
                    hasRealInConnector ||= (!connector.isTemporary);
                });
                if (hasRealInConnector) {
                    node.y += CONNECTOR_SIZE / 2;
                }
                let hasRealOutConnector = false;
                _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                    connector.y = node.y + height - (!connector.isTemporary ? (CONNECTOR_SIZE / 2) : 0);
                    hasRealOutConnector ||= (!connector.isTemporary);
                });
                if (hasRealOutConnector) {
                    height += CONNECTOR_SIZE / 2;
                }
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.rank + parent.rankSpan - 1 === node.rank) {
                        height += parent.padding;
                        if (_.some(parent.outConnectors, connector => !connector.isTemporary)) {
                            height += CONNECTOR_SIZE / 2;
                        }
                    }
                });
                maxBottom = Math.max(maxBottom, node.y + height);
            });
            rankBottoms[r] = maxBottom;
            rankTops[r + 1] = maxBottom + this._options["targetEdgeLength"];
        }
        _.forEachRight(graph.allGraphs(), (subgraph: LayoutGraph) => {
            const parent = subgraph.parentNode;
            if (parent !== null && subgraph === _.last(parent.childGraphs)) {
                let height = 0;
                let boundingBox;
                _.forEach(parent.childGraphs, (childGraph: LayoutGraph) => {
                    boundingBox = childGraph.boundingBox(false);
                    if (_.some(parent.outConnectors, connector => !connector.isTemporary)) {
                        boundingBox.height -= CONNECTOR_SIZE / 2;
                    }
                    height = Math.max(height, boundingBox.height);
                });
                height += 2 * subgraph.parentNode.padding;
                parent.updateSize({width: 0, height: height});
            }
        });
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
            _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                connector.y = node.y + node.height - (!connector.isTemporary ? (CONNECTOR_SIZE / 2) : 0);
            });
        });
        return [rankTops, rankBottoms];
    }

    private async _assignXCoordinates(graph: LayoutGraph): Promise<void> {
        const assignXCoordinatesSubgraph = (subgraph: LayoutGraph, offset: number = 0, doPlace: boolean = true, subgraphs = [], connectors = []) => {
            subgraphs.push(subgraph);
            const ranks = subgraph.levelGraph().ranks();
            _.forEach(ranks, (rank: Array<LevelNode>, r: number) => {
                let x = offset;
                _.forEach(rank, (node: LevelNode) => {
                    const layoutNode = node.layoutNode;
                    layoutNode.x = x;
                    if (node.isFirst) {
                        let connectorsWidth = _.sum(_.map(layoutNode.inConnectors, "width")) + (layoutNode.inConnectors.length - 1) * CONNECTOR_SIZE;
                        let connectorX = layoutNode.x + (node.width - connectorsWidth) / 2;
                        _.forEach(layoutNode.inConnectors, (connector: LayoutConnector, c: number) => {
                            connector.x = connectorX;
                            connectors.push(connector);
                            connectorX += connector.width + CONNECTOR_SPACING;
                        });
                    }
                    if (node.isLast) {
                        let connectorsWidth = _.sum(_.map(layoutNode.outConnectors, "width")) + (layoutNode.outConnectors.length - 1) * CONNECTOR_SIZE;
                        let connectorX = layoutNode.x + (node.width - connectorsWidth) / 2;
                        _.forEach(layoutNode.outConnectors, (connector: LayoutConnector, c: number) => {
                            connector.x = connectorX;
                            connectors.push(connector);
                            connectorX += connector.width + CONNECTOR_SPACING;
                        });
                        if (layoutNode.isScopeNode) {
                            assignXCoordinatesSubgraph(layoutNode.childGraphs[0], layoutNode.x, false, subgraphs, connectors);
                        } else {
                            let childX = layoutNode.padding;
                            _.forEach(layoutNode.childGraphs, (subgraph: LayoutGraph) => {
                                assignXCoordinatesSubgraph(subgraph, childX);
                                childX += subgraph.boundingBox(false).width + this._options["targetEdgeLength"];
                            });
                        }
                    }
                    x += layoutNode.width + this._options["targetEdgeLength"];
                });
            });

            const edgeDistanceVector = (srcConnector: LayoutConnector, dstConnector: LayoutConnector) => {
                return dstConnector.boundingBox().topCenter().sub(srcConnector.boundingBox().bottomCenter());
            }

            if (doPlace) {
                const nodeMap = new Map();
                const connectorMap = new Map();
                const neighbors = new Array(connectors.length);
                _.forEach(connectors, (connector: LayoutConnector, c: number) => {
                    neighbors[c] = [];
                    connectorMap.set(connector, c);
                    let nodeConnectors = nodeMap.get(connector.node);
                    if (nodeConnectors === undefined) {
                        nodeConnectors = [[], []];
                        nodeMap.set(connector.node, nodeConnectors);
                    }
                    nodeConnectors[connector.type === "IN" ? 0 : 1].push(connector);
                });
                const nodesPerRank = new Map();
                _.forEach(subgraphs, (subgraph: LayoutGraph) => {
                    _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                        let srcNode = subgraph.node(edge.src);
                        if (srcNode.isScopeNode) {
                            srcNode = srcNode.childGraphs[0].exitNode;
                        }
                        let srcConnector = srcNode.connector("OUT", edge.srcConnector);
                        let dstNode = subgraph.node(edge.dst);
                        if (dstNode.isScopeNode) {
                            dstNode = dstNode.childGraphs[0].entryNode;
                        }
                        const dstConnector = dstNode.connector("IN", edge.dstConnector);
                        neighbors[connectorMap.get(srcConnector)].push(connectorMap.get(dstConnector));
                    });
                    _.forEach(subgraph.levelGraph().nodes(),(levelNode: LevelNode) => {
                        let nodes = nodesPerRank.get(levelNode.rank);
                        if (nodes === undefined) {
                            nodes = [];
                            nodesPerRank.set(levelNode.rank, nodes);
                        }
                        if (!nodeMap.has(levelNode.layoutNode)) {
                            return;
                        }
                        nodes.push(levelNode.layoutNode);
                    });
                });
                const fieldVector = new Vector(0, 1);
                const forces = new Map();

                // set node border positions
                const nodeBorders = new Map();
                nodeMap.forEach((connectors: [Array<LayoutConnector>, Array<LayoutConnector>], node: LayoutNode) => {
                    const nodeBorderLeft = node.x + node.connectorPadding;
                    const nodeBorderRight = node.x + node.width - node.connectorPadding;
                    nodeBorders.set(node, [nodeBorderLeft, nodeBorderRight]);
                });

                for (let iteration = 0; iteration < this._options.numIterations; ++iteration) {
                    _.forEach(connectors, (connector: LayoutConnector, c: number) => {
                        forces.set(connector, new Vector());
                    });
                    _.forEach(connectors, (connector: LayoutConnector, c: number) => {
                        _.forEach(neighbors[c], (neighborC: number) => {
                            // spring force
                            const edgeVector = edgeDistanceVector(connector, connectors[neighborC]);
                            const strength = Math.log(edgeVector.length() / this._options.targetEdgeLength);
                            const springForce = edgeVector.clone().normalize().multiplyScalar(strength * this._options.weightSpring);
                            /*if (iteration === this._options.numIterations - 1) {
                                console.log("spring force on " + connectors[c].name + " induced by " + connectors[neighborC].name, springForce);
                                console.log("spring force on " + connectors[neighborC].name + " induced by " + connectors[c].name, springForce.clone().invert());
                            }*/
                            forces.get(connectors[c]).add(springForce);
                            forces.get(connectors[neighborC]).add(springForce.clone().invert());
                            // magnetic force
                            if (edgeVector.x === 0 && edgeVector.y > 0) {
                                return;
                            }
                            let magneticDirection = new Vector(1 / edgeVector.x, 1 / edgeVector.y);
                            if (edgeVector.y < 0) {
                                magneticDirection.y *= -1;
                            } else {
                                magneticDirection.x *= -1;
                            }
                            if (edgeVector.x === 0) {
                                magneticDirection = fieldVector.clone();
                            }
                            const angleFactor = Math.pow(edgeVector.absoluteAngleTo(fieldVector), this._options.angleExponent);
                            const distanceFactor = Math.pow(edgeVector.length(), this._options.distanceExponent);
                            const magneticForce = magneticDirection.clone().multiplyScalar(this._options.magneticStrength * angleFactor * distanceFactor * this._options.weightMagnetic);
                            /*if (iteration === this._options.numIterations - 1) {
                                console.log("magnetic force on " + connectors[neighborC].name + " induced by " + connectors[c].name, magneticForce);
                                console.log("magnetic force on " + connectors[c].name + " induced by " + connectors[neighborC].name, magneticForce.clone().invert());
                            }*/
                            forces.get(connectors[neighborC]).add(magneticForce);
                            forces.get(connectors[c]).add(magneticForce.clone().invert());
                        });
                    });
                    nodeMap.forEach((connectors: [Array<LayoutConnector>, Array<LayoutConnector>], node: LayoutNode) => {
                        for (let type = 0; type < 2; ++type) {
                            //inPlaceSort(connectors[type]).asc(c => c.x);
                            for (let i = 0; i < connectors[type].length; ++i) {
                                const connectorI = connectors[type][i];
                                for (let j = i + 1; j < connectors[type].length; ++j) {
                                    const connectorJ = connectors[type][j];
                                    let edgeVectorX = Math.max(Math.abs((connectorI.x + connectorI.width / 2) - (connectorJ.x + connectorJ.width / 2)) - connectorI.width / 2 - connectorJ.width / 2, 0.01);
                                    if (connectorI.x > connectorJ.x) {
                                        edgeVectorX *= -1;
                                    }
                                    const edgeVector = new Vector(edgeVectorX, 0);
                                    const length = edgeVector.length();
                                    const relativeLength = 2 * length / CONNECTOR_SPACING;
                                    const strength = 1 / (relativeLength * relativeLength);
                                    const repulsiveForce = edgeVector.clone().normalize().multiplyScalar(strength * this._options.weightRepulsive);
                                    if (repulsiveForce.length() > CONNECTOR_SPACING / 2) {
                                        repulsiveForce.setLength(CONNECTOR_SPACING / 2);
                                    }
                                    /*if (iteration === this._options.numIterations - 1) {
                                        console.log("repulsive force on " + connectorJ.name + " induced by " + connectorI.name, repulsiveForce);
                                        console.log("repulsive force on " + connectorI.name + " induced by " + connectorJ.name, repulsiveForce.clone().invert());
                                    }*/
                                    repulsiveForce.multiplyScalar(iteration / this._options.numIterations);
                                    //if (iteration > this._options.numIterations / 2) {
                                        forces.get(connectorJ).add(repulsiveForce);
                                        forces.get(connectorI).add(repulsiveForce.clone().invert());
                                    //}
                                }
                            }
                        }
                    });
                    // node walls
                    nodeMap.forEach((connectors: [Array<LayoutConnector>, Array<LayoutConnector>], node: LayoutNode) => {
                        for (let i = 0; i < 2; ++i) {
                            _.forEach(connectors[i], (connector: LayoutConnector) => {
                                const [nodeBorderLeft, nodeBorderRight] = nodeBorders.get(node);
                                const connectorLeft = connector.x;
                                const lengthLeft = connectorLeft - nodeBorderLeft;
                                const strengthLeft = 1 / (lengthLeft * lengthLeft);
                                let forceLeft = strengthLeft * this._options.weightRepulsive;
                                if ((forceLeft > CONNECTOR_SPACING) || (connectorLeft < nodeBorderLeft)) {
                                    forceLeft = CONNECTOR_SPACING;
                                }
                                forces.get(connector).add(new Vector(forceLeft, 0));
                                /*if (iteration === this._options.numIterations - 1) {
                                    console.log("left wall force on " + connector.name, forceLeft, connectorLeft, nodeBorderLeft);
                                }*/
                                const connectorRight = connector.x + connector.width;
                                const lengthRight = nodeBorderRight - connectorRight;
                                const strengthRight = 1 / (lengthRight * lengthRight);
                                let forceRight = strengthRight * this._options.weightRepulsive;
                                if ((forceRight > CONNECTOR_SPACING) || (connectorRight > nodeBorderRight)) {
                                    forceRight = CONNECTOR_SPACING;
                                }
                                forces.get(connector).add(new Vector(-forceRight, 0));
                                /*if (iteration === this._options.numIterations - 1) {
                                    console.log("right wall force on " + connector.name, -forceRight);
                                }*/
                            });
                        }
                    });
                    nodesPerRank.forEach((nodes: Array<LayoutNode>) => {
                        for (let i = 0; i < nodes.length; ++i) {
                            const nodeI = nodes[i];
                            for (let j = i + 1; j < nodes.length; ++j) {
                                const nodeJ = nodes[j];
                                let edgeVectorX = Math.max(Math.abs((nodeI.x + nodeI.width / 2) - (nodeJ.x + nodeJ.width / 2)) - nodeI.width / 2 - nodeJ.width / 2, 1);
                                if (nodeI.x > nodeJ.x) {
                                    edgeVectorX *= -1;
                                }
                                const edgeVector = new Vector(edgeVectorX, 0);
                                const length = edgeVector.length();
                                const relativeLength = 2 * length / this._options.targetEdgeLength;
                                const strength = 1 / (relativeLength * relativeLength);
                                const repulsiveForce = edgeVector.clone().normalize().multiplyScalar(strength * this._options.weightRepulsiveNode);
                                if (repulsiveForce.length() > this._options.targetEdgeLength / 2) {
                                    repulsiveForce.setLength(this._options.targetEdgeLength / 2);
                                }
                                repulsiveForce.multiplyScalar(iteration / this._options.numIterations);
                                //if (iteration > this._options.numIterations / 2) {
                                    for (let type = 0; type < 2; ++type) {
                                        _.forEach(nodeMap.get(nodeJ)[type], (connector: LayoutConnector) => {
                                            forces.get(connector).add(repulsiveForce);
                                            //console.log("node repulsive force on " + connector.name + " induced by " + nodeI.label(), repulsiveForce);
                                        });
                                        _.forEach(nodeMap.get(nodeI)[type], (connector: LayoutConnector) => {
                                            forces.get(connector).add(repulsiveForce.clone().invert());
                                            //console.log("node repulsive force on " + connector.name + " induced by " + nodeJ.label(), repulsiveForce.clone().invert());
                                        });
                                    }
                                //}
                            }
                        }
                    });
                    let maxOffset = 0;
                    _.forEach(connectors, (connector: LayoutConnector) => {
                        const offset = forces.get(connector).clone().multiplyScalar(this._options.stepSize);
                        maxOffset = Math.max(maxOffset, Math.abs(offset.x));
                        offset.multiplyScalar(Math.pow(this._options.decay, iteration))
                        /*if (iteration === this._options.numIterations - 1) {
                            console.log("force on " + connector.name, offset);
                        }*/
                        connector.translate(offset.x, 0);
                    });

                    // enforce scoped connectors being below each other
                    _.forEach(connectors, (connector: LayoutConnector) => {
                        if (connector.isScoped && connector.type === "IN") {
                            const mean = (connector.x + connector.counterpart.x) / 2;
                            connector.x = mean;
                            connector.counterpart.x = mean;
                        }
                    });

                    // move nodes
                    nodeMap.forEach((connectors: [Array<LayoutConnector>, Array<LayoutConnector>], node: LayoutNode) => {
                        let sum = 0;
                        let num = 0;
                        for (let i = 0; i < 2; ++i) {
                            _.forEach(connectors[i], (connector: LayoutConnector) => {
                                sum += connector.x + connector.width / 2;
                                num++;
                            });
                        }
                        const mean = sum / num;
                        const newX = mean - (node.width / 2);
                        if (node.childGraphs.length > 0 && !node.isScopeNode) {
                            node.updatePosition(new Vector(newX, node.y));
                        } else {
                            node.x = newX;
                        }
                        const nodeBorderLeft = node.x + node.connectorPadding;
                        const nodeBorderRight = node.x + node.width - node.connectorPadding;
                        nodeBorders.set(node, [nodeBorderLeft, nodeBorderRight]);
                    });

                    if (maxOffset < EPSILON) {
                        console.log("reached equilibrium after " + (iteration + 1) + " iterations", subgraph.numNodes());
                        break;
                    }
                }

                // place scoped connectors
                _.forEach(connectors, (connector: LayoutConnector) => {
                    if (connector.isScoped) {
                        //connector.counterpart.x = connector.x;
                    }
                });

                // move leftmost node to x = offset
                let minX = Number.POSITIVE_INFINITY;
                nodeMap.forEach((connectors: [Array<LayoutConnector>, Array<LayoutConnector>], node: LayoutNode) => {
                    minX = Math.min(minX, node.x);
                });
                if (minX !== Number.POSITIVE_INFINITY) {
                    const diff = offset - minX;
                    _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                        node.translate(diff, 0);
                    });
                }

                _.forEachRight(subgraphs, (subgraph: LayoutGraph) => {
                    // place self-loops
                    _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                        if (node.selfLoop !== null) {
                            node.selfLoop.points = [
                                new Vector(node.x + node.width + node.padding - this._options["targetEdgeLength"], node.y + node.height - 10),
                                new Vector(node.x + node.width + node.padding, node.y + node.height - 10),
                                new Vector(node.x + node.width + node.padding, node.y + 10),
                                new Vector(node.x + node.width + node.padding - this._options["targetEdgeLength"], node.y + 10),
                            ];
                        }
                    });

                    // set parent bounding box on last component
                    const parent = subgraph.parentNode;
                    if (parent !== null && subgraph === _.last(parent.childGraphs)) {
                        let width = 0;
                        let boundingBox;
                        _.forEach(parent.childGraphs, (childGraph: LayoutGraph, i: number) => {
                            boundingBox = childGraph.boundingBox(false);
                            width += boundingBox.width + this._options["targetEdgeLength"];
                            if (i === 0) {
                                parent.x = boundingBox.x - parent.padding;
                            }
                        });
                        width += 2 * parent.padding - this._options["targetEdgeLength"];
                        if (parent.selfLoop !== null) {
                            width += this._options["targetEdgeLength"];
                        }
                        parent.updateSize({width: width, height: 0});
                        if (parent.isScopeNode) {
                            const left = boundingBox.x;
                            subgraph.entryNode.setWidth(boundingBox.width);
                            subgraph.entryNode.setPosition(new Vector(left, subgraph.entryNode.y));
                            subgraph.exitNode.setWidth(boundingBox.width);
                            subgraph.exitNode.setPosition(new Vector(left, subgraph.exitNode.y));
                        }
                    }
                });

            }
        };
        assignXCoordinatesSubgraph(graph);
    }

    private async _placeEdges(graph: LayoutGraph, rankTops: Array<number>, rankBottoms: Array<number>): Promise<void> {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            const getInPoint = (node: LayoutNode, edge: LayoutEdge): Vector => {
                node = (node.isScopeNode ? node.childGraphs[0].entryNode : node);
                const dstConnector = node.connector("IN", edge.dstConnector);
                return dstConnector.boundingBox().topCenter();
            };

            const getInProxyPoint = (node: LayoutNode, inPoint: Vector): Vector => {
                const proxyPoint = inPoint.clone();
                proxyPoint.y = rankTops[node.rank];
                return proxyPoint;
            };

            const getOutPoint = (node: LayoutNode, edge: LayoutEdge): Vector => {
                node = (node.isScopeNode ? node.childGraphs[0].exitNode : node);
                const srcConnector = node.connector("OUT", edge.srcConnector);
                return srcConnector.boundingBox().bottomCenter();
            };

            const getOutProxyPoint = (node: LayoutNode, outPoint: Vector): Vector => {
                const proxyPoint = outPoint.clone();
                proxyPoint.y = rankBottoms[node.rank + node.rankSpan - 1];
                return proxyPoint;
            };

            // mark nodes that do not need proxies
            const noInProxyNodes = new Set();
            const noOutProxyNodes = new Set();
            _.forEach(subgraph.levelGraph().ranks(), (rank: Array<LevelNode>) => {
                _.forEach(rank, (levelNode: LevelNode, pos: number) => {
                    const node = levelNode.layoutNode;

                    let leftBoundary = Number.NEGATIVE_INFINITY;
                    if (pos > 0) {
                        leftBoundary = rank[pos - 1].layoutNode.boundingBox().right();
                    }
                    let rightBoundary = Number.POSITIVE_INFINITY;
                    if (pos < rank.length - 1) {
                        rightBoundary = rank[pos + 1].layoutNode.boundingBox().left();
                    }

                    if (!node.isVirtual && node.graph.numInEdges(node.id) > 0 && node.inConnectorBundles.length === 0) {
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

            _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                if (edge.isReplica) {
                    return; // replica edges are added with their primary
                }
                let startNode = subgraph.node(edge.src);
                if (startNode.isVirtual) {
                    return; // do not assign points to this edge
                }
                if (startNode.isScopeNode) {
                    startNode = startNode.childGraphs[0].exitNode;
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
                if (endNode.isScopeNode) {
                    endNode = endNode.childGraphs[0].entryNode;
                }
                if (tmpEdge !== null) {
                    edge.dstConnector = tmpEdge.dstConnector;
                }
                const endPoint = getInPoint(endNode, edge);
                const endProxyPoint = (edge.dstBundle !== null ? edge.dstBundle.position() : getInProxyPoint(endNode, endPoint));
                if (!_.isEqual(endProxyPoint, endPoint) && !noInProxyNodes.has(endNode)) {
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

            _.forEach(_.clone(subgraph.nodes()), (node: LayoutNode) => {
                // remove virtual nodes and edges
                if (node.isVirtual) {
                    _.forEach(subgraph.inEdgesIds(node.id), (inEdgeId: number) => {
                        subgraph.removeEdge(inEdgeId);
                    });
                    _.forEach(subgraph.outEdgesIds(node.id), (outEdgeId: number) => {
                        subgraph.removeEdge(outEdgeId);
                    });
                    subgraph.removeNode(node.id);
                }

                // place self-loops visually outside their state
                if (node.selfLoop !== null) {
                    node.setWidth(node.width - this._options["targetEdgeLength"]);
                }
            });
        });
    }

    private _restoreCycles(graph: LayoutGraph): void {
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            if (edge.isInverted) {
                edge.graph.invertEdge(edge.id);
                edge.points = _.reverse(edge.points);
                edge.isInverted = false;
            }
        });
    }

    private _placeConnectors(node: LayoutNode, rankTops: Array<number>, rankBottoms: Array<number>): void {
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
            } else if (outPointer === node.outConnectors.length) {
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
        _.forEach(node.connectors(), (connector: LayoutConnector) => {
            connector.translate(auxBox.x - node.x + (connector.isTemporary ? SPACE / 2 : 0), connector.isTemporary ? SPACE / 2 : 0);
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

    private _markCrossings(subgraph: LayoutGraph, segmentsPerRank: Array<Array<Segment>>,
                           crossingsPerRank: Array<Array<[Segment, Segment]>>, rankTops: Array<number>,
                           rankBottoms: Array<number>): void {
        const endpointsPerRank = new Array(rankTops.length);
        for (let r = 1; r < rankTops.length; ++r) {
            endpointsPerRank[r] = [];
        }
        _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
            _.forEach(edge.rawSegments(), (segment: Segment) => {
                let startRank = _.sortedIndex(rankBottoms, segment.start.y);
                if ((startRank < rankTops.length - 1) && (segment.end.y >= rankTops[startRank + 1])) {
                    let start = segment.start.clone();
                    if (segment.start.y < rankBottoms[startRank]) {
                        start.add(segment.vector().setY(rankBottoms[startRank] - segment.start.y));
                    }
                    let end = segment.end.clone();
                    if (segment.end.y > rankTops[startRank + 1]) {
                        end = start.clone().add(segment.vector().setY(this._options["targetEdgeLength"]));
                    }
                    segment = new Segment(start, end);
                    endpointsPerRank[startRank + 1].push([segment.start, segment]);
                    endpointsPerRank[startRank + 1].push([segment.end, segment]);
                    segmentsPerRank[startRank + 1].push(segment);
                }
            });
        });
        for (let r = 1; r < rankTops.length; ++r) {
            const pointsSorted = _.sortBy(endpointsPerRank[r], ([point, segment]) => point.x); // sort by x

            const openSegments: Set<Segment> = new Set();
            _.forEach(pointsSorted, ([point, segment]) => {
                if (openSegments.has(segment)) {
                    openSegments.delete(segment);
                } else {
                    openSegments.forEach((otherSegment) => {
                        if ((segment.start.x !== otherSegment.start.x) &&
                            (segment.end.x !== otherSegment.end.x)) {
                            crossingsPerRank[r].push([segment, otherSegment]);
                        }
                    });
                    openSegments.add(segment);
                }
            });
        }
    }

    private _optimizeAngles(layoutGraph: LayoutGraph, segmentsPerRank: Array<Array<Segment>>,
                            crossingsPerRank: Array<Array<[Segment, Segment]>>): void {
        const forces = [];
        _.forEach(crossingsPerRank, (crossings, r) => {
            let maxForce = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            const deltaXs = [];
            _.forEach(crossings, ([segmentA, segmentB]) => {
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
                _.forEach(segmentsPerRank[r], (segment: Segment) => {
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
                        cost += this._options["weightCrossings"] * (Math.cos(2 * angle) + 1) / 2;
                    });
                    const deltaYSquared = deltaY * deltaY;
                    _.forEach(allDeltaXsSquared, deltaXSquared => {
                        cost += this._options["weightLengths"] * Math.sqrt(deltaYSquared + deltaXSquared) / this._options["targetEdgeLength"];
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
        if (DEBUG) {
            Assert.assertEqual(sortedForces, forces, "forces are not sorted");
        }

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
                    // new_height = old_height + totalForce + old_top - new_top
                    object.height += totalForce + oldTops.get(object) - object.y;
                    const heightDiff = object.height - oldHeight;
                    _.forEach(object.outConnectors, (connector: LayoutConnector) => {
                        connector.y += heightDiff;
                    });
                }
            } else { // "EDGE"
                object.points[position].y += totalForce;
            }
        });
    }
}
