import * as _ from "lodash";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Component from "../graph/component";

export default class OrderGraph {
    private _rankGraph: Graph<OrderRank, Edge<any, any>>;
    private _groupGraph: Graph<OrderGroup, Edge<any, any>>;
    private _nodeGraph: Graph<OrderNode, Edge<any, any>>;

    constructor() {
        this._rankGraph = new Graph<OrderRank, Edge<any, any>>();
        this._groupGraph = new Graph<OrderGroup, Edge<any, any>>();
        this._nodeGraph = new Graph<OrderNode, Edge<any, any>>();
    }

    public addRank(rank: OrderRank, id: number = null) {
        rank.orderGraph = this;
        return this._rankGraph.addNode(rank, id);
    }

    public addGroup(group: OrderGroup, id: number = null) {
        return this._groupGraph.addNode(group, id);
    }

    public addNode(node: OrderNode, id: number = null) {
        return this._nodeGraph.addNode(node, id);
    }

    public addEdge(edge: Edge<any, any>) {
        return this._nodeGraph.addEdge(edge);
    }

    private _addGroupEdges() {
        _.forEach(this._nodeGraph.edges(), (edge: Edge<any, any>) => {
            const srcGroupId = this._nodeGraph.node(edge.src).group.id;
            const dstGroupId = this._nodeGraph.node(edge.dst).group.id;
            const groupEdge = this._groupGraph.edgeBetween(srcGroupId, dstGroupId);
            if (groupEdge === undefined) {
                this._groupGraph.addEdge(new Edge(srcGroupId, dstGroupId));
            } else {
                groupEdge.weight++;
            }
        });
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

    public orderedGroups() {
        return this._groupGraph.toposort();
    }

    public edges() {
        return this._nodeGraph.edges();
    }

    public outEdges(id: number) {
        return this._nodeGraph.outEdges(id);
    }

    public groupEdges() {
        return this._groupGraph.edges();
    }

    public sourceGroups(): Array<OrderGroup> {
        return this._groupGraph.sources();
    }

    public sinkGroups(): Array<OrderGroup> {
        return this._groupGraph.sinks();
    }

    public order(): void {
        const doOrder = (graph: OrderGraph, downward: boolean = true) => {
            /*console.log();
            console.log();
            console.log();
            console.log();
            console.log("ORDERING");*/

            const ranks = graph._rankGraph.toposort();
            const groupOffsets = []; // number of nodes in groups left of this group by group id
            const numNodesGroup = []; // number of nodes per group per rank
            const numNodesRank = []; // total number of nodes per rank
            _.forEach(ranks, (rank: OrderRank, r: number) => {
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
                    try {
                        //console.log(node.reference.reference.rank, node.reference.reference.label, groupOffsets[group.id] + nodeIndex);
                    } catch (e) {

                    }
                });
            });
            const groupOffset = []; // number of nodes in groups left of this group by rank
            const neighborsDown = [];
            const weightsDown = [];
            const neighborsUp = [];
            const weightsUp = [];
            const order = []; // current order of this level (e. g. 2, 0, 1)
            const positions = []; // inverse of order (e. g. 1, 2, 0)
            const crossings = []; // number of crossings above each rank

            // set neighbors
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                groupOffset[r] = [];
                neighborsDown[r] = [];
                weightsDown[r] = [];
                neighborsUp[r] = [];
                weightsUp[r] = [];
                order[r] = _.range(numNodesRank[r]);
                positions[r] = _.clone(order[r]);
                crossings[r] = Number.POSITIVE_INFINITY;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    groupOffset[r][g] = groupOffsets[group.id];
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
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
            });
            crossings[0] = 0;


            /*console.log("groupOffset", _.cloneDeep(groupOffset));
            console.log("neighborsDown", _.cloneDeep(neighborsDown));
            console.log("neighborsUp", _.cloneDeep(neighborsUp));
            console.log("order", _.cloneDeep(order));
            console.log("positions", _.cloneDeep(positions));
            console.log("crossings", _.cloneDeep(crossings));*/

            let improved = ranks.length > 1 ? 2 : 0; // if only one rank, nothing to order
            while (improved > 0) {
                //console.log("TOTAL CROSSINGS", _.sum(crossings));
                improved--;
                let firstRank = downward ? 1 : ranks.length - 2;
                let lastRank = downward ? ranks.length - 1 : 0;
                const direction = downward ? 1 : -1;
                const neighborsNorth = downward ? neighborsUp : neighborsDown;
                const neighborsSouth = downward ? neighborsDown : neighborsUp;
                const weightsNorth = downward ? weightsUp : weightsDown;
                const weightsSouth = downward ? weightsDown : weightsUp;
                const crossingOffsetNorth = downward ? 0 : 1;
                const crossingOffsetSouth = downward ? 1 : 0;
                //console.log(downward ? "DOWN" : "UP");
                for (let r = firstRank; r - direction !== lastRank; r += direction) {
                    //console.log("rank", r);
                    const newOrder = new Array(order[r].length);
                    const northRank = r - direction;
                    const southRank = r + direction;

                    const prevCrossingsNorth = crossings[r + crossingOffsetNorth];

                    if (prevCrossingsNorth === 0) {
                        // no need to reorder
                        //console.log("skip because already 0");
                        continue;
                    }

                    for (let g = 0; g < numNodesGroup[r].length; ++g) {
                        if (ranks[r].orderedGroups()[g].isFixed) {
                            //console.log("fixed");
                            for (let n = groupOffset[r][g]; n < groupOffset[r][g] + numNodesGroup[r][g]; ++n) {
                                newOrder[n] = order[n];
                            }
                            continue;
                        }
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
                        /*console.log("oldGroupOrder", _.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]));
                        console.log("nodeMeans[" + r + "][" + g + "]", nodeMeans);
                        console.log("newGroupOrder", _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]));*/

                        // sort by the means
                        const newGroupOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                        for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                            newOrder[groupOffset[r][g] + n] = newGroupOrder[n];
                        }
                    }
                    if (!_.isEqual(newOrder, order[r]) || crossings[r] === Number.POSITIVE_INFINITY) {
                        //console.log("try new order", _.cloneDeep(newOrder));
                        // count crossings with new order
                        const northEdges = [];
                        for (let pos = 0; pos < order[r].length; ++pos) {
                            for (let neighbor = 0; neighbor < neighborsNorth[r][newOrder[pos]].length; ++neighbor) {
                                northEdges.push([
                                    positions[northRank][neighborsNorth[r][newOrder[pos]][neighbor]],
                                    pos,
                                    weightsNorth[r][newOrder[pos]][neighbor],
                                ]);
                            }
                        }
                        const newCrossingsNorth = this._countCrossings(order[northRank].length, order[r].length, northEdges);

                        let newCrossingsSouth = 0;
                        let prevCrossingsSouth = 0;
                        if (r !== lastRank) {
                            const southEdges = [];
                            for (let pos = 0; pos < order[r].length; ++pos) {
                                for (let neighbor = 0; neighbor < neighborsSouth[r][newOrder[pos]].length; ++neighbor) {
                                    southEdges.push([
                                        pos,
                                        positions[southRank][neighborsSouth[r][newOrder[pos]][neighbor]],
                                        weightsSouth[r][newOrder[pos]][neighbor],
                                    ]);
                                }
                            }
                            newCrossingsSouth = this._countCrossings(order[r].length, order[southRank].length, southEdges);
                            prevCrossingsSouth = crossings[r + crossingOffsetSouth];
                        }
                        const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
                        const fewerOrEqualCrossingsTotal = newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth;
                        if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
                            //console.log("fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                            if (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth) {
                                improved = 2;
                            }
                            crossings[r + crossingOffsetNorth] = newCrossingsNorth;
                            //console.log("crossings[" + (r + crossingOffsetNorth) + "] = " + newCrossingsNorth);
                            if (r !== lastRank) {
                                crossings[r + crossingOffsetSouth] = newCrossingsSouth;
                                //console.log("crossings[" + (r + crossingOffsetSouth) + "] = " + newCrossingsSouth);
                            }
                            order[r] = newOrder;
                            for (let pos = 0; pos < order[r].length; ++pos) {
                                positions[r][order[r][pos]] = pos;
                            }
                        } else {
                            //console.log("not fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                        }
                    }
                }
                downward = !downward;
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
        }

        // create component graphs
        this._addGroupEdges();
        _.forEach(this._groupGraph.components(), (groupGraphComponent: Component<OrderGroup, Edge<any, any>>, i) => {
            /*if (i !== 4) {
                return;
            }*/
            //console.log("groupGraphComponent", _.cloneDeep(groupGraphComponent));
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
                    componentGraph.addEdge(edge);
                });
            });
            if (componentGraph.edges().length === 0) {
                // when there are no edges, no need to order
                return;
            }
            componentGraph._addGroupEdges();
            componentGraph._addRankEdges();

            // 1. order groups within ranks
            const auxGraph = new OrderGraph();
            const nodeMap = new Map();
            _.forEach(componentGraph._rankGraph.nodes(), (rank: OrderRank) => {
                const auxRank = new OrderRank(true);
                auxRank.order = [0];
                auxGraph.addRank(auxRank);
                const auxGroup = new OrderGroup(rank, rank.isFixed);
                auxRank.addGroup(auxGroup);
                _.forEach(rank.groups, group => {
                    const auxNode = new OrderNode(group);
                    nodeMap.set(group.id, auxGroup.addNode(auxNode));
                });
            });
            _.forEach(componentGraph.groupEdges(), edge => {
                auxGraph.addEdge(new Edge(nodeMap.get(edge.src), nodeMap.get(edge.dst), edge.weight));
            });
            auxGraph._addGroupEdges();
            auxGraph._addRankEdges();
            doOrder(auxGraph);
            _.forEach(auxGraph._groupGraph.nodes(), (auxGroup: OrderGroup) => {
                const rank = auxGroup.reference;
                rank.order = auxGroup.order;
                //console.log("new rank order", rank.order);
            });
            _.forEach(auxGraph._nodeGraph.nodes(), (auxNode: OrderNode) => {
                const group = auxNode.reference;
                group.position = auxNode.position;
            });
            // 2. order nodes within groups
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
        //console.log("countCrossings(", numNorth, numSouth, edges, ") = ", crossWeight);
        return crossWeight;
    }
}