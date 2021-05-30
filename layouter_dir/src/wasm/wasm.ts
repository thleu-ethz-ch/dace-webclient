import {Module} from "../../wasm/reorder";
import * as _ from "lodash";
import OrderRank from "../order/orderRank";
import Assert from "../util/assert";

export default class Wasm
{
    moduleReady: boolean = false;
    waiting: Array<(bool) => void> = [];

    constructor() {
        Module.onRuntimeInitialized = () => {
            this.moduleReady = true;
            _.forEach(this.waiting, (resolve) => {
                resolve(true);
            });
        }
        Module.run();
    }

    async waitUntilReady(): Promise<void> {
        if (!this.moduleReady) {
            await new Promise((resolve: (bool) => void) => {
                this.waiting.push(resolve);
            });
        }
        return Promise.resolve();
    }

    async reorder(order: Array<Array<number>>, neighborsDown: Array<Array<Array<number>>>, weightsDown: Array<Array<Array<number>>>): Promise<void> {
        await this.waitUntilReady();
        let pointer = 0;
        const heap = Module["HEAP32"];
        let numNodes = 0;
        for (let r = 0; r < order.length; ++r) {
            heap[pointer++] = order[r].length;
            numNodes += order[r].length;
            _.forEach(order[r], (n: number) => {
                heap[pointer++] = n;
            });
        }
        let numEdges = 0;
        for (let r = 0; r < order.length - 1; ++r) {
            heap[pointer] = _.sum(_.map(neighborsDown[r], "length"));
            numEdges += heap[pointer++];
            _.forEach(neighborsDown[r], (neighbors: Array<number>, from: number) => {
                _.forEach(neighbors, (to: number, i: number) => {
                    let weight = weightsDown[r][from][i];
                    if (weight === Number.POSITIVE_INFINITY) {
                        weight = 1;
                    }
                    heap[pointer++] = from;
                    heap[pointer++] = to;
                    heap[pointer++] = weight;
                });
            });
        }
        //console.log(order.length + "," + numNodes + "," + numEdges + "," + _.slice(heap, 0, pointer).toString());
        //if (order.length === 65) {
            //this.download("test.txt", order.length + "," + numNodes + "," + numEdges + "," + _.slice(heap, 0, pointer).toString())
        //}
        //let start = Date.now();
        Module._reorder(order.length, numNodes, numEdges, heap.byteOffset);
        //let end = Date.now();
        //console.log("binary", end - start);
        pointer = 0;
        for (let r = 0; r < order.length; ++r) {
            for (let pos = 0; pos < order[r].length; ++pos) {
                order[r][pos] = heap[pointer++];
            }
        }
    }

    download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

}
