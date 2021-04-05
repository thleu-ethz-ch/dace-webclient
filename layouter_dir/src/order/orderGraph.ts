import * as _ from "lodash";
import Assert from "../util/assert";
import Component from "../graph/component";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Timer from "../util/timer";

export default class OrderGraph {
    private _rankGraph: Graph<OrderRank, Edge<any, any>>;
    private _groupGraph: Graph<OrderGroup, Edge<any, any>>;
    private _nodeGraph: Graph<OrderNode, Edge<any, any>>;

    private _groupEdgesAdded: boolean = false;

    constructor() {
        this._rankGraph = new Graph<OrderRank, Edge<any, any>>();
        this._groupGraph = new Graph<OrderGroup, Edge<any, any>>();
        this._nodeGraph = new Graph<OrderNode, Edge<any, any>>();
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

    storeLocal() {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("storedGraph", this.toString());
        }
    }

    public addRank(rank: OrderRank, id: number = null) {
        rank.orderGraph = this;
        return this._rankGraph.addNode(rank, id);
    }

    public addGroup(group: OrderGroup, id: number = null) {
        return this._groupGraph.addNode(group, id);
    }

    public addNode(node: OrderNode, id: number = null): number {
        return this._nodeGraph.addNode(node, id);
    }

    public removeNode(id: number) {
        this._nodeGraph.removeNode(id);
    }

    public addEdge(edge: Edge<any, any>, id: number = null): number {
        return this._nodeGraph.addEdge(edge, id);
    }

    public removeEdge(id: number) {
        this._nodeGraph.removeEdge(id);
    }

