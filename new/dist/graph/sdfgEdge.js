var SdfgEdge = /** @class */ (function () {
    function SdfgEdge(src, dst, metadata) {
        this.id = null;
        this.src = null;
        this.dst = null;
        this.srcConnector = null;
        this.dstConnector = null;
        this.metadata = {};
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = metadata.src_connector || null;
        this.dstConnector = metadata.dst_connector || null;
        this.metadata = metadata;
    }
    return SdfgEdge;
}());
export default SdfgEdge;
//# sourceMappingURL=sdfgEdge.js.map