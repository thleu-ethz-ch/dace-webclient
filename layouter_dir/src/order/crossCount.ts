import * as _ from "lodash";
import {GPU} from "gpu.js";

export class CrossCount {
    static pipeline = null;

    static buildGraph(n: number, density: number = 0.1) {
        const edges = [];
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                if (Math.random() < density) {
                    edges.push([i, j]);
                }
            }
        }
        return edges;
    }

    static countEfficient(numNorth: number, numSouth: number, edges: Array<[number, number]>): number {
        // build south sequence
        const southSequence = _.map(_.sortBy(edges, edge => edge[0] * numSouth + edge[1]), edge => edge[1]);

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

    static initGpu() {
        const gpu = new GPU();

        CrossCount.pipeline = [
            // take row-wise cumulative sum
            gpu.createKernel(function (adjacencyMatrix) {
                const outputX = this.output.x;
                let sum = 0;
                for (let j = this.thread.x + 1; j < outputX; ++j) {
                    sum += adjacencyMatrix[this.thread.y][j];
                }
                return sum;
            }, {
                dynamicArguments: true,
                dynamicOutput: true,
                pipeline: true,
            }),

            // take column-wise cumulative sum
            gpu.createKernel(function (rowSums) {
                let sum = 0;
                for (let i = 0; i < this.thread.y; ++i) {
                    sum += rowSums[i][this.thread.x];
                }
                return sum;
            }, {
                dynamicArguments: true,
                dynamicOutput: true,
                pipeline: true,
            }),

            // hadamard product (adjacency matrix acts as a mask)
            gpu.createKernel(function (columnSums, adjacencyMatrix) {
                return columnSums[this.thread.y][this.thread.x] * adjacencyMatrix[this.thread.y][this.thread.x];
            }, {
                dynamicArguments: true,
                dynamicOutput: true,
                pipeline: true,
            }),

            // row-wise sum
            gpu.createKernel(function (matrix) {
                const outputX = this.output.x;
                let sum = 0;
                for (let j = 0; j < outputX; ++j) {
                    sum += matrix[this.thread.x][j];
                }
                return sum;
            }, {
                dynamicArguments: true,
                dynamicOutput: true
            }),
        ];
    }

    static countGpu(numNorth: number, numSouth: number, edges: Array<[number, number]>) {
        if (CrossCount.pipeline === null) {
            throw new Error("Must call initGpu() before calling countGpu().");
        }

        const adjacencyMatrixSize = [numSouth, numNorth];
        CrossCount.pipeline[0].setOutput(adjacencyMatrixSize);
        CrossCount.pipeline[1].setOutput(adjacencyMatrixSize);
        CrossCount.pipeline[2].setOutput(adjacencyMatrixSize);
        CrossCount.pipeline[3].setOutput([numNorth]);

        // build matrix
        const adjacencyMatrix = [];
        for (let i = 0; i < numNorth; ++i) {
            adjacencyMatrix.push(new Uint8Array(numSouth));
        }
        _.forEach(edges, edge => {
            adjacencyMatrix[edge[0]][edge[1]] = 1;
        });

        // execute pipeline
        const rowSums = CrossCount.pipeline[0](adjacencyMatrix);
        const columnSums = CrossCount.pipeline[1](rowSums);
        const product = CrossCount.pipeline[2](columnSums, adjacencyMatrix);
        const sums = CrossCount.pipeline[3](product);
        return _.sum(sums);
    }
}