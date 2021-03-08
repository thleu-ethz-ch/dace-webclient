import * as _ from "lodash";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderEdge from "./orderEdge";
import OrderNode from "./orderNode";

export default class OrderGraph {
    private _levelGraph: Graph<OrderGroup, OrderEdge>;
    private _edgeGraph: Graph<OrderNode, OrderEdge>;

    constructor() {
        this._levelGraph = new Graph<OrderGroup, OrderEdge>();
        this._edgeGraph = new Graph<OrderNode, OrderEdge>();
    }

    public addGroup(group: OrderGroup) {
        group.orderGraph = this;
        return this._levelGraph.addNode(group);
    }

    public addNode(node: OrderNode) {
        return this._edgeGraph.addNode(node);
    }

    public addEdge(orderEdge: OrderEdge) {
        if (orderEdge.type === "GROUP") {
            return this._levelGraph.addEdge(orderEdge);
        } else {
            return this._edgeGraph.addEdge(orderEdge);
        }
    }

    public node(id: number) {
        return this._edgeGraph.node(id);
    }

    public group(id: number) {
        return this._levelGraph.node(id);
    }

    public nodes() {
        return this._edgeGraph.nodes();
    }

    public groups() {
        return this._levelGraph.nodes();
    }

    public edges() {
        return this._edgeGraph.edges();
    }

    public groupEdges() {
        return this._levelGraph.edges();
    }

    public sourceGroups(): Array<OrderGroup> {
        return this._levelGraph.sources();
    }

    public sinkGroups(): Array<OrderGroup> {
        return this._levelGraph.sinks();
    }

    public components(): Array<OrderGraph> {
        const components = [];
        _.forEach(this._levelGraph.components(), (groupGraph: Graph<OrderGroup, OrderEdge>) => {
            const component = new OrderGraph();
            component._levelGraph = groupGraph;
            const groups = groupGraph.nodes();
            _.forEach(groups, (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode) => {
                    node.group = group;
                    component._edgeGraph.addNode(_.clone(node), node.id);
                });
            });
            _.forEach(groups, (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode) => {
                    _.forEach(this._edgeGraph.outEdges(node.id), (edge: OrderEdge) => {
                        component._edgeGraph.addEdge(_.clone(edge), edge.id);
                    });
                });
            });
            components.push(component);
        });
        return components;
    }

    public order(downward: boolean = true): void {
        const levels = this._levelGraph.toposort();
        if (!levels[0].isFixed) {
            downward = false;
        }
        const nodeIndexes = [];
        const neighborsDown = [];
        const neighborsUp = [];
        const order = []; // current order of this level (e. g. 2, 0, 1)
        const positions = []; // inverse of order (e. g. 1, 2, 0)
        const crossings = []; // number of crossings above each level

        _.forEach(levels, (group: OrderGroup, level: number) => {
            nodeIndexes[level] = [];
            neighborsDown[level] = [];
            neighborsUp[level] = [];
            crossings[level] = Number.POSITIVE_INFINITY;
            _.forEach(group.nodes, (node: OrderNode, i: number) => {
                nodeIndexes[level][node.id] = i;
            });
            order[level] = _.range(group.nodes.length);
            positions[level] = _.clone(order[level]);
        });
        // set neighbors
        _.forEach(levels, (group: OrderGroup, level: number) => {
            _.forEach(group.nodes, (node: OrderNode, pos: number) => {
                neighborsDown[level][pos] = [];
                neighborsUp[level][pos] = [];
                _.forEach(this._edgeGraph.outEdges(node.id), (edge: OrderEdge) => {
                    neighborsDown[level][pos].push(nodeIndexes[level + 1][edge.dst]);
                });
                _.forEach(this._edgeGraph.inEdges(node.id), (edge: OrderEdge) => {
                    neighborsUp[level][pos].push(nodeIndexes[level - 1][edge.src]);
                });
            });
        });

        let hasImproved = true;
        while (hasImproved) {
            hasImproved = false;
            let firstLevel = downward ? 1 : levels.length - 2;
            let lastLevel = downward ? levels.length - 1 : 0;
            const direction = downward ? 1 : -1;
            const neighbors = downward ? neighborsUp : neighborsDown;
            for (let level = firstLevel; level - direction !== lastLevel; level += direction) {
                if (levels[level].isFixed) {
                    continue;
                }
                const neighborLevel = level - direction;
                // calculate mean position of neighbors
                const nodeMeans = [];
                for (let node = 0; node < order[level].length; ++node) {
                    let sum = 0;
                    for (let neighbor = 0; neighbor < neighbors[level][node].length; ++neighbor) {
                        sum += positions[neighborLevel][neighbors[level][node][neighbor]];
                    }
                    nodeMeans.push([node, sum / neighbors[level][node].length]);
                }
                // sort by the means
                const newOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                if (!_.isEqual(newOrder, order[level]) || crossings[level] === Number.POSITIVE_INFINITY) {
                    // count crossings with new order
                    const edges = [];
                    for (let pos = 0; pos < order[level].length; ++pos) {
                        for (let neighbor = 0; neighbor < neighbors[level][newOrder[pos]].length; ++neighbor) {
                            edges.push([
                                positions[neighborLevel][neighbors[level][newOrder[pos]][neighbor]],
                                newOrder[pos],
                            ]);
                        }
                    }
                    const newCrossings = this._countCrossings(order[neighborLevel].length, order[level].length, edges);
                    if (newCrossings < crossings[level]) {
                        hasImproved = true;
                        crossings[level] = newCrossings;
                        order[level] = newOrder;
                        for (let pos = 0; pos < order[level].length; ++pos) {
                            positions[level][order[level][pos]] = pos;
                        }
                    }
                }
            }
            downward = !downward;
        }
        _.forEach(levels, (group: OrderGroup, level: number) => {
            group.order = order[level];
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
    private _countCrossings(numNorth: number, numSouth: number, edges: Array<[number, number]>): number {
        // build south sequence
        const southSequence = _.map(_.sortBy(edges, edge => edge[0] * numNorth + edge[1]), edge => edge[1]);

        // build the accumulator tree
        let firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        const treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        const tree = _.fill(new Array(treeSize), 0);

        // count the crossings
        let count = 0;
        _.forEach(southSequence, (i: number) => {
            let index = i + firstIndex;
            tree[index]++;
            while (index > 0) {
                if (index % 2) {
                    count += tree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                tree[index]++;
            }
        });
        return count;
    }


}