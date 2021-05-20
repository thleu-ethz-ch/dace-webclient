import {Module} from "../../wasm/countCrossings";
import * as _ from "lodash";

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

    async countCrossings(numNorth: number, numSouth: number, edges: Array<[number, number, number]>): Promise<number> {
        await this.waitUntilReady();
        const wasmEdges = Module["HEAPU32"];
        _.forEach(edges, ([northPos, southPos, weight]: [number, number, number], i: number) => {
            wasmEdges[3 * i] = northPos;
            wasmEdges[3 * i + 1] = southPos;
            wasmEdges[3 * i + 2] = weight;
        });
        return Module._countCrossings(numNorth, numSouth, edges.length, wasmEdges);
    }
}
