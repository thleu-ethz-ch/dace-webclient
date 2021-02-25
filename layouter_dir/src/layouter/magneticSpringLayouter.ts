import * as _ from "lodash";
import RecursiveLayouter from "./recursiveLayouter";
import SdfgGraph from "../graph/sdfgGraph";
import LayoutUtil from "./layoutUtil";
import SdfgNode from "../graph/sdfgNode";

export default class MagneticSpringLayouter extends RecursiveLayouter {
    public static TARGET_EDGE_LENGTH = 50;
    public static NUM_ITERATIONS = 100;
    public static STEP_SIZE = 0.1;
    public static SPRING_WEIGHT = 1;
    public static REPULSIVE_WEIGHT = 1;
    public static MAGNETIC_WEIGHT = 1;

    layoutSizedGraph(graph: SdfgGraph, withLabels) {
        switch (graph.nodes().length) {
            case 1:
                // just one node => place it anywhere
                graph.nodes()[0].setPosition({x: 0, y: 0});
                break;

            case 2:
                // two nodes => place them above each other
                const topIndex = Math.round(Math.random());
                const topNode = graph.nodes()[topIndex];
                const bottomNode = graph.nodes()[1 - topIndex];
                topNode.setPosition({
                    x: -topNode.width / 2,
                    y: -topNode.height / 2
                });
                bottomNode.setPosition({
                    x: -bottomNode.width / 2,
                    y: topNode.height / 2 + MagneticSpringLayouter.TARGET_EDGE_LENGTH,
                });
                break;

            default:
                // more nodes => place them on a circle
                const sToC = 2 / 3 * Math.PI / Math.sqrt(3);
                let circumference = graph.nodes().length * MagneticSpringLayouter.TARGET_EDGE_LENGTH;
                const nodeDiagonals = [];
                _.forEach(graph.nodes(), (node) => {
                    nodeDiagonals[node.id] = Math.sqrt(node.width * node.width + node.height * node.height);
                    circumference += nodeDiagonals[node.id];
                });
                circumference *= sToC;
                const diameter = circumference / Math.PI;
                const radius = diameter / 2;
                let angle = 0;
                const shuffledNodes = _.shuffle(graph.nodes());
                _.forEach(shuffledNodes, (node, i) => {
                    const center = {
                        x: radius * Math.sin(angle),
                        y: radius * Math.cos(angle),
                    };
                    const topLeft = {
                        x: center.x - node.width / 2,
                        y: center.y - node.height / 2,
                    }
                    node.setPosition(topLeft);
                    if (i < graph.nodes().length - 1) {
                        angle += 2 * Math.asin((MagneticSpringLayouter.TARGET_EDGE_LENGTH + nodeDiagonals[node.id] / 2 + nodeDiagonals[shuffledNodes[i + 1].id] / 2) / diameter);
                    }
                });
        }

        // precompute set of neighbors and non-neighbors
        const neighbors = [];
        const nonNeighbors = [];
        _.forEach(graph.nodes(), (nodeA) => {
            neighbors[nodeA.id] = new Set();
            nonNeighbors[nodeA.id] = new Set();
            _.forEach(graph.outEdges(nodeA.id), (edgeId) => {
                const dst = graph.edge(edgeId).dst;
                if (dst !== nodeA.id) {
                    neighbors[nodeA.id].add(dst);
                }
            });
            _.forEach(graph.inEdges(nodeA.id), (edgeId) => {
                const src = graph.edge(edgeId).src;
                if (src !== nodeA.id) {
                    neighbors[nodeA.id].add(src);
                }
            });
            _.forEach(graph.nodes(), (nodeB) => {
                if (nodeA.id !== nodeB.id && !neighbors[nodeA.id].has(nodeB.id)) {
                    nonNeighbors[nodeA.id].add(nodeB.id);
                }
            });
        });

        function distanceVector(srcNode: SdfgNode, dstNode: SdfgNode) {
            const srcPoint = {x: srcNode.x + srcNode.width / 2, y: srcNode.y + srcNode.height}
            const dstPoint = {x: dstNode.x + dstNode.width / 2, y: dstNode.y};
            return LayoutUtil.subtract(dstPoint, srcPoint);
        }


        for (let iteration = 0; iteration < MagneticSpringLayouter.NUM_ITERATIONS; ++iteration) {
            _.forEach(graph.nodes(), (node) => {
                let springForce = {x: 0, y: 0};
                let repulsiveForce = {x: 0, y: 0};
                neighbors[node.id].forEach(neighbor => {
                    const distanceVec = distanceVector(node, graph.node(neighbor));
                    const normalized = LayoutUtil.normalizeVector(distanceVec);
                    const strength =  Math.log(LayoutUtil.vectorLength(distanceVec) / MagneticSpringLayouter.TARGET_EDGE_LENGTH);
                    springForce = LayoutUtil.add(springForce, LayoutUtil.scaleVector(strength, normalized));
                });
                nonNeighbors[node.id].forEach(nonNeighbor => {
                    const distanceVec = distanceVector(node, graph.node(nonNeighbor));
                    const normalized = LayoutUtil.normalizeVector(distanceVec);
                    const length = LayoutUtil.vectorLength(distanceVec);
                    const strength = (1 / length * length);
                    repulsiveForce = LayoutUtil.add(springForce, LayoutUtil.scaleVector(strength, normalized));
                });
                let force = LayoutUtil.scaleVector(MagneticSpringLayouter.SPRING_WEIGHT, springForce);
                force = LayoutUtil.add(force, LayoutUtil.scaleVector(MagneticSpringLayouter.REPULSIVE_WEIGHT, repulsiveForce));
                const offset = LayoutUtil.scaleVector(MagneticSpringLayouter.STEP_SIZE, force);
                node.offset(offset.x, offset.y);
            });
        }

        // place edges
        _.forEach(graph.edges(), (edge) => {
            const srcNode = graph.node(edge.src);
            const srcPoint = {x: srcNode.x + srcNode.width / 2, y: srcNode.y + srcNode.height};
            const dstNode = graph.node(edge.dst);
            const dstPoint = {x: dstNode.x + dstNode.width / 2, y: dstNode.y};
            edge.points = [srcPoint, dstPoint];
            edge.updateBoundingBox();
        });
    }
}