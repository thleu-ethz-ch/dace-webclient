export default class SdfgEdge
{
    public id: number = null;
    public src: number = null;
    public dst: number = null;
    public srcConnector: string = null;
    public dstConnector: string = null;
    public metadata = {};

    constructor(src, dst, metadata) {
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = metadata.src_connector || null;
        this.dstConnector = metadata.dst_connector || null;
        this.metadata = metadata;
    }
}
