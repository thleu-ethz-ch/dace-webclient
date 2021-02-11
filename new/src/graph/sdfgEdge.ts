export default class SdfgEdge
{
    public src: number;
    public dst: number;
    public metadata: object;

    constructor(src: number, dst: number, metadata: object) {
        this.src = src;
        this.dst = dst;
        this.metadata = metadata;
    }
}
