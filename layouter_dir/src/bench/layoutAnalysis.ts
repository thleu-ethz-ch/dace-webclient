import * as _ from "lodash";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutNode from "../layoutGraph/layoutNode";
import LayoutConnector from "../layoutGraph/layoutConnector";
import Segment from "../geometry/segment";

export default class LayoutAnalysis {
    private readonly _layoutGraph: LayoutGraph;
    private readonly _options: any;
    private readonly _nodes: Array<LayoutNode>;
    private readonly _edges: Array<LayoutEdge>;
    private readonly _segments: Array<Segment>;
    private readonly _nodeParents: Map<LayoutNode, Set<LayoutNode>>;
    private readonly _edgeParents: Map<LayoutEdge, Set<LayoutNode>>;

    constructor(layout: LayoutGraph, options: any = {}) {
        this._layoutGraph = layout;
        this._options = _.defaults(options, {
            targetEdgeLength: 50,
            weightBends: 0.2,
            weightCrossings: 1,
            weightLengths: 0.1,
        });
        this._nodes = this._layoutGraph.allNodes();
        this._edges = this._layoutGraph.allEdges();
        this._segments = _.flatMap(this._edges, (edge: LayoutEdge) => edge.segments());

        // precalculate all parents for nodes and edges
        this._nodeParents = new Map();
        _.forEach(this._nodes, (node: LayoutNode) => {
            const parents: Set<LayoutNode> = new Set();
            _.forEach(node.parents(), (parent: LayoutNode) => {
                parents.add(parent);
            });
            this._nodeParents.set(node, parents);
        });
        this._edgeParents = new Map();
        _.forEach(this._edges, (edge: LayoutEdge) => {
            const parents: Set<LayoutNode> = new Set();
            _.forEach(edge.parents(), (parent: LayoutNode) => {
                parents.add(parent);
            });
            this._edgeParents.set(edge, parents);
        });
    }

    segmentCrossings() {
        let counter = 0;
        for (let i = 0; i < this._segments.length; ++i) {
            for (let j = i + 1; j < this._segments.length; ++j) {
                if (this._segments[i].intersects(this._segments[j])) {
                    counter++;
                }
            }
        }
        return counter;
    }

    segmentCrossingsWithAngles() {
        let cost = 0;
        for (let i = 0; i < this._segments.length; ++i) {
            for (let j = i + 1; j < this._segments.length; ++j) {
                if (this._segments[i].intersects(this._segments[j])) {
                    cost += (1 + 1 - Math.sin(this._segments[i].vector().acuteAngleTo(this._segments[j].vector())));
                }
            }
        }
        return cost;
    }

    edgeLengths() {
        let cost = 0;
        _.forEach(this._edges, (edge: LayoutEdge) => {
            const edgeLength = _.sum(_.map(edge.segments(), segment => segment.length()));
            let factor = edgeLength / this._options.targetEdgeLength;
            cost += Math.max(factor, 1 / factor);
        });
        return cost;
    }

    checkUpwardFlow(): boolean {
        let hasUpwardFlow = false;
        _.forEach(this._edges, (edge: LayoutEdge) => {
            if (hasUpwardFlow) {
                return; // break not possible in forEach
            }
            if (!edge.graph.mayHaveCycles && edge.points[0].y > _.last(edge.points).y) {
                console.log("edge goes upwards", edge);
                hasUpwardFlow = true;
            }
        });
        return !hasUpwardFlow;
    }

    checkNodeOverlaps(): boolean {
        for (let i = 0; i < this._nodes.length; ++i) {
            const nodeA = this._nodes[i];
            for (let j = i + 1; j < this._nodes.length; ++j) {
                const nodeB = this._nodes[j];
                if (nodeA.boundingBox().intersects(nodeB.boundingBox()) && !this._nodesRelated(nodeA, nodeB)) {
                    console.log("two nodes overlap", nodeA, nodeB);
                    return false;
                }
            }
        }
        return true;
    }

    checkEdgeOverlaps(): boolean {
        for (let i = 0; i < this._edges.length; ++i) {
            const edge = this._edges[i];
            for (let j = 0; j < this._nodes.length; ++j) {
                const node = this._nodes[j];
                if (this._edgeIntersectsNode(edge, node) && !this._edgeParents.get(edge).has(node)) {
                    console.log("node overlaps edge", node, edge);
                    return false;
                }
            }
        }
        return true;
    }