    private _addGroupEdges() {
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

    private _addRankEdges() {
        _.forEach(this._groupGraph.edges(), (edge: Edge<any, any>) => {
            const srcRankId = this._groupGraph.node(edge.src).rank.id;
            const dstRankId = this._groupGraph.node(edge.dst).rank.id;
            if (!this._rankGraph.hasEdge(srcRankId, dstRankId)) {
                this._rankGraph.addEdge(new Edge(srcRankId, dstRankId));
            }
        });
    }

    public node(id: number) {
        return this._nodeGraph.node(id);
    }

    public group(id: number) {
        return this._groupGraph.node(id);
    }

    public nodes() {
        return this._nodeGraph.nodes();
    }

    public groups() {
        return this._groupGraph.nodes();
    }

    public edges() {
        return this._nodeGraph.edges();
    }

    public inEdges(id: number) {
        return this._nodeGraph.inEdges(id);
}

    public outEdges(id: number) {
        return this._nodeGraph.outEdges(id);
    }

    public edgeBetween(srcId: number, dstId: number) {
        return this._nodeGraph.edgeBetween(srcId, dstId);
    }

    public groupEdges() {
        this._addGroupEdges();
        return this._groupGraph.edges();
    }

    public order(doNothing: boolean = false, debug: boolean = false): void {
        const doOrder = (graph: OrderGraph, downward: boolean = true) => {
            Timer.start("doOrder")
            const ranks = graph._rankGraph.toposort();
            const groupOffsets = []; // number of nodes in groups left of this group by group id
            const numNodesGroup = []; // number of nodes per group per rank
            const numNodesRank = []; // total number of nodes per rank
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                rank.order = _.sortBy(_.range(rank.groups.length), g => rank.groups[g].position);
                let groupOffset = 0;
                numNodesGroup[r] = [];
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g) => {
                    groupOffsets[group.id] = groupOffset;
                    groupOffset += group.nodes.length;
                    numNodesGroup[r][g] = group.nodes.length;
                });
                numNodesRank[r] = groupOffset;
            });

            const nodeIndexes = []; // index of node within group by node id
            _.forEach(graph._groupGraph.nodes(), (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode, nodeIndex) => {
                    nodeIndexes[node.id] = groupOffsets[group.id] + nodeIndex;
                });
            });
            const groupOffset = []; // number of nodes in groups left of this group by rank
            const neighborsDown = [];
            const weightsDown = [];
            const neighborsUp = [];
            const weightsUp = [];
            let order = []; // current order of this level (e. g. 2, 0, 1)
            let positions = []; // inverse of order (e. g. 1, 2, 0)
            const crossings = []; // number of crossings above each rank where heavy edges are not so heavy
            const crossingsWithInfinity = []; // number of crossings above each rank where heavy edges are heavy

            // set neighbors
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                groupOffset[r] = [];
                neighborsDown[r] = [];
                weightsDown[r] = [];
                neighborsUp[r] = [];
                weightsUp[r] = [];
                order[r] = new Array(numNodesRank[r]);
                positions[r] = new Array(numNodesRank[r]);
                crossings[r] = Number.POSITIVE_INFINITY;
                crossingsWithInfinity[r] = Number.POSITIVE_INFINITY;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    groupOffset[r][g] = groupOffsets[group.id];
                    const groupOrder = _.range(groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]);
                    for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                        order[r][groupOffset[r][g] + n] = groupOrder[n];
                    }
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
                        node.rank = r;
                        const pos = groupOffsets[group.id] + n;
                        neighborsDown[r][pos] = [];
                        weightsDown[r][pos] = [];
                        neighborsUp[r][pos] = [];
                        weightsUp[r][pos] =  [];
                        _.forEach(graph._nodeGraph.outEdges(node.id), (edge: Edge<any, any>) => {
                            neighborsDown[r][pos].push(nodeIndexes[edge.dst]);
                            weightsDown[r][pos].push(edge.weight);
                        });
                        _.forEach(graph._nodeGraph.inEdges(node.id), (edge: Edge<any, any>) => {
                            neighborsUp[r][pos].push(nodeIndexes[edge.src]);
                            weightsUp[r][pos].push(edge.weight);
                        });
                    });
                });
                _.forEach(order[r], (node, pos) => {
                    positions[r][node] = pos;
                });
                Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match after init " + positions[r].toString() + " | " + order[r].toString());
                Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match after init " + positions[r].toString() + " | " + order[r].toString());
            });

            crossings[0] = 0;
            crossingsWithInfinity[0] = 0;

            const countCrossings = (testOrder: Array<number>, r: number, direction: "UP" | "DOWN", useInfinity: boolean = false) => {
                const edges = [];
                const neighbors = (direction === "UP" ? neighborsUp : neighborsDown);
                const weights = (direction === "UP" ? weightsUp : weightsDown);
                const neighborRank = (direction === "UP" ? (r - 1) : (r + 1));
                for (let pos = 0; pos < testOrder.length; ++pos) {
                    for (let neighbor = 0; neighbor < neighbors[r][testOrder[pos]].length; ++neighbor) {
                        let weight = weights[r][testOrder[pos]][neighbor];
                        if (weight === Number.POSITIVE_INFINITY) {
                            if (useInfinity) {
                                weight = 1000000;
                            } else {
                                weight = 1000000;
                            }
                        }
                        edges.push([
                            pos,
                            positions[neighborRank][neighbors[r][testOrder[pos]][neighbor]],
                            weight,
                        ]);
                    }
                }
                return this._countCrossings(testOrder.length, order[neighborRank].length, edges);
            };

            /**
             * Sweeps the ranks up and down and reorders the nodes according to the barycenter heuristic
             * @param countInitial
             */
            const reorder = (countInitial: boolean = false) => {
                Timer.start("reorder");
                // count initial crossings
                if (countInitial) {
                    for (let r = 1; r < ranks.length; ++r) {
                        crossings[r] = countCrossings(order[r], r, "UP");
                    }
                }

                let improveCounter = (!doNothing && (ranks.length > 1)) ? 2 : 0; // if only one rank, nothing to order
                while (improveCounter > 0) {
                    improveCounter--;
                    if (debug) {
                        console.log("TOTAL CROSSINGS", _.sum(crossings));
                    }
                    let firstRank = downward ? 1 : ranks.length - 2;
                    let lastRank = downward ? ranks.length - 1 : 0;
                    const direction = downward ? 1 : -1;
                    const neighborsNorth = downward ? neighborsUp : neighborsDown;
                    const crossingOffsetNorth = downward ? 0 : 1;
                    const crossingOffsetSouth = downward ? 1 : 0;
                    const northDirection = downward ? "UP" : "DOWN";
                    const southDirection = downward ? "DOWN" : "UP";
                    if (debug) {
                        console.log(downward ? "DOWN" : "UP");
                    }
                    for (let r = firstRank; r - direction !== lastRank; r += direction) {
                        Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match before reorder" + positions[r].toString() + order[r].toString());
                        Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match before reorder" + positions[r].toString() + order[r].toString());
                        if (debug) {
                            console.log("rank", r);
                        }
                        const newOrder = new Array(order[r].length);
                        const northRank = r - direction;

                        const prevCrossingsNorth = crossings[r + crossingOffsetNorth];

                        if (prevCrossingsNorth === 0) {
                            // no need to reorder
                            if (debug) {
                                console.log("skip because already 0");
                            }
                            continue;
                        }

                        for (let g = 0; g < numNodesGroup[r].length; ++g) {
                            // calculate mean position of neighbors
                            const nodeMeans = [];
                            for (let pos = groupOffset[r][g]; pos < groupOffset[r][g] + numNodesGroup[r][g]; ++pos) {
                                let sum = 0;
                                for (let neighbor = 0; neighbor < neighborsNorth[r][pos].length; ++neighbor) {
                                    sum += positions[northRank][neighborsNorth[r][pos][neighbor]];
                                }
                                if (neighborsNorth[r][pos].length > 0) {
                                    nodeMeans.push([pos, sum / neighborsNorth[r][pos].length]);
                                } else {
                                    nodeMeans.push([pos, pos]);
                                }
                            }

                            // sort by the means
                            const newGroupOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                            for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                                newOrder[groupOffset[r][g] + n] = newGroupOrder[n];
                            }
                        }
                        if (!_.isEqual(newOrder, order[r])) {
                            if (debug) {
                                console.log("try new order", _.cloneDeep(newOrder));
                            }
                            // count crossings with new order
                            const newCrossingsNorth = countCrossings(newOrder, r, northDirection);

                            let newCrossingsSouth = 0;
                            let prevCrossingsSouth = 0;
                            if (r !== lastRank) {
                                prevCrossingsSouth = crossings[r + crossingOffsetSouth];
                                newCrossingsSouth = countCrossings(newOrder, r, southDirection);
                            }
                            const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
                            const fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth);
                            if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
                                if (debug) {
                                    console.log("fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                                }
                                if (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth) {
                                    improveCounter = 2;
                                }
                                crossings[r + crossingOffsetNorth] = newCrossingsNorth;
                                if (r !== lastRank) {
                                    crossings[r + crossingOffsetSouth] = newCrossingsSouth;
                                }
                                order[r] = newOrder;
                                for (let pos = 0; pos < order[r].length; ++pos) {
                                    positions[r][order[r][pos]] = pos;
                                }
                            } else {
                                if (debug) {
                                    console.log("not fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                                }
                            }
                        } else {
                            if (debug) {
                                console.log("same order");
                            }
                        }
                        Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                        Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                    }
                    downward = !downward;
                }

                for (let r = 1; r < ranks.length; ++r) {
                    crossingsWithInfinity[r] = countCrossings(order[r], r, "UP", true);
                }

                Timer.stop("reorder");
            };

            const assertNeighborCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertNeighborCoherence(r));
                    return;
                }
                _.forEach(neighborsDown[r], (neighborsPerNode, n) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighborsUp[r + 1][neighbor].indexOf(n) !== -1, "neighbor in rank " + (r + 1) + " is missing upNeighbor");
                });
                //console.log("assertNeighborCoherence(" + r + ")", "neighborsUp", _.cloneDeep(neighborsUp), "neighborsDown", _.cloneDeep(neighborsDown));
                _.forEach(neighborsUp[r], (neighborsPerNode, n) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighborsDown[r - 1][neighbor].indexOf(n) !== -1, "neighbor in rank " + (r - 1) + "is missing downNeighbor");
                });
            }

            const assertOrderAndPositionCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertOrderAndPositionCoherence(r));
                }
                Assert.assertEqual(_.sortBy(order[r]), _.range(0, order[r].length), "order in rank " + r + " not contiguous");
                Assert.assertEqual(_.sortBy(positions[r]), _.range(0, order[r].length), "positions in rank " + r + " not contiguous");
                Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match");
                Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match");
            }

            const getIllegalCrossing = () => {
                for (let r = 1; r < ranks.length; ++r) {
                    if (crossingsWithInfinity[r] >= 1000000) {
                        // there is at least one illegal crossing between this and the upper rank
                        const segmentStarts = [];
                        const segmentEnds = [];
                        for (let n = 0; n < Math.max(order[r - 1].length); ++n) {
                            segmentStarts[n] = [];
                        }
                        for (let n = 0; n < Math.max(order[r].length); ++n) {
                            segmentEnds[n] = [];
                        }
                        for (let n = 0; n < order[r].length; ++n) {
                            const posSouth = positions[r][n];
                            for (let neighbor = 0; neighbor < neighborsUp[r][n].length; ++neighbor) {
                                const posNorth = positions[r - 1][neighborsUp[r][n][neighbor]];
                                const heavy = (weightsUp[r][n][neighbor] === Number.POSITIVE_INFINITY);
                                const segment = [posNorth, posSouth, heavy];
                                segmentStarts[posNorth].push(segment);
                                segmentEnds[posSouth].push(segment);
                            }
                        }
                        const openSegments: Set<[number, number, boolean]> = new Set();
                        for (let n = 0; n < Math.max(order[r].length, order[r - 1].length); ++n) {
                            _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth >= posSouth) {
                                    openSegments.delete(segment);
                                }
                            });
                            _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth < posSouth) { // equality handled in loop above
                                    openSegments.delete(segment);
                                }
                            });
                            const newSegments = [];
                            _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth <= posSouth) {
                                    newSegments.push(segment);
                                }
                            });
                            _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
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
                    }
                }
                return null;
            }

            /**
             * Tries to resolve illegal crossings, i. e. crossings of edges with infinite weight.
             */
            const resolveX = () => {
                Timer.start("resolveX");
                const resolveCrossing = (crossing) => {
                    const [r, heavyNorth, heavySouth, otherNorth, otherSouth] = crossing;
                    Assert.assert(groupOffset[r].length === 1, "more than one group");
                    Assert.assert(groupOffset[r - 1].length === 1, "more than one group");
                    if (debug) {
                        console.log(
                            "resolve",
                            ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]],
                            ranks[r].groups[0].nodes[order[r][heavySouth]],
                        );
                    }
                    Assert.assertEqual(ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]].label(), ranks[r].groups[0].nodes[order[r][heavySouth]].label(), "different nodes");

                    let heavyPerRank = new Map([[r - 1, heavyNorth], [r, heavySouth]]);
                    let otherPerRank = new Map([[r - 1, new Set([otherNorth])], [r, new Set([otherSouth])]]);
                    _.forEach([1, -1], direction => {
                        const neighbors = (direction === 1 ? neighborsDown : neighborsUp);
                        const weights = (direction === 1 ? weightsDown : weightsUp);
                        let heavyPos = (direction === 1 ? heavyNorth : heavySouth);
                        let tmpR = (direction === 1 ? r - 1 : r);
                        while (neighbors[tmpR][order[tmpR][heavyPos]].length > 0 && weights[tmpR][order[tmpR][heavyPos]][0] === Number.POSITIVE_INFINITY) {
                            heavyPos = positions[tmpR + direction][neighbors[tmpR][order[tmpR][heavyPos]][0]];
                            heavyPerRank.set(tmpR + direction, heavyPos);
                            if (!otherPerRank.has(tmpR + direction)) {
                                otherPerRank.set(tmpR + direction, new Set());
                            }
                            otherPerRank.get(tmpR).forEach((other: number) => {
                                for (let neighbor = 0; neighbor < neighbors[tmpR][order[tmpR][other]].length; ++neighbor) {
                                    otherPerRank.get(tmpR + direction).add(positions[tmpR + direction][neighbors[tmpR][order[tmpR][other]][neighbor]]);
                                }
                            });
                            tmpR += direction;
                        }
                    });

                    // count how many nodes would have to be moved from left to right or from right to left
                    const leftPerRank = [];
                    const rightPerRank = [];
                    let numLeft = 0;
                    let numRight = 0;
                    otherPerRank.forEach((otherPositionsSet: Set<number>, r: number) => {
                        if (otherPositionsSet.size === 0) {
                            return;
                        }
                        const otherPositions =  _.sortBy(Array.from(otherPositionsSet));
                        const index = _.sortedLastIndex(otherPositions, heavyPerRank.get(r));
                        const left = _.slice(otherPositions, 0, index);
                        const right = _.reverse(_.slice(otherPositions, index));
                        if (debug) {
                            console.log("r", r, "heavy", heavyPerRank.get(r), "otherPositions", otherPositions, "index", index, "left", left, "right", right);
                        }
                        if (left.length > 0) {
                            leftPerRank.push([r, left]);
                            numLeft += left.length;
                        }
                        if (right.length > 0) {
                            rightPerRank.push([r, right]);
                            numRight += right.length;
                        }
                    });
                    // move the smaller number of nodes
                    const moveDir = (numLeft < numRight ? 1 : -1);
                    const otherPositionsPerRank = (moveDir === 1 ? leftPerRank : rightPerRank);

                    if (debug) {
                        console.log("indexes per rank", "heavy: ", heavyPerRank, "other:", otherPositionsPerRank, "moveDir", moveDir);
                    }
                    _.forEach(otherPositionsPerRank, (rankPositions: [number, Array<number>]) => {
                        let r = rankPositions[0];
                        assertOrderAndPositionCoherence(r);
                        let movingPositions = rankPositions[1];
                        let positionsPointer = 0;
                        if (moveDir === 1) {
                            let offsetMoving = heavyPerRank.get(r) - movingPositions[0] + 1 - movingPositions.length;
                            let offsetNonMoving = 0;
                            for (let p = movingPositions[0]; p <= heavyPerRank.get(r); p++) {
                                if (movingPositions[positionsPointer] === p) {
                                    positions[r][order[r][p]] += offsetMoving;
                                    offsetNonMoving--;
                                    positionsPointer++;
                                } else {
                                    positions[r][order[r][p]] += offsetNonMoving;
                                    offsetMoving--;
                                }
                            }
                        } else {
                            let posMoving = heavyPerRank.get(r) + movingPositions.length - 1;
                            let offsetNonMoving = 0;
                            for (let p = movingPositions[0]; p >= heavyPerRank.get(r); p--) {
                                if (r === 84) {
                                    console.log("posMoving", posMoving, "offsetNonMoving", offsetNonMoving, "p", p, "movingPositions", movingPositions);
                                }
                                if (movingPositions[positionsPointer] === p) {
                                    positions[r][order[r][p]] = posMoving--;
                                    offsetNonMoving++;
                                    positionsPointer++;
                                } else {
                                    positions[r][order[r][p]] += offsetNonMoving;
                                }
                            }
                        }

                        assertOrderAndPositionCoherence(r);
                    });

                    const rankCrossingsChanged = _.fill(new Array(ranks.length), false);
                    _.forEach(otherPositionsPerRank, (rankPositions: [number, Array<number>]) => {
                        let r = rankPositions[0];
                        rankCrossingsChanged[r] = true;
                        if (r < ranks.length - 1) {
                            rankCrossingsChanged[r + 1] = true;
                        }
                    });
                    for (let r = 1; r < ranks.length; ++r) {
                        if (rankCrossingsChanged[r]) {
                            crossingsWithInfinity[r] = countCrossings(order[r], r, "UP", true);
                        }
                    }
                }

                let counter = 0;
                let invalid = false;
                let crossing = getIllegalCrossing();
                while (crossing !== null) {
                    if (counter++ === 100) {
                        invalid = true;
                        break;
                    }
                    if (debug) {
                        console.log("resolve", _.sum(crossingsWithInfinity));
                    }
                    resolveCrossing(crossing);
                    crossing = getIllegalCrossing();
                }

                Timer.stop("resolveX")
                return !invalid;
            }

            const resolveY = () => {
                Timer.start("resolveY");
                const resolveCrossing = (crossing) => {
                    let [r, heavyNorth, heavySouth, otherNorth, otherSouth] = crossing;
                    Assert.assert(groupOffset[r].length === 1, "more than one group");
                    Assert.assert(groupOffset[r - 1].length === 1, "more than one group");
                    //if (debug) {
                        console.log(
                            "resolve",
                            ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]],
                            ranks[r].groups[0].nodes[order[r][heavySouth]],
                            ranks[r - 1].groups[0].nodes[order[r][otherNorth]],
                            ranks[r].groups[0].nodes[order[r][otherSouth]],
                        );
                    //}
                    Assert.assertEqual(ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]].label(), ranks[r].groups[0].nodes[order[r][heavySouth]].label(), "different nodes");

                    let heavyPerRank: Map<number, number> = new Map([[r - 1, heavyNorth]]);
                    let otherPerRank: Map<number, number> = new Map([[r - 1, otherNorth]]);
                    _.forEach([1], direction => {
                        const neighbors = (direction === 1 ? neighborsDown : neighborsUp);
                        const weights = (direction === 1 ? weightsDown : weightsUp);
                        let heavyPos = (direction === 1 ? heavyNorth : heavySouth);
                        let otherPos = (direction === 1 ? otherNorth : otherSouth);
                        let tmpR = (direction === 1 ? r - 1 : r);
                        while (neighbors[tmpR][order[tmpR][heavyPos]].length > 0 && weights[tmpR][order[tmpR][heavyPos]][0] === Number.POSITIVE_INFINITY) {
                            heavyPos = positions[tmpR + direction][neighbors[tmpR][order[tmpR][heavyPos]][0]];
                            heavyPerRank.set(tmpR + direction, heavyPos);
                            otherPos = positions[tmpR + direction][neighbors[tmpR][order[tmpR][otherPos]][0]];
                            otherPerRank.set(tmpR + direction, otherPos);
                            tmpR += direction;
                        }
                    });

                    let heavyBottomR = 0;
                    heavyPerRank.forEach((pos, r) => {
                        heavyBottomR = Math.max(heavyBottomR, r);
                    });

                    console.log("heavyPerRank", _.cloneDeep(heavyPerRank), "heavyBottomR", heavyBottomR);

                    // remove "other" edge
                    let northN = order[r - 1][otherNorth];
                    let southN = order[r][otherSouth];
                    let neighborIndex = neighborsDown[r - 1][northN].indexOf(southN);
                    const otherWeight = weightsDown[r - 1][northN][neighborIndex];
                    weightsDown[r - 1][northN].splice(neighborIndex, 1);
                    neighborsDown[r - 1][northN].splice(neighborIndex, 1);
                    neighborIndex = neighborsUp[r][southN].indexOf(northN);
                    weightsUp[r][southN].splice(neighborIndex, 1);
                    neighborsUp[r][southN].splice(neighborIndex, 1);

                    assertNeighborCoherence();

                    //_.map(order, (orderR, r) => console.log(r, _.map(orderR, n => ranks[r].groups[0].nodes[n].label()).toString()));
                    //console.log("order[1]", _.cloneDeep(order[1]));

                    const rOffset = r - 1;
                    const queue: Array<Map<number, [Map<number, number>, number, boolean]>> = [
                        new Map([[northN, [new Map(), heavyBottomR - rOffset, true]]]), // 0 => r - 1
                        new Map([[southN, [new Map(), heavyBottomR - rOffset, false]]]), // 1 => r
                    ];

                    const addEdge = (srcR: number, srcN: number, dstR: number, dstN: number, weight: number) => {
                        const srcNode = ranks[srcR].groups[0].nodes[srcN];
                        const dstNode = ranks[dstR].groups[0].nodes[dstN];
                        console.log(ranks[srcR].groups[0].nodes[srcN], "srcId", srcNode.id);
                        const newEdge = new Edge(srcNode.id, dstNode.id);
                        const newEdgeId = this.addEdge(newEdge);
                        graph.addEdge(newEdge, newEdgeId);
                        neighborsDown[srcR][srcN].push(dstN);
                        weightsDown[srcR][srcN].push(weight);
                        neighborsUp[dstR][dstN].push(srcN);
                        weightsUp[dstR][dstN].push(weight);
                    };

                    const addNode = (r: number, pos: number, node: OrderNode, nodeId: number) => {
                        const nextN = numNodesGroup[r][0];
                        console.log("add node", node, "with n", nextN, "at position", pos, "in rank", r);
                        console.log("order in rank ", r, ":", _.cloneDeep(order[r]));
                        for (let tmpPos = numNodesGroup[r][0]; tmpPos >= pos + 1; --tmpPos) {
                            order[r][tmpPos] = order[r][tmpPos - 1];
                            console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos]], "moves from position", tmpPos - 1, "to", tmpPos);
                        }
                        order[r][pos] = nextN;
                        console.log("order in rank ", r, ":", _.cloneDeep(order[r]));
                        neighborsDown[r][nextN] = [];
                        weightsDown[r][nextN] = [];
                        neighborsUp[r][nextN] = [];
                        weightsUp[r][nextN] = [];
                        ranks[r].groups[0].addNode(node, nodeId);
                        numNodesGroup[r][0]++;
                        node.rank = r;
                        // update positions
                        _.forEach(order[r], (n, pos) => {
                            positions[r][n] = pos;
                        });

                        assertOrderAndPositionCoherence(r);
                        assertNeighborCoherence();
                        console.log("after add node", "neighborsUp", _.cloneDeep(neighborsUp), "neighborsDown", _.cloneDeep(neighborsDown));

                        return nextN;
                    };

                    const removeNode = (r: number, pos: number, node: OrderNode) => {
                        const n = order[r][pos];
                        console.log("remove node", node, "with n", n, "from position", pos, "in rank", r);
                        console.log("order in rank ", r, ":", _.cloneDeep(order[r]));

                        assertNeighborCoherence();

                        // remove edges
                        _.forEach(neighborsUp[r][n], neighborNorth => {
                            _.forEach(neighborsDown[r - 1][neighborNorth], (neighborR, neighborRIndex) => {
                                if (neighborR === n) {
                                    neighborsDown[r - 1][neighborNorth].splice(neighborRIndex, 1);
                                    weightsDown[r - 1][neighborNorth].splice(neighborRIndex, 1);
                                }
                            });
                        });
                        _.forEach(neighborsDown[r][n], neighborSouth => {
                            _.forEach(neighborsUp[r + 1][neighborSouth], (neighborR, neighborRIndex) => {
                                if (neighborR === n) {
                                    neighborsUp[r + 1][neighborSouth].splice(neighborRIndex, 1);
                                    weightsUp[r + 1][neighborSouth].splice(neighborRIndex, 1);
                                }
                            });
                        });
                        _.forEach(graph.outEdges(node.id), outEdge => {
                            graph.removeEdge(outEdge.id);
                            this.removeEdge(outEdge.id);
                        });
                        _.forEach(graph.inEdges(node.id), inEdge => {
                            graph.removeEdge(inEdge.id);
                            this.removeEdge(inEdge.id);
                        });

                        neighborsUp[r][n] = [];
                        neighborsDown[r][n] = [];

                        assertNeighborCoherence();

                        // adjust n's
                        for (let tmpN = n + 1; tmpN < numNodesGroup[r][0]; ++tmpN) {
                            const oldN = tmpN;
                            const newN = oldN - 1;
                            if (queue[r].has(tmpN)) {
                                //console.log("move n in queue from", tmpN, "to", tmpN - 1)
                                queue[r].set(tmpN - 1, queue[r].get(tmpN));
                                queue[r].delete(tmpN);
                            }
                            console.log("adjust n from", oldN , "to", newN);
                            neighborsDown[r][newN] = neighborsDown[r][oldN];
                            weightsDown[r][newN] = weightsDown[r][oldN];
                            neighborsUp[r][newN] = neighborsUp[r][oldN];
                            weightsUp[r][newN] = weightsUp[r][oldN];
                            if (oldN === northN) {
                                console.log("northN = ", newN);
                                northN = newN;
                            }
                            if (oldN === southN) {
                                console.log("southN = ", newN);
                                southN = newN;
                            }
                            _.forEach(neighborsUp[r][newN], neighborNorth => {
                                _.forEach(neighborsDown[r - 1][neighborNorth], (neighborR, neighborRIndex) => {
                                    if (neighborR === oldN) {
                                        neighborsDown[r - 1][neighborNorth][neighborRIndex] = newN;
                                    }
                                });
                            });
                            _.forEach(neighborsDown[r][newN], neighborSouth => {
                                _.forEach(neighborsUp[r + 1][neighborSouth], (neighborR, neighborRIndex) => {
                                    if (neighborR === oldN) {
                                        neighborsUp[r + 1][neighborSouth][neighborRIndex] = newN;
                                    }
                                });
                            });
                            order[r][positions[r][tmpN]]--;
                        }
                        neighborsDown[r].length = numNodesGroup[r][0] - 1;
                        neighborsUp[r].length = numNodesGroup[r][0] - 1;
                        assertNeighborCoherence();

                        // adjust positions
                        for (let tmpPos = pos + 1; tmpPos < numNodesGroup[r][0]; ++tmpPos) {
                            order[r][tmpPos - 1] = order[r][tmpPos];
                            console.log("order[" + r + "][" + (tmpPos - 1) + "] = " + order[r][tmpPos]);
                            console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos] + (order[r][tmpPos] >= order[r][pos] ? 1 : 0)], "moves from position", tmpPos, "to", tmpPos - 1);
                        }
                        numNodesGroup[r][0]--;
                        ranks[r].groups[0].removeNode(node);
                        order[r].length = numNodesGroup[r][0];
                        positions[r].length = numNodesGroup[r][0];

                        // update positions
                        _.forEach(order[r], (n, pos) => {
                            positions[r][n] = pos;
                        });

                        assertOrderAndPositionCoherence(r);
                        console.log("after remove node", "neighborsUp", _.cloneDeep(neighborsUp), "neighborsDown", _.cloneDeep(neighborsDown));
                    };

                    for (let tmpR = 0; tmpR < queue.length; ++tmpR) {
                        const r = tmpR + rOffset;
                        console.log("move rank", r, _.cloneDeep(queue[tmpR]));
                        for (const [n, value] of queue[tmpR]) {
                            console.log("neighborsUp", _.cloneDeep(neighborsUp), "neighborsDown", _.cloneDeep(neighborsDown));
                            queue[r].delete(n);
                            const pos = positions[r][n];
                            console.log("n", n, "pos", pos);
                            const [parents, downForce, isNorth] = value;
                            const node = ranks[r].groups[0].nodes[n];
                            console.log("move node ", node, "with parents", parents, "downForce", downForce, "isNorth", isNorth);

                            // mark out-neighbors as next to move
                            for (let neighbor = 0; neighbor < neighborsDown[r][n]; ++neighbor) {
                                if (queue.length < tmpR + 2) {
                                    queue[tmpR + 1] = new Map();
                                }
                                if (!queue[tmpR + 1].has(neighborsDown[r][n][neighbor])) {
                                    queue[tmpR + 1].set(neighborsDown[r][n][neighbor], [new Map([[n, weightsDown[r][n][neighbor]]]), 0, false]);
                                } else {
                                    queue[tmpR + 1].get(neighborsDown[r][n][neighbor])[0].set(n, weightsDown[r][n][neighbor]);
                                }
                                console.log("mark neighbor", neighborsDown[r][n][neighbor]);
                            }

                            // store in-neighbors
                            const inNeighbors = [];
                            for (let neighbor = 0; neighbor < neighborsUp[r][n].length; ++neighbor) {
                                if (!parents.has(neighborsUp[r][n][neighbor])) {
                                    inNeighbors.push([neighborsUp[r][n][neighbor], weightsUp[r][n][neighbor]]);
                                }
                            }
                            console.log("inNeighbors", _.cloneDeep(inNeighbors));
                            // create rank below if necessary
                            if (r === order.length - 1) {
                                const newRank = new OrderRank();
                                ranks[0].orderGraph.addRank(newRank);
                                const newGroup = newRank.addGroup(new OrderGroup(null));
                                ranks.push(newRank);
                                numNodesGroup[r + 1] = [0];
                                order[r + 1] = [];
                                positions[r + 1] = [];
                                neighborsDown[r + 1] = [];
                                weightsDown[r + 1] = [];
                                neighborsUp[r + 1] = [];
                                weightsUp[r + 1] = [];
                                crossings[r + 1] = 0;
                                crossingsWithInfinity[r + 1] = 0;
                            }
                            // move node to rank below
                            removeNode(r, pos, node);
                            const nextPos = Math.min(pos, numNodesGroup[r + 1][0]);
                            const nextN = addNode(r + 1, nextPos, node, node.id);
                            console.log("nextPos", nextPos, "nextN", nextN);
                            // if node is part of the "other" node displacement, create new node in place of current node
                            if (downForce > 0) {
                                const newNode = new OrderNode(null);
                                const newNodeId = this.addNode(newNode);
                                const newN = addNode(r, pos, newNode, newNodeId);
                                // add in-edges from parents
                                parents.forEach((inWeight, inNeighbor) => {
                                    addEdge(r - 1, inNeighbor, r, newN, inWeight);
                                });
                                // create edge between new node and moved node
                                addEdge(r, newN, r + 1, nextN, otherWeight);
                                // update position of north and south extension to re-add the "other" edge later
                                if (isNorth) {
                                    console.log("northN = ", nextN);
                                    northN = nextN;
                                } else {
                                    console.log("southN = ", nextN);
                                    southN = nextN;
                                }
                                // mark moved node to be moved again
                                if (queue.length < tmpR + 2) {
                                    queue[tmpR + 1] = new Map();
                                }
                                queue[tmpR + 1].set(nextN, [new Map([[n, otherWeight]]), downForce - 1, isNorth]);
                                console.log("mark again", nextN);
                                assertNeighborCoherence();
                            }
                            // for all in-neighbors that are not parents, create new node in place of current node
                            for (let neighbor = 0; neighbor < inNeighbors.length; ++neighbor) {
                                const [inNeighbor, inWeight] = inNeighbors[neighbor];
                                const newNode = new OrderNode(null);
                                const newNodeId = this.addNode(newNode);
                                const newN = addNode(r, pos, newNode, newNodeId);
                                // add in-edge
                                addEdge(r - 1, inNeighbor, r, newN, inWeight);
                                // add edge between new node and moved node
                                addEdge(r, newN, r + 1, nextN, inWeight);
                                assertNeighborCoherence();
                            }
                        }
                    }
                    // add "other" edge
                    neighborsDown[heavyBottomR][northN].push(southN);
                    weightsDown[heavyBottomR][northN].push(otherWeight);
                    console.log(neighborsUp[heavyBottomR + 1]);
                    neighborsUp[heavyBottomR + 1][southN].push(northN);
                    weightsUp[heavyBottomR + 1][southN].push(otherWeight);
                }

                let counter = 0;
                let invalid = false;
                let crossing = getIllegalCrossing();
                console.log("illegal crossing", crossing);
                while (crossing !== null) {
                    if (counter++ === 1 ) {
                        invalid = true;
                        break;
                    }
                    if (debug) {
                        console.log("resolve", _.sum(crossingsWithInfinity));
                    }
                    resolveCrossing(crossing);
                    for (let r = 1; r < ranks.length; ++r) {
                        crossingsWithInfinity[r] = countCrossings(order[r], r, "UP", true);
                    }
                    crossing = getIllegalCrossing();
                }

                Timer.stop("resolveY")
                return !invalid;
            }

            const originalOrder = _.cloneDeep(order);
            const originalPositions = _.cloneDeep(positions);

            doNothing = true;
            reorder(false);
            resolveY();

            /*if (!resolveX()) {
                order = _.cloneDeep(originalOrder);
                positions = _.cloneDeep(originalPositions);
                reorder(true);
                let success = resolveX();
                if (!success) {
                    order = _.cloneDeep(originalOrder);
                    positions = _.cloneDeep(originalPositions);
                    reorder(true);
                    success = resolveY();
                    Assert.assert(success, "illegal crossings when starting from original order");
                }
            }*/

            _.forEach(ranks, (rank: OrderRank, r: number) => {
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    group.order = _.map(_.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]),
                        (pos: number) => pos - groupOffset[r][g]
                    );
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
                        node.position = positions[r][groupOffset[r][g] + n] - groupOffset[r][g];
                    });
                });
            });
            Timer.stop("doOrder");
        }

        this._addGroupEdges();

        _.forEach(this._groupGraph.components(), (groupGraphComponent: Component<OrderGroup, Edge<any, any>>) => {
            const componentGraph = new OrderGraph();
            const ranks: Array<OrderRank> = [];
            _.forEach(groupGraphComponent.nodes(), (group: OrderGroup) => {
                if (ranks[group.rank.id] === undefined) {
                    ranks[group.rank.id] = new OrderRank();
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

            componentGraph._addGroupEdges();
            componentGraph._addRankEdges();

            if (componentGraph.edges().length === 0) {
                // when there are no edges, no need to order
                return;
            }

            doOrder(componentGraph);
        });
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
        const sortedEdges = _.sortBy(edges, edge => edge[0] * numSouth + edge[1]);
        const southSequence = _.map(sortedEdges, edge => edge[1]);
        const weights = _.map(sortedEdges, edge => edge[2]);

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
        _.forEach(southSequence, (south: number, i: number) => {
            let index = south + firstIndex;
            tree[index] += weights[i];
            let weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += tree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                tree[index] += weights[i];
            }
            crossWeight += weights[i] * weightSum;
        });
        return crossWeight;
    }
}