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

    public ranks() {
        return this._rankGraph.toposort();
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

    public outNeighbors(id: number) {
        return this._nodeGraph.outNeighbors(id);
    }

    public incidentEdges(id: number) {
        return this._nodeGraph.incidentEdges(id);
    }

    public edgeBetween(srcId: number, dstId: number) {
        return this._nodeGraph.edgeBetween(srcId, dstId);
    }

    public maxId() {
        return this._nodeGraph.maxId();
    }

    public groupEdges() {
        this._addGroupEdges();
        return this._groupGraph.edges();
    }

    public order(hasGroups: boolean, shuffles: number = 0, doNothing: boolean = false, debug: boolean = false): void {
        const doOrder = (graph: OrderGraph, shuffles: number = 0, downward: boolean = true) => {
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
            const virtual = [];
            const neighborsDown = [];
            const weightsDown = [];
            const neighborsUp = [];
            const weightsUp = [];
            let order = []; // current order of this level (e. g. 2, 0, 1)
            let positions = []; // inverse of order (e. g. 1, 2, 0)
            const crossings = []; // number of crossings above each rank
            // set neighbors
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                groupOffset[r] = [];
                virtual[r] = [];
                neighborsDown[r] = [];
                weightsDown[r] = [];
                neighborsUp[r] = [];
                weightsUp[r] = [];
                order[r] = new Array(numNodesRank[r]);
                positions[r] = new Array(numNodesRank[r]);
                crossings[r] = Number.POSITIVE_INFINITY;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    groupOffset[r][g] = groupOffsets[group.id];
                    const groupOrder = _.range(groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]);
                    for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                        order[r][groupOffset[r][g] + n] = groupOrder[n];
                    }
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
                        node.initialRank = r;
                        node.rank = r;
                        const pos = groupOffsets[group.id] + n;
                        virtual[r][pos] = node.isVirtual;
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

            const countCrossings = (testOrder: Array<number>, r: number, direction: "UP" | "DOWN", withInfinity: boolean = false) => {
                const edges = [];
                const neighbors = (direction === "UP" ? neighborsUp : neighborsDown);
                const weights = (direction === "UP" ? weightsUp : weightsDown);
                const neighborRank = (direction === "UP" ? (r - 1) : (r + 1));
                for (let pos = 0; pos < testOrder.length; ++pos) {
                    for (let neighbor = 0; neighbor < neighbors[r][testOrder[pos]].length; ++neighbor) {
                        let weight = weights[r][testOrder[pos]][neighbor];
                        if (weight === Number.POSITIVE_INFINITY) {
                            if (withInfinity) {
                                weight = 1000000;
                            } else {
                                weight = 1;
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
             * @param shuffle
             */
            const reorder = (countInitial: boolean = false, shuffle: boolean = false) => {
                Timer.start("reorder");

                if (shuffle) {
                    _.forEach(ranks, (rank: OrderRank, r: number) => {
                        _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                            const groupOrder = Shuffle.shuffle(_.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]));
                            _.forEach(groupOrder, (n, pos) => {
                                order[r][groupOffset[r][g] + pos] = n;
                                positions[r][n] = groupOffset[r][g] + pos;
                            });
                        });
                    });
                }

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

                            if (debug) {
                                console.log("new means", _.map(nodeMeans, pair => ranks[r].groups[0].nodes[pair[0]].id + ": " + pair[1]))
                            }

                            // sort by the means
                            const newGroupOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                            for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                                newOrder[groupOffset[r][g] + n] = newGroupOrder[n];
                            }
                        }
                        const changes = [];
                        const permutation = new Array(order.length);
                        _.forEach(newOrder, (n, pos) => {
                            permutation[pos] = positions[r][n];
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
                        _.forEach(changes, change => {
                            const tmpOrder = _.concat(
                                _.slice(order[r], 0, change[0]),
                                _.slice(newOrder, change[0], change[1] + 1),
                                _.slice(order[r], change[1] + 1)
                            );
                            //console.log(order[r], newOrder, change, permutation);
                            Assert.assert(tmpOrder.length === newOrder.length, "tmpOrder has wrong length");
                            Assert.assertEqual(_.sortBy(tmpOrder), _.range(tmpOrder.length), "tmpOrder is not contiguous");
                            if (debug) {
                                console.log("try new order", _.map(tmpOrder, n => ranks[r].groups[0].nodes[n].id));
                            }
                            // count crossings with new order
                            const prevCrossingsNorth = crossings[r + crossingOffsetNorth];
                            const newCrossingsNorth = countCrossings(tmpOrder, r, northDirection);

                            let newCrossingsSouth = 0;
                            let prevCrossingsSouth = 0;
                            if (r !== lastRank) {
                                prevCrossingsSouth = crossings[r + crossingOffsetSouth];
                                newCrossingsSouth = countCrossings(tmpOrder, r, southDirection);
                            }
                            const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
                            const fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth);
                            if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
                                if (debug) {
                                    console.log("fewer crossings north", prevCrossingsNorth, "->", newCrossingsNorth,  "south: ", prevCrossingsSouth, "->", newCrossingsSouth);
                                }
                                if (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth) {
                                    improveCounter = 2;
                                }
                                crossings[r + crossingOffsetNorth] = newCrossingsNorth;
                                if (r !== lastRank) {
                                    crossings[r + crossingOffsetSouth] = newCrossingsSouth;
                                }
                                order[r] = tmpOrder;
                                for (let pos = 0; pos < order[r].length; ++pos) {
                                    positions[r][order[r][pos]] = pos;
                                }
                                if (debug && r <= 5) {
                                    storeLocal();
                                }
                            } else {
                                if (debug) {
                                    console.log("not fewer crossings north", prevCrossingsNorth, "->", newCrossingsNorth,  "south: ", prevCrossingsSouth, "->", newCrossingsSouth);
                                }
                            }
                        });
                        Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                        Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                    }
                    downward = !downward;
                }

                for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, "UP");
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

            const assertEdgesBetweenNeighboringRanks = () => {
                Assert.assertAll(this.edges(), edge => {
                    return this.node(edge.src).rank + 1 === this.node(edge.dst).rank;
                }, "edge not between neighboring ranks");
            }

            const getConflict = (type: "HEAVYHEAVY" | "HEAVYLIGHT", r: number) => {
                if (crossings[r] < 1000000) {
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
                    const posSouth = positions[r][n];
                    for (let neighbor = 0; neighbor < neighborsUp[r][n].length; ++neighbor) {
                        const posNorth = positions[r - 1][neighborsUp[r][n][neighbor]];
                        const heavy = (weightsUp[r][n][neighbor] === Number.POSITIVE_INFINITY);
                        if (type === "HEAVYHEAVY" && !heavy) {
                            continue;
                        }
                        const intranode = (heavy && !ranks[r].groups[0].nodes[n].isVirtual);
                        if (type === "HEAVYLIGHT" && heavy && !intranode) {
                            continue;
                        }
                        const segment = [posNorth, posSouth, heavy];
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
                        const [posNorth, posSouth, heavy, intranode] = newSegment;
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
                if (step < 50) {
                    //return;
                }
                const obj = JSON.parse(window.localStorage.getItem("orderGraph"));
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
                const stepObj = {ranks: [], edges: []};
                _.forEach(ranks, (rank: OrderRank) => {
                    const rankObj = [];
                    _.forEach(rank.orderedGroups(), (group: OrderGroup) => {
                        const groupObj = {label: group.label(), nodes: []};
                        _.forEach(group.orderedNodes(), (node: OrderNode) => {
                            groupObj.nodes.push({id: node.id, label: node.label()});
                        });
                        rankObj.push(groupObj);
                    });
                    stepObj.ranks.push(rankObj);
                });
                _.forEach(graph.edges(), edge => {
                    stepObj.edges.push({src: edge.src, dst: edge.dst, weight: edge.weight === Number.POSITIVE_INFINITY ? "INFINITY" : edge.weight});
                });
                obj.push(stepObj);
                window.localStorage.setItem("orderGraph", JSON.stringify(obj));
            };

            /**
             * Tries to resolve illegal crossings, i. e. crossings of edges with infinite weight.
             */
            const resolveConflicts = () => {
                //return;
                /*for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, "UP", false);
                }
                console.log("crossings", _.sum(crossings));*/
                Timer.start("resolve");
                const resolveConflict = (conflict) => {
                    const [r, crossedNorthPos, crossedSouthPos, crossingNorthPos, crossingSouthPos] = conflict;
                    Assert.assert(groupOffset[r].length === 1, "more than one group");
                    Assert.assert(groupOffset[r - 1].length === 1, "more than one group");
                    const crossedNorthN = order[r - 1][crossedNorthPos];
                    const crossedNorthNode = ranks[r - 1].groups[0].nodes[crossedNorthN];
                    const crossedSouthN = order[r][crossedSouthPos];
                    const crossedSouthNode = ranks[r].groups[0].nodes[crossedSouthN];
                    const crossingNorthN = order[r - 1][crossingNorthPos];
                    let crossingNorthNode = ranks[r - 1].groups[0].nodes[crossingNorthN];
                    const crossingSouthN = order[r][crossingSouthPos];
                    let crossingSouthNode = ranks[r].groups[0].nodes[crossingSouthN];
                    const crossingEdge = graph.edgeBetween(crossingNorthNode.id, crossingSouthNode.id);
                    //console.log(r, crossedNorthNode.label(), crossedSouthNode.label(), crossingNorthNode.label(), crossingSouthNode.label());

                    const resolveHeavyHeavy = () => {
                        console.log("resolveHeavyHeavy");
                        _.pull(order[r], crossingSouthN);
                        order[r].splice(crossedSouthPos, 0, crossingSouthN);
                        // update positions
                        _.forEach(order[r], (n, pos) => {
                            positions[r][n] = pos;
                        });
                        for (let tmpR = r; tmpR <= Math.min(r + 1, ranks.length - 1); ++tmpR) {
                            crossings[tmpR] = countCrossings(order[tmpR], tmpR, "UP", true);
                        }
                    };

                    const resolveY = () => {
                        console.log("resolveY");
                        const addEdge = (srcNode: OrderNode, dstNode: OrderNode, weight: number) => {
                            if (srcNode.isVirtual && dstNode.isVirtual) {
                                weight = Number.POSITIVE_INFINITY;
                            }
                            const newEdge = new Edge(srcNode.id, dstNode.id, weight);
                            const newEdgeId = this.addEdge(newEdge);
                            graph.addEdge(newEdge, newEdgeId);
                            Assert.assert(srcNode.rank + 1 === dstNode.rank, "edge not between neighboring ranks", srcNode, dstNode);
                        };

                        const removeEdge = (srcNode: OrderNode, dstNode: OrderNode) => {
                            const edge = graph.edgeBetween(srcNode.id, dstNode.id);
                            graph.removeEdge(edge.id);
                            this.removeEdge(edge.id);
                        };

                        const addNode = (r: number, pos: number, node: OrderNode) => {
                            const nextN = numNodesGroup[r][0];
                            //console.log("add node", node, "with n", nextN, "at position", pos, "in rank", r);
                            for (let tmpPos = numNodesGroup[r][0]; tmpPos >= pos + 1; --tmpPos) {
                                order[r][tmpPos] = order[r][tmpPos - 1];
                                //console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos]], "moves from position", tmpPos - 1, "to", tmpPos);
                            }
                            order[r][pos] = nextN;
                            ranks[r].groups[0].addNode(node, node.id);
                            numNodesGroup[r][0]++;
                            node.rank = r;
                            node.index = nextN;
                            // update positions
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });

                            assertOrderAndPositionCoherence(r);

                            return nextN;
                        };

                        const removeNode = (node: OrderNode) => {
                            const r = node.rank;
                            const n = node.index;
                            const pos = positions[r][n];
                            //console.log("remove node", node, "with n", n, "from position", pos, "in rank", r);

                            // adjust n's
                            for (let tmpN = n + 1; tmpN < numNodesGroup[r][0]; ++tmpN) {
                                order[r][positions[r][tmpN]]--;
                                //console.log("node", ranks[r].groups[0].nodes[tmpN], "changes index from", ranks[r].groups[0].nodes[tmpN].index + 1, "to", ranks[r].groups[0].nodes[tmpN].index);
                            }
                            ranks[r].groups[0].removeNode(node);

                            // adjust positions
                            for (let tmpPos = pos + 1; tmpPos < numNodesGroup[r][0]; ++tmpPos) {
                                order[r][tmpPos - 1] = order[r][tmpPos];
                                //console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos]], "moves from position", tmpPos, "to", tmpPos - 1);
                            }

                            numNodesGroup[r][0]--;
                            order[r].length = numNodesGroup[r][0];
                            positions[r].length = numNodesGroup[r][0];

                            // update positions
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });

                            assertOrderAndPositionCoherence(r);
                        };

                        // mark nodes that must not be moved
                        const nonMoving = new Set();
                        const intranodePathEnds = new Set();
                        const sinks = new Set();
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
                                sinks.add(node);
                            }
                        });

                        // create new rank if necessary
                        if (_.filter(_.last(ranks).groups[0].nodes, node => !nonMoving.has(node)).length > 0) {
                            const newR = ranks.length;
                            const newRank = new OrderRank();
                            this.addRank(newRank);
                            const newGroup = new OrderGroup(null);
                            newRank.addGroup(newGroup);
                            const newRankComponent = new OrderRank();
                            graph.addRank(newRankComponent);
                            ranks.push(newRankComponent);
                            newRankComponent.addGroup(newGroup);
                            this._groupGraph.addEdge(new Edge(ranks[newR - 1].groups[0].id, ranks[newR].groups[0].id));
                            this._rankGraph.addEdge(new Edge(ranks[newR - 1].id, ranks[newR].id));
                            newRankComponent.order = [0];
                            numNodesGroup[newR] = [0];
                            groupOffset[newR] = [0];
                            order[newR] = [];
                            positions[newR] = [];
                            crossings[newR] = 0;
                        }

                        // move nodes down and create virtual nodes
                        for (let tmpR = ranks.length - 1; tmpR >= r; --tmpR) {
                            const northNodes = _.map(order[tmpR - 1], n => ranks[tmpR - 1].groups[0].nodes[n]);
                            _.forEach(northNodes, (node: OrderNode) => {
                                if (!nonMoving.has(node)) {
                                    const pos = positions[tmpR - 1][node.index];
                                    removeNode(node);
                                    addNode(tmpR, order[tmpR].length, node);
                                    if (tmpR === r) {
                                        // create a virtual node for each in edge and route edge through new node
                                        const sortedEdges = _.sortBy(graph.inEdges(node.id), edge => positions[r - 2][graph.node(edge.src).index]);
                                        _.forEachRight(sortedEdges, inEdge => {
                                            const newNode = new OrderNode(null, true, node.label() + "'");
                                            this.addNode(newNode);
                                            addNode(r - 1, pos, newNode);
                                            newNode.initialRank = r - 1;
                                            const srcNode = graph.node(inEdge.src);
                                            removeEdge(srcNode, node);
                                            addEdge(srcNode, newNode, inEdge.weight);
                                            addEdge(newNode, node, inEdge.weight);
                                        });
                                    }
                                } else {
                                    if (intranodePathEnds.has(node)) {
                                        // create a virtual node for each out edge and route edge through new node
                                        Assert.assertAll(graph.outEdges(node.id), edge => graph.node(edge.dst).rank === tmpR + 1, "edge below intranode path end not spanning two ranks");
                                        // sort edges to prevent crossings between them
                                        const sortedEdges = _.sortBy(graph.outEdges(node.id), edge => positions[tmpR + 1][graph.node(edge.dst).index]);
                                        _.forEach(sortedEdges, outEdge => {
                                            const newNode = new OrderNode(null, true, node.label() + "'");
                                            this.addNode(newNode);
                                            addNode(tmpR, order[tmpR].length, newNode);
                                            newNode.initialRank = tmpR;
                                            const dstNode = graph.node(outEdge.dst);
                                            removeEdge(node, dstNode);
                                            addEdge(node, newNode, outEdge.weight);
                                            addEdge(newNode, dstNode, outEdge.weight);
                                        });
                                    } else if (!sinks.has(node)) {
                                        // there is a an internode segment between upper and this rank
                                        // => change order within this rank
                                        const lowerNode = graph.outNeighbors(node.id)[0];
                                        removeNode(lowerNode);
                                        addNode(tmpR, order[tmpR].length, lowerNode);
                                    }
                                }
                            });
                        }

                        // recreate neighbors data structure
                        for (let tmpR = 0; tmpR < ranks.length; ++tmpR) {
                            neighborsDown[tmpR] = [];
                            weightsDown[tmpR] = [];
                            neighborsUp[tmpR] = [];
                            weightsUp[tmpR] = [];
                            _.forEach(ranks[tmpR].groups[0].nodes, (node: OrderNode, n: number) => {
                                neighborsDown[tmpR][n] = [];
                                weightsDown[tmpR][n] = [];
                                neighborsUp[tmpR][n] = [];
                                weightsUp[tmpR][n] = [];
                            });
                        }
                        _.forEach(graph.edges(), edge => {
                            const srcNode = graph.node(edge.src);
                            const dstNode = graph.node(edge.dst);
                            Assert.assert(srcNode.rank + 1 === dstNode.rank, "edge not between neighboring ranks", srcNode, dstNode);
                            neighborsDown[srcNode.rank][srcNode.index].push(dstNode.index);
                            weightsDown[srcNode.rank][srcNode.index].push(edge.weight);
                            neighborsUp[dstNode.rank][dstNode.index].push(srcNode.index);
                            weightsUp[dstNode.rank][dstNode.index].push(edge.weight);
                        });

                        assertNeighborCoherence();

                        for (let tmpR = r - 1; tmpR < ranks.length; ++tmpR) {
                            crossings[tmpR] = countCrossings(order[tmpR], tmpR, "UP", true);
                        }
                    }

                    const checkXResolution = (side: "LEFT" | "RIGHT") => {
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
                            //if (side === "LEFT") console.log("node " + node.id + " now is in group " + group);
                            nodesPerRank[r].set(node, group);
                            queue.push([node, group]);
                            const addIntermediate = () => {
                                if (geFun(maxOtherNodePerRank[r], minHeavyNodePerRank[r])) {
                                    //if (side === "LEFT") console.log(maxOtherNodePerRank[r], "ge", minHeavyNodePerRank[r]);
                                    const intermediate = [];
                                    for (let pos = maxOtherNodePerRank[r]; pos !== minHeavyNodePerRank[r]; pos += moveDir) {
                                        const node = ranks[r].groups[0].nodes[order[r][pos]];
                                        if (node === undefined) {
                                            //console.log("undefined", "pos", pos, "nodes", ranks[r].groups[0].nodes, order[r][pos], "order", order[r], "moveDir", moveDir, "maxOtherNodePerRank[r]", maxOtherNodePerRank[r], "minHeavyNodePerRank[r]", minHeavyNodePerRank[r]);
                                        }
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
                                maxOtherNodePerRank[r] = maxFun(maxOtherNodePerRank[r], positions[r][node.index]);
                                if (maxOtherNodePerRank[r] !== prev) {
                                    //if (side === "LEFT") console.log("maxMovingNodePerRank[" + r + "] = ", maxOtherNodePerRank[r]);
                                }
                                if (maxOtherNodePerRank[r] !== prev && minHeavyNodePerRank[r] !== Number.POSITIVE_INFINITY && minHeavyNodePerRank[r] !== Number.NEGATIVE_INFINITY) {
                                    addIntermediate();
                                }
                            } else {
                                // potentially heavy
                                const prev = minHeavyNodePerRank[r];
                                minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[r][node.index]);
                                if (minHeavyNodePerRank[r] !== prev) {
                                    //if (side === "LEFT") console.log("minHeavyNodePerRank[" + r + "] = ", minHeavyNodePerRank[r]);
                                }
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
                            //if (side === "LEFT") console.log("node", node.id, "minRank", minRank);
                            if (node.rank > minRank) {
                                addNeighbors("inEdges", "src", -1);
                            }
                            if (node.rank === minRank && geFun(positions[node.rank][node.index], minHeavyNodePerRank[node.rank])) {
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
                            return null;
                        }
                        // group nodes
                        const nodesPerRankGrouped = [];
                        _.forEach(nodesPerRank, (nodes, r) => {
                            nodesPerRankGrouped[r] = {
                                "GREEN": new Set(),
                                "MOVING": new Set(),
                            };
                            //if (side === "RIGHT") console.log("rank", r, "nodes", nodes);
                            minHeavyNodePerRank[r] = (side === "RIGHT" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
                            //if (side === "LEFT") console.log("rank", r, ":", _.map(order[r], n => ranks[r].groups[0].nodes[n].id).toString());
                            nodes.forEach((group, node) => {
                                if (group !== "RED") {
                                    // "GREEN" or "YELLOW"
                                    // because we want to move as few nodes as possible, we count the "YELLOW" nodes to the "GREEN" nodes
                                    nodesPerRankGrouped[r]["GREEN"].add(node);
                                    //if (side === "LEFT") console.log("rank", r, "node", node.id, "group", group, "position", positions[r][node.index]);
                                    minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[r][node.index]);
                                }
                            });
                            nodes.forEach((group, node) => {
                                if (group === "RED" && geFun(positions[r][node.index], minHeavyNodePerRank[node.rank])) {
                                    nodesPerRankGrouped[r]["MOVING"].add(node);
                                }
                            });
                        });
                        return nodesPerRankGrouped;
                    };

                    const resolveX = (side: "LEFT" | "RIGHT", nodesPerRank) => {
                        console.log("resolveX");
                        let minChangedRank = Number.POSITIVE_INFINITY;
                        let maxChangedRank = Number.NEGATIVE_INFINITY;
                        _.forEach(nodesPerRank, (rank, r: number) => {
                            if (rank["MOVING"].size === 0 || rank["GREEN"].size === 0) {
                                return;
                            }
                            const heavy: Array<OrderNode> = _.sortBy(Array.from(rank["GREEN"]), node => positions[r][node.index]);
                            const moving: Array<OrderNode> = _.sortBy(Array.from(rank["MOVING"]), node => positions[r][node.index]);
                            const newOrder = [];
                            _.forEach(order[r], n => {
                                const node = ranks[r].groups[0].nodes[n];
                                if (rank["MOVING"].has(node)) {
                                    return; // do nothing
                                }
                                if (side === "RIGHT" && n === heavy[0].index) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.index);
                                    });
                                }
                                newOrder.push(n);
                                if (side === "LEFT" && n === _.last(heavy).index) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.index);
                                    });
                                }
                            });
                            order[r] = newOrder;
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });
                            minChangedRank = Math.min(minChangedRank, r);
                            maxChangedRank = Math.max(maxChangedRank, r + 1);
                        });
                        for (let r = minChangedRank; r <= Math.min(maxChangedRank, ranks.length - 1); ++r) {
                            crossings[r] = countCrossings(order[r], r, "UP", true);
                        }

                        if (debug) {
                            storeLocal();
                        }
                    };

                    if (crossingEdge.weight === Number.POSITIVE_INFINITY) {
                        resolveHeavyHeavy();
                    } else {
                        const leftResolution = checkXResolution("LEFT");
                        const rightResolution = checkXResolution("RIGHT");
                        if (leftResolution === null) {
                            if (rightResolution === null) {
                                resolveY();
                            } else {
                                resolveX("RIGHT", rightResolution);
                            }
                        } else {
                            if (rightResolution === null) {
                                resolveX("LEFT", leftResolution);
                            } else {
                                const numNodesLeft = _.sum(_.map(leftResolution, rank => rank["MOVING"].size));
                                const numNodesRight= _.sum(_.map(rightResolution, rank => rank["MOVING"].size));
                                if (numNodesLeft < numNodesRight) {
                                    resolveX("LEFT", leftResolution);
                                } else {
                                    resolveX("RIGHT", rightResolution);
                                }
                            }
                        }
                    }
                }

                if (debug) {
                    storeLocal();
                }

                for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, "UP", true);
                }
                for (let r = 1; r < ranks.length; ++r) {
                    while (getConflict("HEAVYHEAVY", r) !== null) {
                        const conflict = getConflict("HEAVYHEAVY", r);
                        resolveConflict(conflict);
                        if (debug) {
                            storeLocal();
                        }
                    }
                    while (getConflict("HEAVYLIGHT", r) !== null) {
                        const conflict = getConflict("HEAVYLIGHT", r);
                        resolveConflict(conflict);
                        if (debug) {
                            storeLocal();
                        }
                    }
                }

                /*for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, "UP", false);
                }
                console.log("crossings", _.sum(crossings));*/

                Timer.stop("resolve")
            }

            reorder(false);
            if (shuffles > 0) {
                let numCrossings = _.sum(crossings);
                let minCrossings = numCrossings;
                let bestOrder = _.cloneDeep(order);
                for (let i = 0; i < shuffles; ++i) {
                    for (let r = 1; r < ranks.length; ++r) {
                        crossings[r] = Number.POSITIVE_INFINITY;
                    }
                    reorder(false, true);
                    numCrossings = _.sum(crossings);
                    if (numCrossings < minCrossings) {
                        minCrossings = numCrossings;
                        bestOrder = _.cloneDeep(order);
                    }
                }
                if (numCrossings !== minCrossings) {
                    order = _.cloneDeep(bestOrder);
                    for (let r = 0; r < ranks.length; ++r) {
                        _.forEach(bestOrder[r], (n, pos) => {
                            order[r][pos] = n;
                            positions[r][n] = pos;
                        });
                    }
                }
            }

            if (!hasGroups) {
                resolveConflicts();
            }
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

        const groupComponents = this._groupGraph.components();
        let counter = 0;
        _.forEach(groupComponents, (groupGraphComponent: Component<OrderGroup, Edge<any, any>>) => {
            //console.log("component", counter++, "of", groupComponents.length);
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

            doOrder(componentGraph, shuffles);
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