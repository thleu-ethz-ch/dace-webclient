import {DEBUG} from "../util/constants";
import {inPlaceSort} from "fast-sort";
import * as _ from "lodash";
import Assert from "../util/assert";
import Component from "../graph/component";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Timer from "../util/timer";
import Shuffle from "../util/shuffle";
import Wasm from "../wasm/wasm";

interface Neighbor {
    end: number;
    weight: number;
}

export default class OrderGraph {
    private _rankGraph: Graph<OrderRank, Edge<any, any>>;
    private _groupGraph: Graph<OrderGroup, Edge<any, any>>;
    private _nodeGraph: Graph<OrderNode, Edge<any, any>>;

    private _groupEdgesAdded: boolean = false;
    private _wasm: Wasm;

    constructor(wasm: Wasm = null) {
        this._rankGraph = new Graph<OrderRank, Edge<any, any>>();
        this._groupGraph = new Graph<OrderGroup, Edge<any, any>>();
        this._nodeGraph = new Graph<OrderNode, Edge<any, any>>();
        this._wasm = wasm;
    }

    toString(): string {
        const obj = {
            nodes: {},
            edges: [],
        };
        _.forEach(_.sortBy(this.groups(), "position"), (group: OrderGroup) => {
            obj.nodes[group.id] = {
                label: group.label(),
                child: {
                    nodes: {},
                    edges: [],
                },
            };
            _.forEach(group.orderedNodes(), (node: OrderNode) => {
                obj.nodes[group.id].child.nodes[node.id] = {
                    label: node.label(),
                    child: null
                };
            });
        });
        _.forEach(this.groupEdges(), (edge: Edge<any, any>) => {
            obj.edges.push({src: edge.src, dst: edge.dst, weight: edge.weight});
        });
        return JSON.stringify(obj);
    }

    public addRank(rank: OrderRank, id: number = null): number {
        rank.orderGraph = this;
        return this._rankGraph.addNode(rank, id);
    }

    public addGroup(group: OrderGroup, id: number = null): number {
        return this._groupGraph.addNode(group, id);
    }

    public addNode(node: OrderNode, id: number = null): number {
        return this._nodeGraph.addNode(node, id);
    }

    public removeNode(id: number): void {
        this._nodeGraph.removeNode(id);
    }

    public addEdge(edge: Edge<any, any>, id: number = null): number {
        return this._nodeGraph.addEdge(edge, id);
    }

    public removeEdge(id: number): void {
        this._nodeGraph.removeEdge(id);
    }

    private _addGroupEdges(): void {
        if (!this._groupEdgesAdded) {
            this._groupEdgesAdded = true;
            _.forEach(this._nodeGraph.edges(), (edge: Edge<any, any>) => {
                const srcGroupId = this._nodeGraph.node(edge.src).group.id;
                const dstGroupId = this._nodeGraph.node(edge.dst).group.id;
                const groupEdge = this._groupGraph.edgeBetween(srcGroupId, dstGroupId);
                if (groupEdge === undefined) {
                    this._groupGraph.addEdge(new Edge(srcGroupId, dstGroupId, edge.weight));
                } else {
                    groupEdge.weight += edge.weight;
                }
            });
        }
    }

    private _addRankEdges(): void {
        _.forEach(this._groupGraph.edges(), (edge: Edge<any, any>) => {
            const srcRankId = this._groupGraph.node(edge.src).rank.id;
            const dstRankId = this._groupGraph.node(edge.dst).rank.id;
            if (!this._rankGraph.hasEdge(srcRankId, dstRankId)) {
                this._rankGraph.addEdge(new Edge(srcRankId, dstRankId));
            }
        });
    }

    public node(id: number): OrderNode {
        return this._nodeGraph.node(id);
    }

    public group(id: number): OrderGroup {
        return this._groupGraph.node(id);
    }

    public nodes(): Array<OrderNode> {
        return this._nodeGraph.nodes();
    }

    public groups(): Array<OrderGroup> {
        return this._groupGraph.nodes();
    }

    public ranks(): Array<OrderRank> {
        return this._rankGraph.toposort();
    }

    public edges(): Array<Edge<any, any>> {
        return this._nodeGraph.edges();
    }

    public inEdges(id: number): Array<Edge<any, any>> {
        return this._nodeGraph.inEdges(id);
    }

    public outEdges(id: number): Array<Edge<any, any>> {
        return this._nodeGraph.outEdges(id);
    }

    public inNeighbors(id: number): Array<OrderNode> {
        return this._nodeGraph.inNeighbors(id);
    }

    public outNeighbors(id: number): Array<OrderNode> {
        return this._nodeGraph.outNeighbors(id);
    }

    public incidentEdges(id: number): Array<Edge<any, any>> {
        return this._nodeGraph.incidentEdges(id);
    }

    public edgeBetween(srcId: number, dstId: number): Edge<any, any> {
        return this._nodeGraph.edgeBetween(srcId, dstId);
    }

    public maxId(): number {
        return this._nodeGraph.maxId();
    }

    public groupEdges(): Array<Edge<any, any>> {
        this._addGroupEdges();
        return this._groupGraph.edges();
    }