    checkNodeContainment(): boolean {
        for (let i = 0; i < this._nodes.length; ++i) {
            const node = this._nodes[i];
            let contained = true;
            this._nodeParents.get(node).forEach((parent: LayoutNode) => {
                contained = contained && node.boundingBox().containedIn(parent.boundingBox())
            });
            if (!contained) {
                console.log("node not contained in parent", node);
                return false;
            }
        }
        return true;
    }

    checkEdgeContainment(): boolean {
        for (let i = 0; i < this._edges.length; ++i) {
            const edge = this._edges[i];
            let contained = true;
            this._edgeParents.get(edge).forEach((parent: LayoutNode) => {
                contained = contained && edge.boundingBox().containedIn(parent.boundingBox())
            });
            if (!contained) {
                console.log("edge not contained in parent", edge);
                return false;
            }
        }
        return true;
    }

    checkMapAlignment(): boolean {
        // gather all graphs
        const graphs = [];
        const addSubGraphs = (graph: LayoutGraph) => {
            graphs.push(graph);
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    addSubGraphs(node.childGraph);
                }
            })
        };
        addSubGraphs(this._layoutGraph);

        let aligned = true;
        _.forEach(graphs, (graph: LayoutGraph) => {
            if (!aligned) {
                return; // break not possible in forEach
            }
            if (graph.entryNode !== null && graph.exitNode !== null) {
                if (graph.entryNode.x !== graph.exitNode.x || graph.entryNode.width !== graph.exitNode.width) {
                    console.log("entry and exit node not aligned", graph.entryNode, graph.exitNode);
                    aligned = false;
                }
            }
        });
        return aligned;
    }

    checkConnectorAlignment(): boolean {
        let aligned = true;
        _.forEach(this._nodes, (node: LayoutNode) => {
            if (!aligned) {
                return; // break not possible in forEach
            }
            _.forEach(node.inConnectors, (inConnector: LayoutConnector) => {
                if (!aligned) {
                    return; // break not possible in forEach
                }
                if (inConnector.isScoped) {
                    const outConnector = node.connector("OUT", "OUT_" + inConnector.name.substr(3));
                    if (inConnector.x !== outConnector.x) {
                        console.log("IN connector and OUT connector not aligned", inConnector, outConnector);
                        aligned = false;
                    }
                }
            });
        });
        return aligned;
    }

    validate(): boolean {
        return (
            this.checkUpwardFlow() &&
            this.checkNodeOverlaps() &&
            this.checkEdgeOverlaps() &&
            this.checkNodeContainment() &&
            this.checkEdgeContainment() &&
            this.checkMapAlignment() &&
            this.checkConnectorAlignment()
        );
    }

    bends() {
        return this._segments.length - this._edges.length;
    }

    cost(breakdown: boolean = false) {
        const weightedCrossings = this._options.weightCrossings * this.segmentCrossingsWithAngles();
        const weightedBends = this._options.weightBends * this.bends();
        const weightedLengths = this._options.weightLengths * this.edgeLengths();
        if (breakdown) {
            console.log("Crossings: " + this._options.weightCrossings + " * " + this.segmentCrossingsWithAngles().toFixed(2) + " = " + weightedCrossings.toFixed(2));
            console.log("Bends: " + this._options.weightBends + " * " + this.bends().toFixed(2) + " = " + weightedBends.toFixed(2));
            console.log("Lengths: " + this._options.weightLengths + " * " + this.edgeLengths().toFixed(2) + " = " + weightedLengths.toFixed(2));
        }
        return weightedCrossings + weightedBends + weightedLengths;
    }

    private _edgeIntersectsNode(edge: LayoutEdge, node: LayoutNode) {
        const nodeBox = node.boundingBox();
        if (!edge.boundingBox().intersects(nodeBox)) {
            return false;
        }
        let intersects = false;
        _.forEach(edge.segments(), (segment: Segment) => {
            intersects = intersects || segment.intersectsBox(nodeBox);
        });
        return intersects;
    }

    private _nodesRelated(nodeA: LayoutNode, nodeB: LayoutNode) {
        return this._nodeParents.get(nodeA).has(nodeB) || this._nodeParents.get(nodeB).has(nodeA);
    }
}