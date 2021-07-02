import {DEBUG, EPSILON} from "../util/constants";
import * as _ from "lodash";
import Assert from "../util/assert";
import Box from "../geometry/box";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import RecursiveLayouter from "./recursiveLayouter";
import Shuffle from "../util/shuffle";
import Vector from "../geometry/vector";

export default class MagneticSpringLayouter extends RecursiveLayouter {
    constructor(options: object = {}) {
        super();
        this._options = _.defaults(options, this._options, {
            numIterations: 0,
            stepSize: 1,
            weightSpring: 1,
            weightRepulsive: 1,
            weightMagnetic: 10,
            magneticStrength: 1,
            distanceExponent: 1,
            angleExponent: 1,
            decay: 0.999,
        });
    }

    layoutSizedGraph(graph: LayoutGraph) {
        //console.log(graph);
        switch (graph.nodes().length) {
            case 1:
                // just one node => place it anywhere
                graph.nodes()[0].updatePosition(new Vector());
                break;

            case 2:
                // two nodes => place them above each other
                const topIndex = Math.round(Math.random());
                const topNode = graph.nodes()[topIndex];
                const bottomNode = graph.nodes()[1 - topIndex];
                topNode.updatePosition(new Vector(-topNode.width / 2, -topNode.height / 2));
                bottomNode.updatePosition(new Vector(-bottomNode.width / 2, topNode.height / 2 + this._options.targetEdgeLength));
                break;

            default:
                // more nodes => place them on a circle
                let chordLengthSum = graph.nodes().length * this._options.targetEdgeLength
                const nodeDiagonals = [];
                _.forEach(graph.nodes(), (node) => {
                    nodeDiagonals[node.id] = Math.sqrt(node.width * node.width + node.height * node.height);
                    chordLengthSum += nodeDiagonals[node.id];
                });
                // go from sum of chord lengths to sum of arc lengths, assuming maximal angle (2π/3)
                const circumference = chordLengthSum * Math.PI / 2;
                const diameter = circumference / Math.PI;
                const radius = diameter / 2;
                let angle = 0;
                const shuffledNodes = Shuffle.shuffle(graph.nodes());
                _.forEach(shuffledNodes, (node, i) => {
                    const center = new Vector(radius * Math.sin(angle), radius * Math.cos(angle));
                    const topLeft = new Vector(center.x - node.width / 2, center.y - node.height / 2);
                    node.updatePosition(topLeft);
                    if (i < graph.nodes().length - 1) {
                        angle += 2 * Math.asin((this._options.targetEdgeLength + nodeDiagonals[node.id] / 2 + nodeDiagonals[shuffledNodes[i + 1].id] / 2) / diameter);
                    }
                });
        }

        // precompute set of neighbors and non-neighbors
        const neighbors = new Array(graph.maxId() + 1);
        const nonNeighbors = new Array(graph.maxId() + 1);
        const forces = new Array(graph.maxId() + 1);
        _.forEach(graph.nodes(), (node) => {
            neighbors[node.id] = new Set();
            nonNeighbors[node.id] = new Set();
        });
        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            if (edge.src !== edge.dst) {
                neighbors[edge.src].add(graph.node(edge.dst));
            }
        });
        _.forEach(graph.nodes(), (nodeA) => {
            _.forEach(graph.nodes(), (nodeB) => {
                if (nodeA !== nodeB && !neighbors[nodeA.id].has(nodeB) && !neighbors[nodeB.id].has(nodeA)) {
                    nonNeighbors[nodeA.id].add(nodeB);
                }
            });
        });

        function xIntersection(src: Vector, dst: Vector, srcToDst: Vector, x: number): Vector {
            if (DEBUG) {
                Assert.assert(srcToDst.x !== 0, "x intersection with vertical line");
            }
            if (Math.sign(dst.x - src.x) === Math.sign(x - dst.x)) {
                return null;
            }
            return srcToDst.clone().setX(x - src.x).add(src);
        }

        function yIntersection(src: Vector, dst: Vector, srcToDst: Vector, y: number): Vector {
            if (DEBUG) {
                Assert.assert(srcToDst.y !== 0, "y intersection with horizontal line");
            }
            if (Math.sign(dst.y - src.y) === Math.sign(y - dst.y)) {
                return null;
            }
            return srcToDst.clone().setY(y - src.y).add(src);
        }

        function boxIntersection(srcCenter: Vector, dst: Vector, srcBox: Box): Vector {
            const vector = dst.clone().sub(srcCenter);
            const angle = vector.angle();
            if ((angle < srcBox.bottomRight().sub(srcCenter).angle()) || (angle > srcBox.topRight().sub(srcCenter).angle())) {
                return xIntersection(srcCenter, dst, vector, srcBox.x + srcBox.width);
            } else if (angle > srcBox.topLeft().sub(srcCenter).angle()) {
                return yIntersection(srcCenter, dst, vector, srcBox.y);
            } else if (angle > srcBox.bottomLeft().sub(srcCenter).angle()) {
                return xIntersection(srcCenter, dst, vector, srcBox.x);
            } else {
                return yIntersection(srcCenter, dst, vector,srcBox.y + srcBox.height);
            }
        }

        function distanceVector(srcNode: LayoutNode, dstNode: LayoutNode) {
            const srcBox = srcNode.boundingBox();
            const dstBox = dstNode.boundingBox();
            const srcCenter = srcBox.center();
            const dstCenter = dstBox.center();
            if (srcBox.intersects(dstBox)) {
                return dstCenter.clone().sub(srcCenter).setLength(0.001);
            }
            /*const srcBorder = boxIntersection(srcCenter.clone(), dstCenter.clone(), srcBox);
            const dstBorder = boxIntersection(dstCenter.clone(), srcCenter.clone(), dstBox);
            return dstBorder.sub(srcBorder);*/
            const srcToDst = dstCenter.sub(srcCenter);
            const x = Math.max(0, Math.abs(srcToDst.x) - (srcNode.width + dstNode.width) / 2);
            const y = Math.max(0, Math.abs(srcToDst.y) - (srcNode.height + dstNode.height) / 2);
            return srcToDst.setLength((new Vector(x, y)).length());
        }

        function edgeDistanceVector(srcNode: LayoutNode, dstNode: LayoutNode) {
            const src = srcNode.boundingBox().bottomCenter();
            const dst = dstNode.boundingBox().topCenter();
            return dst.sub(src);
        }

        const fieldVector = new Vector(0, 1);

        for (let iteration = 0; iteration < this._options.numIterations; ++iteration) {
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                forces[node.id] = new Vector();
            });
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                neighbors[node.id].forEach((neighbor: LayoutNode) => {
                    // spring force
                    const edgeVector = edgeDistanceVector(node, neighbor);
                    const strength = Math.log(edgeVector.length() / this._options.targetEdgeLength);
                    const springForce = edgeVector.clone().normalize().multiplyScalar(strength * this._options.weightSpring);
                    forces[node.id].add(springForce);
                    forces[neighbor.id].add(springForce.clone().invert());
                    /*if (iteration === this._options.numIterations - 1) {
                        console.log(node.label(), "spring induced by", neighbor.label(), springForce);
                        console.log(neighbor.label(), "spring induced by", node.label(), springForce.invert());
                    }*/
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
                    forces[neighbor.id].add(magneticForce);
                    forces[node.id].add(magneticForce.clone().invert());
                    /*if (iteration === this._options.numIterations - 1) {
                        console.log("angleFactor", angleFactor, "distanceFactor", distanceFactor);
                        console.log(neighbor.label(), "magnetic induced by", node.label(), magneticForce);
                        console.log(node.label(), "magnetic induced by", neighbor.label(), magneticForce.invert());
                    }*/
                });
                nonNeighbors[node.id].forEach((nonNeighbor: LayoutNode) => {
                    // repulsive force
                    const edgeVector = distanceVector(node, nonNeighbor);
                    const length = edgeVector.length();
                    const relativeLength = 2 * length / this._options.targetEdgeLength;
                    const strength = 1 / (relativeLength * relativeLength)
                    const repulsiveForce = edgeVector.clone().normalize().multiplyScalar(strength * this._options.weightRepulsive);
                    forces[nonNeighbor.id].add(repulsiveForce);
                    /*if (iteration === this._options.numIterations - 1) {
                        console.log(nonNeighbor.label(), "repulsive induced by", node.label(), repulsiveForce);
                    }*/
                });
            });
            // apply forces altogether after calculating them
            let maxOffset = 0;
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                const offset = forces[node.id].multiplyScalar(this._options.stepSize);
                if (offset.length() > this._options.targetEdgeLength) {
                    offset.setLength(this._options.targetEdgeLength);
                }
                offset.multiplyScalar(Math.pow(this._options.decay, iteration))
                maxOffset = Math.max(maxOffset, offset.length());
                node.translate(offset.x, offset.y);
            });
            if (maxOffset < EPSILON) {
                console.log("reached equilibrium after " + (iteration + 1) + " iterations");
                break;
            }
        }

        // place edges
        _.forEach(graph.edges(), (edge: LayoutEdge) => {
            const srcNode = graph.node(edge.src);
            const srcPoint = new Vector(srcNode.x + srcNode.width / 2, srcNode.y + srcNode.height);
            const dstNode = graph.node(edge.dst);
            const dstPoint = new Vector(dstNode.x + dstNode.width / 2, dstNode.y);
            edge.points = [srcPoint, dstPoint];
        });
    }
}