    public async order(options: object = {}): Promise<number> {
        if (this._nodeGraph.numNodes() === 0) {
            return;
        }
        Timer.start(["doLayout", "orderRanks", "doOrder", "order"]);
        options = _.defaults(options, {
            method: "barycenter",
            debug: false,
            countOnly: false,
            orderGroups: false,
            countInitial: false,
            resolveConflicts: true,
            resolveX: true,
            shuffles: 0,
        });
        let groupOffsetsPos, numNodesPerGroup, groupOrder, groupPositions, order, positions, neighbors, crossings, virtual, intranode, sink, numEdgesPerRank;

        const doOrderSprings = async (graph: OrderGraph) => {
            // store new positions
            const ranks = graph._rankGraph.toposort();
            _.forEach(ranks, (rank: OrderRank) => {
                _.forEach(rank.groups, (group: OrderGroup) => {
                    group.orderNodesByX();
                });
                rank.orderGroupsByX();
            });
        };

        const doOrder = async (graph: OrderGraph) => {
            const assertNeighborCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertNeighborCoherence(r));
                    return;
                }
                _.forEach(neighbors[r][1], (neighborsPerNode, nodeId) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighbors[r + 1][0][neighbor].indexOf(nodeId) !== -1, "neighbor in rank " + (r + 1) + " is missing upNeighbor");
                });
                _.forEach(neighbors[r][0], (neighborsPerNode, nodeId) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighbors[r - 1][1][neighbor].indexOf(nodeId) !== -1, "neighbor in rank " + (r - 1) + "is missing downNeighbor");
                });
            }

            const assertOrderAndPositionCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertOrderAndPositionCoherence(r));
                    return;
                }
                Assert.assertAll(order[r], (nodeId, pos) => positions[nodeId] === pos, "positions and orders do not match");
            }

            const assertEdgesBetweenNeighboringRanks = () => {
                Assert.assertAll(this.edges(), edge => {
                    return this.node(edge.src).rank + 1 === this.node(edge.dst).rank;
                }, "edge not between neighboring ranks");
            }

            Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder"]);
            Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "setup"]);

            const numRanks = graph._rankGraph.numNodes();

            let minRank = Number.POSITIVE_INFINITY;
            const ranks = graph._rankGraph.toposort();
            groupOrder.length = numRanks;
            order.length = numRanks;
            crossings.length = numRanks;
            numEdgesPerRank.length = numRanks;

            let maxEdgesPerRank = 0;
            let maxEdgeWeight = 0;
            // set neighbors
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                let offset = 0;
                minRank = Math.min(minRank, rank.rank);
                order[r] = new Array(_.sum(_.map(rank.groups, group => numNodesPerGroup[group.id])));
                groupOrder[r] = new Array(rank.groups.length);
                crossings[r] = Number.POSITIVE_INFINITY;
                numEdgesPerRank[r] = 0;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, groupPos: number) => {
                    groupOffsetsPos[group.id] = offset;
                    numNodesPerGroup[group.id] = group.nodes.length;
                    offset += group.nodes.length;
                    groupOrder[r][groupPos] = group.id;
                    groupPositions[group.id] = groupPos;
                    _.forEach(group.orderedNodes(), (node: OrderNode, posInGroup: number) => {
                        node.rank = r;
                        const pos = groupOffsetsPos[group.id] + posInGroup;
                        order[r][pos] = node.id;
                        positions[node.id] = pos;
                        neighbors[0][node.id] = [];
                        neighbors[1][node.id] = [];
                        _.forEach(graph._nodeGraph.inEdges(node.id), (edge: Edge<any, any>) => {
                            neighbors[0][node.id].push({
                                end: edge.src,
                                weight: edge.weight,
                            });
                            maxEdgeWeight = Math.max(maxEdgeWeight, edge.weight === Number.POSITIVE_INFINITY ? 1 : edge.weight);
                        });
                        _.forEach(graph._nodeGraph.outEdges(node.id), (edge: Edge<any, any>) => {
                            neighbors[1][node.id].push({
                                end: edge.dst,
                                weight: edge.weight,
                            });
                        });
                        numEdgesPerRank[r] += graph._nodeGraph.numInEdges(node.id);
                    });
                });
                maxEdgesPerRank = Math.max(maxEdgesPerRank, numEdgesPerRank[r]);

                if (DEBUG) {
                    assertOrderAndPositionCoherence(r);
                }
            });

            crossings[0] = 0;

            Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "setup"]);

            const countCrossings = (testOrder: Array<number>, r: number, direction: number = 0, preventConflicts: boolean = false) => {
                if (preventConflicts) {
                    const originalOrder = _.clone(order[r]);
                    order[r] = _.clone(testOrder);
                    _.forEach(order[r], (nodeId: number, pos: number) => {
                        positions[nodeId] = pos;
                    });
                    let hasConflict = false;
                    if (r > 0) {
                        hasConflict = hasConflict || (getConflict("HEAVYHEAVY", r) !== null) || (getConflict("HEAVYLIGHT", r) !== null);
                    }
                    if (r < ranks.length - 1) {
                        hasConflict = hasConflict || (getConflict("HEAVYHEAVY", r + 1) !== null) || (getConflict("HEAVYLIGHT", r + 1) !== null);
                    }
                    order[r] = _.clone(originalOrder);
                    _.forEach(order[r], (nodeId: number, pos: number) => {
                        positions[nodeId] = pos;
                    });
                    if (hasConflict) {
                        return Number.POSITIVE_INFINITY;
                    }
                }
                const edges = [];
                const northR = (direction === 0 ? (r - 1) : (r + 1));

                for (let southPos = 0; southPos < testOrder.length; ++southPos) {
                    const southNodeId = testOrder[southPos];
                    for (let neighbor = 0; neighbor < neighbors[direction][southNodeId].length; ++neighbor) {
                        let weight = neighbors[direction][southNodeId][neighbor].weight;
                        if (weight === Number.POSITIVE_INFINITY) {
                            weight = 1;
                        }
                        edges.push([southPos, positions[neighbors[direction][southNodeId][neighbor].end], weight]);
                    }
                }
                // north and south are swapped compared to the _countCrossings signature
                // result is the same, but this is faster in ordering the edges
                return this._countCrossings(testOrder.length, order[northR].length, edges);
            };

            const changeNodePosInOrder = (oldOrder: Array<number>, oldPos: number, newPos: number) => {
                const newOrder = new Array(oldOrder.length);
                if (oldPos < newPos) {
                    for (let pos = 0; pos < oldPos; ++pos) {
                        newOrder[pos] = oldOrder[pos];
                    }
                    for (let pos = oldPos + 1; pos <= newPos; ++pos) {
                        newOrder[pos - 1] = oldOrder[pos];
                    }
                    newOrder[newPos] = oldOrder[oldPos];
                    for (let pos = newPos + 1; pos < oldOrder.length; ++pos) {
                        newOrder[pos] = oldOrder[pos];
                    }
                } else {
                    for (let pos = 0; pos < newPos; ++pos) {
                        newOrder[pos] = oldOrder[pos];
                    }
                    newOrder[newPos] = oldOrder[oldPos];
                    for (let pos = newPos; pos < oldPos; ++pos) {
                        newOrder[pos + 1] = oldOrder[pos];
                    }
                    for (let pos = oldPos + 1; pos < oldOrder.length; ++pos) {
                        newOrder[pos] = oldOrder[pos];
                    }
                }
                return newOrder;
            };

            /**
             * Sweeps the ranks up and down and reorders the nodes according to the barycenter heuristic
             * @param shuffle
             * @param shuffleNodes
             * @param startRank
             * @param preventConflicts
             */
            const reorder = (shuffle: boolean = false, shuffleNodes: boolean = false, startRank: number = 0, preventConflicts: boolean = false) => {
                Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "reorder"]);
                const multiplicator = maxEdgeWeight * maxEdgesPerRank + 1;
                if (shuffle) {
                    _.forEach(ranks, (rank: OrderRank, r: number) => {
                        if (options["orderGroups"]) {
                            let maxLevel = _.maxBy(rank.groups, group => group.shuffleHierarchy.length).shuffleHierarchy.length - 1;
                            let deepOrder = _.clone(groupOrder[r]);
                            for (let level = maxLevel; level >= 0; --level) {
                                let nextDeepOrder = [];
                                let prevParent = undefined;
                                let sameParentSequence = [];
                                _.forEach(deepOrder, (groupIds: any) => {
                                    let groupId = groupIds;
                                    while (Array.isArray(groupId)) {
                                        groupId = groupId[0];
                                    }
                                    const parent = graph.group(groupId).shuffleHierarchy[level];
                                    if (parent === undefined) {
                                        nextDeepOrder.push(groupIds);
                                        return;
                                    }
                                    if (parent === prevParent) {
                                        sameParentSequence.push(groupIds);
                                    } else {
                                        if (prevParent !== undefined) {
                                            nextDeepOrder.push(Shuffle.shuffle(sameParentSequence));
                                        }
                                        sameParentSequence = [groupIds];
                                    }
                                    prevParent = parent;
                                });
                                nextDeepOrder.push(Shuffle.shuffle(sameParentSequence));
                                deepOrder = _.clone(nextDeepOrder);
                            }
                            groupOrder[r] = _.flattenDeep(deepOrder);
                            this._setGroupPositionAndOffset(groupOrder[r], groupPositions, groupOffsetsPos, numNodesPerGroup);
                            _.forEach(groupOrder[r], (groupId: number) => {
                                let nodeIds = _.slice(order[r], groupOffsetsPos[groupId], groupOffsetsPos[groupId] + numNodesPerGroup[groupId]);
                                if (shuffleNodes) {
                                    nodeIds = Shuffle.shuffle(nodeIds);
                                }
                                _.forEach(nodeIds, (nodeId: number, posInGroup: number) => {
                                    order[r][groupOffsetsPos[groupId] + posInGroup] = nodeId;
                                });
                            });
                            _.forEach(order[r], (nodeId: number, pos: number) => {
                                positions[nodeId] = pos;
                            });
                        } else {
                            _.forEach(groupOrder[r], (groupId: number) => {
                                const nodeIds = Shuffle.shuffle(_.slice(order[r], groupOffsetsPos[groupId], groupOffsetsPos[groupId] + numNodesPerGroup[groupId]));
                                _.forEach(nodeIds, (nodeId: number, posInGroup: number) => {
                                    order[r][groupOffsetsPos[groupId] + posInGroup] = nodeId;
                                    positions[nodeId] = groupOffsetsPos[groupId] + posInGroup;
                                });
                            });
                        }
                    });
                }

                let boolDirection = 1;
                let boolOppositeDirection = 0;
                let signDirection = 1;
                let minCrossings = _.sum(crossings);
                let improveCounter = 2;
                while (improveCounter > 0) {
                    improveCounter--;
                    if (options["debug"]) {
                        console.log("TOTAL CROSSINGS", _.sum(crossings));
                    }
                    let firstRank = boolDirection ? startRank + 1 : ranks.length - 2;
                    let lastRank = boolDirection ? ranks.length - 1 : startRank;
                    const crossingOffsetNorth = boolDirection ? 0 : 1;
                    const crossingOffsetSouth = boolDirection ? 1 : 0;
                    const northDirection = boolDirection ? 0 : 1;
                    const southDirection = boolDirection ? 1 : 0;
                    if (options["debug"]) {
                        console.log(boolDirection ? "DOWN" : "UP");
                    }
                    for (let r = firstRank; r - signDirection !== lastRank; r += signDirection) {
                        if (DEBUG) {
                            assertOrderAndPositionCoherence(r);
                        }
                        if (options["debug"]) {
                            console.log("rank", r);
                        }

                        if (crossings[r + crossingOffsetNorth] === 0) {
                            // no need to reorder
                            if (options["debug"]) {
                                console.log("skip because already 0");
                            }
                            continue;
                        }

                        const tryNewOrder = (newOrder) => {
                            // count crossings with new order
                            const prevCrossingsNorth = crossings[r + crossingOffsetNorth];
                            const newCrossingsNorth = countCrossings(newOrder, r, northDirection, preventConflicts);

                            let newCrossingsSouth = 0;
                            let prevCrossingsSouth = 0;
                            if (r !== lastRank) {
                                prevCrossingsSouth = crossings[r + crossingOffsetSouth];
                                newCrossingsSouth = countCrossings(newOrder, r, southDirection, preventConflicts);
                            }
                            const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
                            //const fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth);
                            if (fewerCrossingsNorth) {
                                if (options["debug"]) {
                                    console.log("fewer crossings north", prevCrossingsNorth, "->", newCrossingsNorth, "south: ", prevCrossingsSouth, "->", newCrossingsSouth);
                                }
                                crossings[r + crossingOffsetNorth] = newCrossingsNorth;
                                if (r !== lastRank) {
                                    crossings[r + crossingOffsetSouth] = newCrossingsSouth;
                                }
                                order[r] = _.cloneDeep(newOrder);
                                _.forEach(order[r], (nodeId: number, pos: number) => {
                                    positions[nodeId] = pos;
                                });
                                const fewerCrossingsTotal = (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth);
                                return (1 + (fewerCrossingsTotal ? 1 : 0));
                            } else {
                                if (options["debug"]) {
                                    console.log("not fewer crossings north", prevCrossingsNorth, "->", newCrossingsNorth, "south: ", prevCrossingsSouth, "->", newCrossingsSouth);
                                }
                                return 0;
                            }
                        };

                        const newNodeOrder = new Array(order[r].length);
                        let hasChanged = true;
                        while (hasChanged) {
                            hasChanged = false;
                            let groupMeans = [];
                            _.forEach(groupOrder[r], (groupId: number) => {
                                // calculate mean position of neighbors
                                let nodeMeans = [];
                                let groupSum = 0;
                                let groupNum = 0;
                                for (let pos = groupOffsetsPos[groupId]; pos < groupOffsetsPos[groupId] + numNodesPerGroup[groupId]; ++pos) {
                                    const nodeId = order[r][pos];
                                    let sum = 0;
                                    let num = 0;
                                    for (let neighbor = 0; neighbor < neighbors[boolOppositeDirection][nodeId].length; ++neighbor) {
                                        let weight = neighbors[boolOppositeDirection][nodeId][neighbor].weight;
                                        if (weight === Number.POSITIVE_INFINITY) {
                                            weight = 1;
                                        }
                                        const neighborPos = positions[neighbors[boolOppositeDirection][nodeId][neighbor].end];
                                        sum += weight * neighborPos;
                                        num += weight;
                                    }
                                    if (num > 0) {
                                        nodeMeans.push([nodeId, multiplicator * sum / num + pos]);
                                    } else {
                                        nodeMeans.push([nodeId, multiplicator * pos + pos]);
                                    }
                                    groupSum += sum;
                                    groupNum += num;
                                }

                                // sort by the means
                                inPlaceSort(nodeMeans).asc(pair => pair[1]);
                                if (options["debug"]) {
                                    console.log("node means: ", _.map(nodeMeans, pair => graph.node(pair[0]).label() + ": " + pair[1]));
                                }

                                for (let posInGroup = 0; posInGroup < numNodesPerGroup[groupId]; ++posInGroup) {
                                    newNodeOrder[groupOffsetsPos[groupId] + posInGroup] = nodeMeans[posInGroup][0];
                                }

                                if (groupNum > 0) {
                                    groupMeans.push([groupId, multiplicator * groupSum / groupNum + groupPositions[groupId]]);
                                } else {
                                    groupMeans.push([groupId, multiplicator * groupPositions[groupId] + groupPositions[groupId]]);
                                }
                            });

                            if (options["orderGroups"]) {
                                // reorder groups
                                inPlaceSort(groupMeans).asc(pair => pair[1]);
                                const newGroupOrder = _.map(groupMeans, "0");
                                const changes = this._getChanges(newGroupOrder, groupPositions);
                                for (let c = 0; c < changes.length; ++c) {
                                    const tmpGroupOrder = new Array(order[r]);
                                    for (let pos = 0; pos < groupOrder[r].length; ++pos) {
                                        tmpGroupOrder[pos] = groupOrder[r][pos];
                                    }
                                    for (let pos = changes[c][0]; pos <= changes[c][1]; ++pos) {
                                        tmpGroupOrder[pos] = newGroupOrder[pos];
                                    }
                                    // transform new group order to node order
                                    const tmpOrder = [];
                                    _.forEach(tmpGroupOrder, (groupId: number) => {
                                        for (let posInGroup = 0; posInGroup < numNodesPerGroup[groupId]; ++posInGroup) {
                                            tmpOrder.push(order[r][groupOffsetsPos[groupId] + posInGroup]);
                                        }
                                    });

                                    const result = tryNewOrder(tmpOrder);
                                    if (result > 0) {
                                        // store new group order
                                        groupOrder[r] = tmpGroupOrder;
                                        this._setGroupPositionAndOffset(groupOrder[r], groupPositions, groupOffsetsPos, numNodesPerGroup);
                                        hasChanged = true;
                                    }
                                }
                            }

                            if (!hasChanged) {
                                // reorder nodes
                                const changes = this._getChanges(newNodeOrder, positions);
                                for (let c = 0; c < changes.length; ++c) {
                                    const tmpOrder = new Array(order[r]);
                                    for (let pos = 0; pos < order[r].length; ++pos) {
                                        tmpOrder[pos] = order[r][pos];
                                    }
                                    for (let pos = changes[c][0]; pos <= changes[c][1]; ++pos) {
                                        tmpOrder[pos] = newNodeOrder[pos];
                                    }
                                    if (options["debug"]) {
                                        console.log("tmpOrder", _.map(tmpOrder, nodeId => graph.node(nodeId).label()));
                                    }
                                    const result = tryNewOrder(tmpOrder);
                                    if (result > 0) {
                                        hasChanged = true;
                                    }
                                }
                            }
                        }
                        if (DEBUG) {
                            assertOrderAndPositionCoherence(r);
                        }
                    }
                    boolDirection = boolOppositeDirection;
                    boolOppositeDirection = boolDirection ? 0 : 1;
                    signDirection *= -1;
                    for (let r = 1; r < ranks.length; ++r) {
                        if (crossings[r]  === Number.POSITIVE_INFINITY) {
                            crossings[r] = countCrossings(order[r], r);
                        }
                    }
                    const newCrossings = _.sum(crossings);
                    if (newCrossings < minCrossings) {
                        minCrossings = newCrossings;
                        improveCounter = 2;
                    }
                }

                for (let r = 0; r < ranks.length; ++r) {
                    _.forEach(order[r], (nodeId: number, pos: number) => {
                        positions[nodeId] = pos;
                    });
                    this._setGroupPositionAndOffset(groupOrder[r], groupPositions, groupOffsetsPos, numNodesPerGroup);
                }

                Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "reorder"]);
            };

            /*const getConflict = (type: "HEAVYHEAVY" | "HEAVYLIGHT", r: number, skipIfZero: boolean = false): [number, number ,number, number, number] => {
                if (skipIfZero && crossings[r] === 0) {
                    // there is no conflict in this rank
                    return null;
                }
                const segmentStarts = [];
                const segmentEnds = [];
                for (let n = 0; n < Math.max(order[r - 1].length); ++n) {
                    segmentStarts[n] = [];
                }
                for (let n = 0; n < Math.max(order[r].length); ++n) {
                    segmentEnds[n] = [];
                }
                for (let n = 0; n < order[r].length; ++n) {
                    const nodeId = order[r][n];
                    const posSouth = positions[nodeId];
                    for (let neighbor = 0; neighbor < neighbors[0][nodeId].length; ++neighbor) {
                        const posNorth = positions[neighbors[0][nodeId][neighbor].end];
                        const heavy = (neighbors[0][nodeId][neighbor].weight === Number.POSITIVE_INFINITY);
                        if (type === "HEAVYHEAVY" && !heavy) {
                            continue;
                        }
                        const intranode = (heavy && graph.node(nodeId).isVirtual);
                        if (type === "HEAVYLIGHT" && heavy && !intranode) {
                            continue;
                        }
                        const segment = [posNorth, posSouth, heavy];
                        if (segmentStarts[posNorth] === undefined) {
                            console.log(neighbors);
                            console.log(nodeId, neighbors[0][nodeId], neighbor, posNorth, segmentStarts.length);
                        }
                        segmentStarts[posNorth].push(segment);
                        segmentEnds[posSouth].push(segment);
                    }
                }
                const openSegments: Set<[number, number, boolean]> = new Set();
                for (let n = 0; n < Math.max(order[r].length, order[r - 1].length); ++n) {
                    _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                        const [posNorth, posSouth] = segment;
                        if (posNorth >= posSouth) {
                            openSegments.delete(segment);
                        }
                    });
                    _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                        const [posNorth, posSouth] = segment;
                        if (posNorth < posSouth) { // equality handled in loop above
                            openSegments.delete(segment);
                        }
                    });
                    const newSegments = [];
                    _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                        const [posNorth, posSouth] = segment;
                        if (posNorth <= posSouth) {
                            newSegments.push(segment);
                        }
                    });
                    _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                        const [posNorth, posSouth] = segment;
                        if (posNorth > posSouth) { // equality handled in loop above
                            newSegments.push(segment);
                        }
                    });
                    for (let newSegment of newSegments) {
                        const [posNorth, posSouth, heavy] = newSegment;
                        let newDir = Math.sign(posSouth - posNorth);
                        for (let openSegment of openSegments) {
                            const [openPosNorth, openPosSouth, openHeavy] = openSegment;
                            // dir is
                            let openDir = Math.sign(openPosSouth - openPosNorth);
                            if ((newDir !== openDir) || (newDir === 1 && posSouth < openPosSouth) || (posNorth < openPosNorth)) {
                                // segments have different direction or new segment is more vertical
                                if (openHeavy) {
                                    return [r, openPosNorth, openPosSouth, posNorth, posSouth];
                                } else if (heavy) {
                                    return [r, posNorth, posSouth, openPosNorth, openPosSouth];
                                }
                            }
                        }
                        if (newDir !== 0) {
                            openSegments.add(newSegment);
                        }
                    }
                }
                return null;
            }*/

            const getConflict = (type: "HEAVYHEAVY" | "HEAVYLIGHT", r: number, skipIfZero: boolean = false): [number, number ,number, number, number] => {
                if (skipIfZero && crossings[r] === 0) {
                    // there is no conflict in this rank
                    return null;
                }
                let heavyLeftNorth = -1;
                let heavyLeftSouth = -1;
                let pos = 0;
                for (let tmpPos = 0; tmpPos < order[r].length; ++tmpPos) {
                    const tmpNodeId = order[r][tmpPos];
                    let hasHeavy = _.some(neighbors[0][tmpNodeId], neighbor => neighbor.weight === Number.POSITIVE_INFINITY);
                    if (type === "HEAVYLIGHT") {
                        hasHeavy &&= intranode[tmpNodeId];
                    }
                    if (tmpPos === order[r].length - 1 || hasHeavy) {
                        let heavyRightNorth = order[r - 1].length;
                        let heavyRightSouth = order[r].length;
                        if (hasHeavy) {
                            heavyRightNorth = positions[neighbors[0][tmpNodeId][0].end];
                            heavyRightSouth = tmpPos;
                        }
                        while (pos <= tmpPos) {
                            const nodeId = order[r][pos];
                            for (let neighbor = 0; neighbor < neighbors[0][nodeId].length; ++neighbor) {
                                if (type === "HEAVYLIGHT" || neighbors[0][nodeId][neighbor].weight === Number.POSITIVE_INFINITY) {
                                    const neighborPos = positions[neighbors[0][nodeId][neighbor].end];
                                    if (neighborPos < heavyLeftNorth) {
                                        return [r, heavyLeftNorth, heavyLeftSouth, neighborPos, pos];
                                    }
                                    if (neighborPos > heavyRightNorth) {
                                        return [r, heavyRightNorth, heavyRightSouth, neighborPos, pos];
                                    }
                                }
                            }
                            pos++;
                        }
                        heavyLeftNorth = heavyRightNorth;
                        heavyLeftSouth = heavyRightSouth;
                    }
                }
                return null;
            }

            let step = 0;

            const storeLocal = () => {
                if (typeof window === "undefined") {
                    return;
                }
                step++;
                if (step === 1) {
                    const obj = [];
                    window.localStorage.setItem("orderGraph", JSON.stringify(obj));
                }
                const obj = JSON.parse(window.localStorage.getItem("orderGraph"));
                _.forEach(ranks, (rank: OrderRank, r: number) => {
                    _.forEach(rank.groups, (group: OrderGroup) => {
                        _.forEach(group.nodes, (node: OrderNode) => {
                            node.position = positions[node.id];
                        });
                        group.orderNodes();
                        group.position = groupPositions[group.id];
                    });
                    rank.orderGroups();
                });
                const stepObj = {ranks: [], edges: []};
                _.forEach(ranks, (rank: OrderRank) => {
                    const rankObj = [];
                    _.forEach(rank.orderedGroups(), (group: OrderGroup) => {
                        const groupObj = {label: group.label(), nodes: []};
                        _.forEach(group.orderedNodes(), (node: OrderNode) => {
                            groupObj.nodes.push({id: node.id, label: node.label(), isVirtual: node.isVirtual});
                        });
                        rankObj.push(groupObj);
                    });
                    stepObj.ranks.push(rankObj);
                });
                _.forEach(graph.edges(), edge => {
                    stepObj.edges.push({
                        src: edge.src,
                        dst: edge.dst,
                        weight: edge.weight === Number.POSITIVE_INFINITY ? "INFINITY" : edge.weight
                    });
                });
                obj.push(stepObj);
                window.localStorage.setItem("orderGraph", JSON.stringify(obj));
            };

            /**
             * Tries to resolve illegal crossings, i. e. crossings of edges with infinite weight.
             */
            const resolveConflicts = () => {
                if (DEBUG) {
                    Assert.assertAll(_.range(ranks.length), r => groupOrder[r].length === 1, "conflict resolution with more than one group per rank");
                }
                Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve"]);

                for (let r = 0; r < order.length; ++r) {
                    _.forEach(ranks[r].groups[0].nodes, (node: OrderNode) => {
                        virtual[node.id] = node.isVirtual;
                        intranode[node.id] = node.isIntranode;
                        sink[node.id] = (graph._nodeGraph.numOutEdges(node.id) === 0);
                    });
                }

                const resolveConflict = (isHeavyHeavy: boolean, conflict: [number, number, number, number, number]) => {
                    Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict"]);

                    const [r, crossedNorthPos, crossedSouthPos, crossingNorthPos, crossingSouthPos] = conflict;

                    const crossedNorthNodeId = order[r - 1][crossedNorthPos];
                    const crossedNorthNode = graph.node(crossedNorthNodeId);
                    const crossedSouthNodeId = order[r][crossedSouthPos];
                    const crossedSouthNode = graph.node(crossedSouthNodeId);
                    const crossingNorthNodeId = order[r - 1][crossingNorthPos];
                    let crossingNorthNode = graph.node(crossingNorthNodeId);
                    const crossingSouthNodeId = order[r][crossingSouthPos];
                    let crossingSouthNode = graph.node(crossingSouthNodeId);
                    let crossingEdge;

                    const resolveHeavyHeavy = () => {
                        Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveHeavyHeavy"]);
                        if (options["debug"]) {
                            console.log("resolveHeavyHeavy");
                        }

                        const tmpOrderA = changeNodePosInOrder(order[r], crossingSouthPos, crossedSouthPos);
                        const tmpOrderB = changeNodePosInOrder(order[r], crossedSouthPos, crossingSouthPos);

                        let crossingsANorth = countCrossings(tmpOrderA, r, 0);
                        let crossingsBNorth = countCrossings(tmpOrderB, r, 0);
                        let crossingsASouth = 0;
                        let crossingsBSouth = 0;
                        if (r < ranks.length - 1) {
                            crossingsASouth = countCrossings(tmpOrderA, r, 1);
                            crossingsBSouth = countCrossings(tmpOrderB, r, 1);
                        }
                        if ((crossingsANorth + crossingsASouth) < (crossingsBNorth + crossingsBSouth)) {
                            order[r] = tmpOrderA;
                        } else {
                            order[r] = tmpOrderB;
                        }
                        // update positions
                        _.forEach(order[r], (nodeId: number, pos: number) => {
                            positions[nodeId] = pos;
                        });
                        Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveHeavyHeavy"]);
                    };

                    const resolveY = () => {
                        Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveY"]);
                        if (options["debug"]) {
                            console.log("resolveY");
                        }
                        const addEdge = (srcNode: OrderNode, dstNode: OrderNode, weight: number) => {
                            if (srcNode.isVirtual && dstNode.isVirtual) {
                                weight = Number.POSITIVE_INFINITY;
                            }
                            const newEdge = new Edge(srcNode.id, dstNode.id, weight);
                            const newEdgeId = this.addEdge(newEdge);
                            graph.addEdge(newEdge, newEdgeId);
                            neighbors[0][dstNode.id].push({end: srcNode.id, weight: weight});
                            neighbors[1][srcNode.id].push({end: dstNode.id, weight: weight});
                        };

                        const removeEdge = (srcNode: OrderNode, dstNode: OrderNode) => {
                            const edge = graph.edgeBetween(srcNode.id, dstNode.id);
                            graph.removeEdge(edge.id);
                            this.removeEdge(edge.id);
                            let upEdgeIndex;
                            _.forEach(neighbors[0][dstNode.id], (neighbor: Neighbor, i: number) => {
                                if (neighbor.end === srcNode.id) {
                                    upEdgeIndex = i;
                                }
                            });
                            neighbors[0][dstNode.id].splice(upEdgeIndex, 1);
                            let downEdgeIndex;
                            _.forEach(neighbors[1][srcNode.id], (neighbor: Neighbor, i: number) => {
                                if (neighbor.end === dstNode.id) {
                                    downEdgeIndex = i;
                                }
                            });
                            neighbors[1][srcNode.id].splice(downEdgeIndex, 1);
                        };

                        const addNode = (r: number, pos: number, node: OrderNode) => {
                            for (let tmpPos = order[r].length; tmpPos >= pos + 1; --tmpPos) {
                                order[r][tmpPos] = order[r][tmpPos - 1];
                            }
                            order[r][pos] = node.id;
                            ranks[r].groups[0].addNode(node, node.id);
                            node.rank = r;
                            // update positions
                            _.forEach(order[r], (nodeId: number, pos: number) => {
                                positions[nodeId] = pos;
                            });
                            numNodesPerGroup[node.group.id]++;
                        };

                        const removeNode = (node: OrderNode, permanent: boolean = false) => {
                            const r = node.rank;
                            const pos = positions[node.id];
                            ranks[r].groups[0].removeNode(node);

                            // adjust positions
                            for (let tmpPos = pos + 1; tmpPos < order[r].length; ++tmpPos) {
                                order[r][tmpPos - 1] = order[r][tmpPos];
                            }

                            order[r].length = order[r].length - 1;

                            // update positions
                            _.forEach(order[r], (nodeId: number, pos: number) => {
                                positions[nodeId] = pos;
                            });

                            numNodesPerGroup[node.group.id]--;

                            if (permanent) {
                                graph.removeNode(node.id);
                                this.removeNode(node.id);
                            }
                        };

                        // mark nodes that must not be moved
                        const nonMoving = new Set();
                        const intranodePathEnds = new Set();
                        _.forEach(ranks[r - 1].groups[0].nodes, (node: OrderNode) => {
                            let isOnIntranodePath = !node.isVirtual && _.some(graph.incidentEdges(node.id), edge => edge.weight === Number.POSITIVE_INFINITY);
                            _.forEach(graph.incidentEdges(node.id), edge => {
                                if (edge.weight === Number.POSITIVE_INFINITY) {
                                    isOnIntranodePath = !node.isVirtual;
                                }
                            });
                            if (isOnIntranodePath) {
                                nonMoving.add(node);
                                let tmpNode = node;
                                while (graph.outEdges(tmpNode.id).length > 0 && graph.outEdges(tmpNode.id)[0].weight === Number.POSITIVE_INFINITY) {
                                    tmpNode = graph.node(graph.outEdges(tmpNode.id)[0].dst);
                                    nonMoving.add(tmpNode);
                                }
                                intranodePathEnds.add(tmpNode);
                            } else if (graph.outEdges(node.id).length === 0) {
                                // sink on rank r - 1
                                nonMoving.add(node);
                            }
                        });

                        // create new rank if necessary
                        if (_.filter(_.last(ranks).groups[0].nodes, node => !nonMoving.has(node)).length > 0) {
                            const newR = ranks.length;
                            const newRank = new OrderRank(ranks[ranks.length - 1].rank + 1);
                            this.addRank(newRank);
                            const newGroup = new OrderGroup(null);
                            newRank.addGroup(newGroup);
                            const newRankComponent = new OrderRank(ranks[ranks.length - 1].rank + 1);
                            graph.addRank(newRankComponent);
                            ranks.push(newRankComponent);
                            newRankComponent.addGroup(newGroup);
                            this._groupGraph.addEdge(new Edge(ranks[newR - 1].groups[0].id, ranks[newR].groups[0].id));
                            this._rankGraph.addEdge(new Edge(ranks[newR - 1].id, ranks[newR].id));
                            newRankComponent.order = [0];
                            groupOrder[newR] = [newGroup.id];
                            groupPositions[newGroup.id] = 0;
                            groupOffsetsPos[newGroup.id] = 0;
                            numNodesPerGroup[newGroup.id] = 0;
                            order[newR] = [];
                            crossings[newR] = 0;
                        }

                        // move nodes down and create virtual nodes
                        for (let tmpR = ranks.length - 1; tmpR >= r; --tmpR) {
                            const northNodes = _.map(order[tmpR - 1], nodeId => graph.node(nodeId));
                            _.forEach(northNodes, (node: OrderNode) => {
                                if (!nonMoving.has(node)) {
                                    const pos = positions[node.id];
                                    removeNode(node);
                                    addNode(tmpR, order[tmpR].length, node);
                                    if (tmpR === r) {
                                        // create a virtual node for each in edge and route edge through new node
                                        const sortedEdges = _.sortBy(graph.inEdges(node.id), edge => positions[edge.src]);
                                        _.forEachRight(sortedEdges, inEdge => {
                                            const newNode = new OrderNode(null, true, false, /*node.label() + "'"*/);
                                            this.addNode(newNode);
                                            addNode(r - 1, pos, newNode);
                                            neighbors[0][newNode.id] = [];
                                            neighbors[1][newNode.id] = [];
                                            virtual[newNode.id] = true;
                                            intranode[newNode.id] = false;
                                            sink[newNode.id] = false;
                                            const srcNode = graph.node(inEdge.src);
                                            removeEdge(srcNode, node);
                                            addEdge(srcNode, newNode, inEdge.weight);
                                            addEdge(newNode, node, inEdge.weight);
                                        });
                                    }
                                } else {
                                    if (intranodePathEnds.has(node)) {
                                        if (DEBUG) {
                                            Assert.assertAll(graph.outEdges(node.id), edge => graph.node(edge.dst).rank === tmpR + 1, "edge below intranode path end not spanning two ranks");
                                        }
                                        // create a virtual node for each out edge and route edge through new node
                                        // sort edges to prevent crossings between them
                                        const sortedEdges = _.sortBy(graph.outEdges(node.id), edge => positions[edge.dst]);
                                        _.forEach(sortedEdges, outEdge => {
                                            const newNode = new OrderNode(null, true, false, /*node.label() + "'"*/);
                                            this.addNode(newNode);
                                            addNode(tmpR, order[tmpR].length, newNode);
                                            virtual[newNode.id] = true;
                                            intranode[newNode.id] = false;
                                            neighbors[0][newNode.id] = [];
                                            neighbors[1][newNode.id] = [];
                                            const dstNode = graph.node(outEdge.dst);
                                            removeEdge(node, dstNode);
                                            addEdge(node, newNode, outEdge.weight);
                                            addEdge(newNode, dstNode, outEdge.weight);
                                        });
                                    } else if (!sink[node.id]) {
                                        // there is a an internode segment between upper and this rank
                                        // => change order within this rank
                                        const lowerNode = graph.outNeighbors(node.id)[0];
                                        removeNode(lowerNode);
                                        addNode(tmpR, order[tmpR].length, lowerNode);
                                    }
                                }
                            });
                        }

                        if (options["debug"]) {
                            storeLocal();
                        }

                        if (DEBUG) {
                            Assert.assertAll(_.range(r + 1), r => getConflict("HEAVYHEAVY", r, true) === null, "heavy-heavy conflict after y resolution");
                        }
                        Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveY"]);
                    }

                    const checkXResolution = (side: "LEFT" | "RIGHT") => {
                        Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "checkX"]);
                        const nodesPerRank = new Array(ranks.length);
                        const minHeavyNodePerRank: Array<number> = new Array(ranks.length);
                        const maxOtherNodePerRank: Array<number> = new Array(ranks.length);
                        let conflict = false;
                        for (let r = 0; r < ranks.length; ++r) {
                            nodesPerRank[r] = new Map();
                            minHeavyNodePerRank[r] = (side === "RIGHT" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
                            maxOtherNodePerRank[r] = (side === "RIGHT" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
                        }
                        const queue: Array<[OrderNode, string]> = [];
                        let minRank = r - 1;
                        let maxRank = r;
                        const moveDir = (side === "LEFT" ? 1 : -1);
                        const minFun = (side === "RIGHT" ? Math.min : Math.max);
                        const maxFun = (side === "RIGHT" ? Math.max : Math.min);
                        const geFun = (side === "RIGHT" ? ((a, b) => a >= b) : ((a, b) => a <= b));
                        const addNodeToGroup = (r: number, node: OrderNode, group: string) => {
                            nodesPerRank[r].set(node, group);
                            queue.push([node, group]);
                            const addIntermediate = () => {
                                if (geFun(maxOtherNodePerRank[r], minHeavyNodePerRank[r])) {
                                    const intermediate = [];
                                    for (let pos = maxOtherNodePerRank[r]; pos !== minHeavyNodePerRank[r]; pos += moveDir) {
                                        const node = graph.node(order[r][pos]);
                                        if (!nodesPerRank[r].has(node)) {
                                            intermediate.push([node, "YELLOW"]);
                                        } else if (node.rank === minRank) {
                                            intermediate.push([node, nodesPerRank[r].get(node)]); // check boundaries again
                                        }
                                    }
                                    _.forEach(intermediate, ([node, group]) => {
                                        addNodeToGroup(r, node, group);
                                    });
                                }
                            }
                            if (group === "RED") {
                                const prev = maxOtherNodePerRank[r];
                                maxOtherNodePerRank[r] = maxFun(maxOtherNodePerRank[r], positions[node.id]);
                                if (maxOtherNodePerRank[r] !== prev && minHeavyNodePerRank[r] !== Number.POSITIVE_INFINITY && minHeavyNodePerRank[r] !== Number.NEGATIVE_INFINITY) {
                                    addIntermediate();
                                }
                            } else {
                                // potentially heavy
                                const prev = minHeavyNodePerRank[r];
                                minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[node.id]);
                                if (minHeavyNodePerRank[r] !== prev && maxOtherNodePerRank[r] !== Number.POSITIVE_INFINITY && maxOtherNodePerRank[r] !== Number.NEGATIVE_INFINITY) {
                                    addIntermediate();
                                }
                            }
                        };
                        addNodeToGroup(r - 1, crossedNorthNode, "GREEN");
                        addNodeToGroup(r, crossedSouthNode, "GREEN");
                        addNodeToGroup(r - 1, crossingNorthNode, "RED");
                        addNodeToGroup(r, crossingSouthNode, "RED");

                        let queuePointer = 0;
                        while (queuePointer < queue.length && !conflict) {
                            const [node, group] = queue[queuePointer++];
                            if (nodesPerRank[node.rank].get(node) !== group) {
                                continue; // group has changed in the meantime
                            }
                            const addNeighbors = (neighborMethod: "inEdges" | "outEdges", neighborProperty: "src" | "dst", rankOffset: 1 | -1) => {
                                _.forEach(graph[neighborMethod](node.id), edge => {
                                    if (edge === crossingEdge) {
                                        return;
                                    }
                                    const neighborRank = node.rank + rankOffset;
                                    const neighbor = graph.node(edge[neighborProperty]);
                                    if (!nodesPerRank[neighborRank].has(neighbor)) {
                                        // add neighbor to same group as this node
                                        addNodeToGroup(neighborRank, neighbor, group);
                                    } else {
                                        // check for conflict or group change
                                        const neighborGroup = nodesPerRank[neighborRank].get(neighbor);
                                        if (neighborGroup !== group) {
                                            if (neighborGroup === "YELLOW") {
                                                addNodeToGroup(neighborRank, neighbor, group);
                                            } else if (group === "YELLOW") {
                                                addNodeToGroup(node.rank, node, neighborGroup);
                                            } else {
                                                // one is "GREEN" and the other is "RED"
                                                conflict = true;
                                            }
                                        }
                                    }
                                });
                            };
                            if (node.rank > minRank) {
                                addNeighbors("inEdges", "src", -1);
                            }
                            if (node.rank === minRank && geFun(positions[node.id], minHeavyNodePerRank[node.rank])) {
                                let foundNewMinRank = false;
                                _.forEach(graph.inEdges(node.id), inEdge => {
                                    if (inEdge.weight === Number.POSITIVE_INFINITY) {
                                        foundNewMinRank = true;
                                    }
                                });
                                if (foundNewMinRank) {
                                    minRank--;
                                    nodesPerRank[node.rank].forEach((group, borderNode) => {
                                        queue.push([borderNode, group]);
                                    });
                                }
                            }
                            if (node.rank < maxRank) {
                                addNeighbors("outEdges", "dst", 1);
                            }
                        }
                        if (conflict) {
                            Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "checkX"]);
                            return null;
                        }
                        // group nodes
                        const nodesPerRankGrouped = [];
                        _.forEach(nodesPerRank, (nodes, r) => {
                            nodesPerRankGrouped[r] = {
                                "GREEN": new Set(),
                                "MOVING": new Set(),
                            };
                            minHeavyNodePerRank[r] = (side === "RIGHT" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
                            nodes.forEach((group, node) => {
                                if (group !== "RED") {
                                    // "GREEN" or "YELLOW"
                                    // because we want to move as few nodes as possible, we count the "YELLOW" nodes to the "GREEN" nodes
                                    nodesPerRankGrouped[r]["GREEN"].add(node);
                                    minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[node.id]);
                                }
                            });
                            nodes.forEach((group, node) => {
                                if (group === "RED" && geFun(positions[node.id], minHeavyNodePerRank[node.rank])) {
                                    nodesPerRankGrouped[r]["MOVING"].add(node);
                                }
                            });
                        });
                        Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "checkX"]);
                        return nodesPerRankGrouped;
                    };

                    const resolveX = (side: "LEFT" | "RIGHT", nodesPerRank) => {
                        Timer.start(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveX"]);
                        if (options["debug"]) {
                            console.log("resolveX", side, nodesPerRank);
                        }
                        let minChangedRank = Number.POSITIVE_INFINITY;
                        let maxChangedRank = Number.NEGATIVE_INFINITY;
                        _.forEach(nodesPerRank, (rank, r: number) => {
                            if (rank["MOVING"].size === 0 || rank["GREEN"].size === 0) {
                                return;
                            }
                            const heavy: Array<OrderNode> = _.sortBy(Array.from(rank["GREEN"]), node => positions[node.id]);
                            const moving: Array<OrderNode> = _.sortBy(Array.from(rank["MOVING"]), node => positions[node.id]);
                            const newOrder = [];
                            _.forEach(order[r], nodeId => {
                                const node = graph.node(nodeId);
                                if (rank["MOVING"].has(node)) {
                                    return; // do nothing
                                }
                                if (side === "RIGHT" && nodeId === heavy[0].id) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.id);
                                    });
                                }
                                newOrder.push(nodeId);
                                if (side === "LEFT" && nodeId === _.last(heavy).id) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.id);
                                    });
                                }
                            });
                            order[r] = newOrder;
                            _.forEach(order[r], (nodeId: number, pos: number) => {
                                positions[nodeId] = pos;
                            });
                        });

                        if (options["debug"]) {
                            storeLocal();
                        }
                        if (DEBUG) {
                            Assert.assertAll(_.range(r + 1), r => getConflict("HEAVYHEAVY", r, true) === null, "heavy-heavy conflict after x resolution");
                        }
                        Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict", "resolveX"]);
                    };

                    didResolveY = false;
                    if (isHeavyHeavy) {
                        resolveHeavyHeavy();
                    } else {
                        if (options["resolveX"]) {
                            crossingEdge = graph.edgeBetween(crossingNorthNode.id, crossingSouthNode.id);
                            const leftResolution = checkXResolution("LEFT");
                            const rightResolution = checkXResolution("RIGHT");
                            if (leftResolution === null) {
                                if (rightResolution === null) {
                                    resolveY();
                                    didResolveY = true;
                                } else {
                                    resolveX("RIGHT", rightResolution);
                                }
                            } else {
                                if (rightResolution === null) {
                                    resolveX("LEFT", leftResolution);
                                } else {
                                    const numNodesLeft = _.sum(_.map(leftResolution, rank => rank["MOVING"].size));
                                    const numNodesRight = _.sum(_.map(rightResolution, rank => rank["MOVING"].size));
                                    if (numNodesLeft < numNodesRight) {
                                        resolveX("LEFT", leftResolution);
                                    } else {
                                        resolveX("RIGHT", rightResolution);
                                    }
                                }
                            }
                        } else {
                            resolveY();
                            didResolveY = true;
                        }
                    }
                    Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve", "resolveConflict"]);
                }

                if (options["debug"]) {
                    storeLocal();
                }

                let didResolveY = false;

                for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r);
                }
                for (let r = 1; r < ranks.length; ++r) {
                    while (true) {
                        const conflict = getConflict("HEAVYHEAVY", r);
                        if (conflict === null) {
                            break;
                        }
                        resolveConflict(true, conflict);
                        if (options["debug"]) {
                            storeLocal();
                        }
                    }
                    while (true) {
                        const conflict = getConflict("HEAVYLIGHT", r);
                        if (conflict === null) {
                            break;
                        }
                        resolveConflict(false, conflict);
                        if (options["debug"]) {
                            storeLocal();
                        }
                        if (didResolveY) {
                            break;
                        }
                    }
                }
                if (DEBUG) {
                    Assert.assertAll(_.range(1, ranks.length), r => getConflict("HEAVYHEAVY", r) === null, "heavy-heavy conflict after resolution");
                    Assert.assertAll(_.range(1, ranks.length), r => getConflict("HEAVYLIGHT", r) === null, "heavy-light conflict after resolution");
                }

                for (let tmpR = 1; tmpR < ranks.length; ++tmpR) {
                    crossings[tmpR] = countCrossings(order[tmpR], tmpR);
                }

                Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder", "resolve"]);
            }

            if (options["orderGroups"]) {
                if (472 === graph._nodeGraph.numNodes()) {
                    //options["debug"] = true;
                }
            }
            if (options["debug"]) {
                storeLocal();
            }

            if (options["countInitial"]) {
                for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, 0);
                }
            }
            if (options["countOnly"]) {
                return _.sum(crossings);
            }
            if (options["shuffles"] === 0) {
                if (this._wasm !== null && options["resolveConflicts"]) {
                    await this._wasm.reorder(order, neighbors[0], graph._nodeGraph.maxId(), numEdgesPerRank);
                    for (let r = 0; r < ranks.length; ++r) {
                        _.forEach(order[r], (nodeId: number, pos: number) => {
                            positions[nodeId] = pos;
                        });
                    }
                    for (let r = 1; r < ranks.length; ++r) {
                        crossings[r] = countCrossings(order[r], r, 0);
                    }
                } else {
                    reorder();
                }
            } else {
                const originalOrder = _.cloneDeep(order);
                const originalGroupOrder = _.cloneDeep(groupOrder);
                const originalCrossings = _.cloneDeep(crossings);
                reorder();
                let numCrossings = _.sum(crossings);
                let minCrossings = numCrossings;
                let bestOrder = _.cloneDeep(order);
                let bestGroupOrder = _.cloneDeep(groupOrder);
                for (let i = 0; i < options["shuffles"]; ++i) {
                    if (minCrossings === 0) {
                        break;
                    }
                    _.forEach(ranks, (rank: OrderRank, r: number) => {
                        _.forEach(originalOrder[r], (nodeId: number, pos: number) => {
                            order[r][pos] = nodeId;
                            positions[nodeId] = pos;
                        });
                        groupOrder[r] = _.clone(originalGroupOrder[r]);
                        this._setGroupPositionAndOffset(groupOrder[r], groupPositions, groupOffsetsPos, numNodesPerGroup);
                    });
                    crossings = _.cloneDeep(originalCrossings);
                    reorder(true, true);
                    numCrossings = _.sum(crossings);
                    if (numCrossings < minCrossings) {
                        minCrossings = numCrossings;
                        bestOrder = _.cloneDeep(order);
                        bestGroupOrder = _.cloneDeep(groupOrder);
                    }
                }
                for (let r = 0; r < ranks.length; ++r) {
                    _.forEach(bestOrder[r], (nodeId: number, pos: number) => {
                        order[r][pos] = nodeId;
                        positions[nodeId] = pos;
                    });
                    _.forEach(bestGroupOrder[r], (groupId: number, groupPos: number) => {
                        groupOrder[r][groupPos] = groupId;
                        groupPositions[groupId] = groupPos;
                    });
                }
            }

            if (options["debug"]) {
                storeLocal();
            }

            if (options["resolveConflicts"]) {
                resolveConflicts();
                options["debug"] = false;
                reorder(false, false, 0, true);
                if (DEBUG) {
                    Assert.assertAll(_.range(1, ranks.length), r => getConflict("HEAVYHEAVY", r) === null, "heavy-heavy conflict after reorder with preventConflict");
                    Assert.assertAll(_.range(1, ranks.length), r => getConflict("HEAVYLIGHT", r) === null, "heavy-light conflict after reorder with preventConflict");
                }
            }

            // transform component ranks to absolute ranks
            if (minRank > 0 && minRank < Number.POSITIVE_INFINITY) {
                _.forEach(graph.nodes(), (node: OrderNode) => {
                    node.rank += minRank;
                });
            }

            // store new positions
            _.forEach(ranks, (rank: OrderRank) => {
                _.forEach(rank.groups, (group: OrderGroup) => {
                    group.position = groupPositions[group.id];
                    _.forEach(group.nodes, (node: OrderNode) => {
                        node.position = positions[node.id];
                    });
                    group.orderNodes();
                });
                rank.orderGroups();
            });

            const numCrossings = _.sum(crossings);

            Timer.stop(["doLayout", "orderRanks", "doOrder", "order", "doOrder"]);

            return numCrossings;
        }

        this._addGroupEdges();

        const numRanks = this._rankGraph.maxId();
        const numGroups = this._groupGraph.maxId();
        const numNodes = this._nodeGraph.maxId();

        groupOffsetsPos = new Array(numGroups); // number of nodes in groups left of this group (reflecting current order) by id
        numNodesPerGroup = new Array(numGroups); // number of nodes in group by id
        groupOrder = new Array(numRanks); // current order of groups on this level (e. g. 2, 0, 1)
        groupPositions = new Array(numGroups);// position of each group by id; roughly inverse of groupOrder (e. g. 1, 2, 0)
        order = new Array(numRanks); // current order of nodes on this level (e. g. 2, 0, 1)
        positions = new Array(numNodes); // inverse of order (e. g. 1, 2, 0)
        neighbors = [
            new Array(numNodes),
            new Array(numNodes),
        ];
        crossings = new Array(numRanks); // number of crossings above each rank
        virtual = new Array(numNodes);
        intranode = new Array(numNodes);
        sink = new Array(numNodes);
        numEdgesPerRank = new Array(numRanks);

        let numCrossings = 0;
        const groupComponents = this._groupGraph.components();
        for (let i = 0; i < groupComponents.length; ++i) {
            const groupGraphComponent = groupComponents[i];
            const componentGraph = new OrderGraph();
            const ranks: Array<OrderRank> = [];
            _.forEach(groupGraphComponent.nodes(), (group: OrderGroup) => {
                if (ranks[group.rank.id] === undefined) {
                    ranks[group.rank.id] = new OrderRank(group.rank.rank);
                    componentGraph.addRank(ranks[group.rank.id]);
                }
                ranks[group.rank.id].addGroup(group, group.id);
                const groupNodes = group.nodes;
                group.nodes = [];
                _.forEach(groupNodes, (node: OrderNode) => {
                    group.addNode(node, node.id);
                });
            });

            _.forEach(componentGraph.nodes(), (newNode: OrderNode) => {
                _.forEach(this.outEdges(newNode.id), (edge: Edge<any, any>) => {
                    componentGraph.addEdge(edge, edge.id);
                });
            });

            if (componentGraph._rankGraph.numNodes() < 2 || componentGraph._nodeGraph.numEdges() < componentGraph._rankGraph.numNodes()) {
                // with 0 or one edges, there is nothing to reorder
                continue;
            }

            componentGraph._addGroupEdges();
            componentGraph._addRankEdges();

            if (options["method"] === "spring") {
                await doOrderSprings(componentGraph);
            } else {
                numCrossings += await doOrder(componentGraph);
            }
        }
        Timer.stop(["doLayout", "orderRanks", "doOrder", "order"]);

        return numCrossings;
    }

    public async applyToAllComponents(fun: (component: OrderGraph) => any, foldFun: (prev: any, current: typeof prev) => typeof prev = () => {},
                                  foldNeutral: any = null): Promise<any> {
        let result = foldNeutral;
        const groupComponents = this._groupGraph.components();
        for (let i = 0; i < groupComponents.length; ++i) {
            const groupGraphComponent = groupComponents[i];
            const componentGraph = new OrderGraph();
            const ranks: Array<OrderRank> = [];
            _.forEach(groupGraphComponent.nodes(), (group: OrderGroup) => {
                if (ranks[group.rank.id] === undefined) {
                    ranks[group.rank.id] = new OrderRank(group.rank.rank);
                    componentGraph.addRank(ranks[group.rank.id]);
                }
                ranks[group.rank.id].addGroup(group, group.id);
                const groupNodes = group.nodes;
                group.nodes = [];
                _.forEach(groupNodes, (node: OrderNode) => {
                    group.addNode(node, node.id);
                });
            });

            _.forEach(componentGraph.nodes(), (newNode: OrderNode) => {
                _.forEach(this.outEdges(newNode.id), (edge: Edge<any, any>) => {
                    componentGraph.addEdge(edge, edge.id);
                });
            });

            if (componentGraph._rankGraph.numNodes() < 2 || componentGraph._nodeGraph.numEdges() < componentGraph._rankGraph.numNodes()) {
                // with 0 or one edges, there is nothing to reorder
                continue;
            }

            componentGraph._addGroupEdges();
            componentGraph._addRankEdges();

            foldFun(result, await fun(componentGraph));
        }
        return result;
    }

    /**
     * Adapted from Barth, W., Jünger, M., & Mutzel, P. (2002, August). Simple and efficient bilayer cross counting.
     * In International Symposium on Graph Drawing (pp. 130-141). Springer, Berlin, Heidelberg.
     * @param numNorth
     * @param numSouth
     * @param edges
     * @private
     */
    private _countCrossings(numNorth: number, numSouth: number, edges: Array<[number, number, number]>): number {
        // build south sequence
        inPlaceSort(edges).asc([
            e => e[0],
            e => e[1],
        ]);

        // build the accumulator tree
        let firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        const treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        const tree = _.fill(new Array(treeSize), 0);

        // compute the total weight of the crossings
        let crossWeight = 0;
        for (let i = 0; i < edges.length; ++i) {
            let index = edges[i][1] + firstIndex;
            tree[index] += edges[i][2];
            let weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += tree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                tree[index] += edges[i][2];
            }
            crossWeight += edges[i][2] * weightSum;
        }
        return crossWeight;
    }

    private _getChanges(newOrder: Array<number>, positions: Array<number>): Array<[number, number]> {
        const changes = [];
        const permutation = new Array(newOrder.length);
        _.forEach(newOrder, (nodeId: number, pos: number) => {
            permutation[pos] = positions[nodeId];
        });
        let seqStart = null;
        let seqEnd = -1;
        for (let pos = 0; pos < permutation.length; ++pos) {
            if (permutation[pos] > pos) {
                if (seqStart === null) {
                    seqStart = pos;
                    seqEnd = permutation[pos];
                } else {
                    if (seqEnd < pos) {
                        changes.push([seqStart, pos - 1]);
                        seqStart = pos;
                        seqEnd = permutation[pos];
                    } else {
                        seqEnd = Math.max(seqEnd, permutation[pos]);
                    }
                }
            }
            if (permutation[pos] === pos && seqStart !== null && seqEnd < pos) {
                changes.push([seqStart, pos - 1]);
                seqStart = null;
            }
        }
        if (seqStart !== null) {
            changes.push([seqStart, permutation.length - 1]);
        }
        return changes;
    }

    private _setGroupPositionAndOffset(groupOrder: Array<number>, groupPositions: Array<number>, groupOffsetsPos: Array<number>, numNodesPerGroup: Array<number>): void {
        let offset = 0;
        _.forEach(groupOrder, (groupId: number, pos: number) => {
            groupPositions[groupId] = pos;
            groupOffsetsPos[groupId] = offset;
            offset += numNodesPerGroup[groupId];
        });
    }
}
