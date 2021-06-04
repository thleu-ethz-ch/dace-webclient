/**
 * inspired by https://github.com/josdejong/workerpool
 */

export default class WorkerPool
{
    private _ready = true;
    private _workers = [];
    private _inUse = [];
    private _callbacks = [];
    private _queue = [];
    private _queuePointer = 0;

    constructor(workerPath: string, numWorkers: number) {
        for (let i = 0; i < numWorkers; ++i) {
            let tmpI = i;
            this._workers[i] = new Worker(workerPath);
            this._inUse[i] = false;
            this._workers[i].onmessage = e => {
                this._inUse[tmpI] = false;
                this._ready = true;
                this.tryDispatch();
                this._callbacks[e.data[0]](e.data[1]);
            }
        }
    }

    public tryDispatch() {
        if (!this._ready) {
            return;
        }
        if (this._queuePointer < this._queue.length) {
            const args = this._queue[this._queuePointer++];
            for (let i = 0; i < this._workers.length; ++i) {
                if (!this._inUse[i]) {
                    if (i === this._workers.length - 1) {
                        this._ready = false;
                    }
                    this._inUse[i] = true;
                    this._workers[i].postMessage(["exec", ...args]);
                    return;
                }
            }
            this.tryDispatch();
        }
    }

    public async exec(functionName, args: Array<any> = []) {
        function createPromise(promise: Promise<any>) {
            return new Promise(resolve => {
                promise.then((result) => resolve(result));
            });
        }
        const result = new Promise(resolve => {
            this._callbacks[this._queuePointer] = resolve;
        });
        this._queue.push([this._queuePointer, functionName, ...args]);
        this.tryDispatch();
        return await result;
    }

    public static async apply(functionName, args: Array<any> = []) {
        let context;
        if (typeof(window) !== "undefined") {
            context = window;
        } else{
            context = global;
        }
        return await context[functionName].apply(context, args);
    }

    public static async registerWorker() {
        let context;
        if (typeof(window) !== "undefined") {
            context = window;
        } else{
            context = global;
        }
        context.onmessage = async function(e) {
            if (e.data[0] === "exec") {
                context.taskId = e.data[1];
                const result = await WorkerPool.apply(e.data[2], e.data.slice(3));
                context.postMessage([context.taskId, result]);
            }
        }
    }
}
