import * as _ from "lodash";
import Connector from "./connector";
import Ellipse from "../layout/ellipse";
import LayoutUtil from "../layouter/layoutUtil";
import Text from "../layout/text";
var SdfgNode = /** @class */ (function () {
    function SdfgNode(id, graph, label) {
        if (graph === void 0) { graph = null; }
        if (label === void 0) { label = null; }
        this.id = null;
        this.graph = null;
        this.inConnectors = [];
        this.outConnectors = [];
        this.scopeEntry = null;
        this.x = null;
        this.y = null;
        this.width = null;
        this.height = null;
        this.childGraph = null;
        this._label = null;
        this._labelSize = null;
        this._label = label;
        this.id = id;
        this.graph = graph;
        if (this._label !== null) {
            var labelSize = this.labelSize();
            this.width = labelSize.width;
            this.height = labelSize.height;
        }
    }
    SdfgNode.prototype.setChildGraph = function (childGraph) {
        this.childGraph = childGraph;
    };
    /**
     * Places the scoped connectors in the middle and the unscoped evenly on both sides.
     * @param inConnectors
     * @param outConnectors
     */
    SdfgNode.prototype.setConnectors = function (inConnectors, outConnectors) {
        var inConnectorsScoped = [];
        var inConnectorsUnscoped = [];
        var outConnectorsScoped = [];
        var outConnectorsUnscoped = [];
        _.forEach(inConnectors, function (data, id) {
            var isScoped = id.startsWith('IN_') && outConnectors.hasOwnProperty('OUT_' + id.substr(3));
            (isScoped ? inConnectorsScoped : inConnectorsUnscoped).push(new Connector(id));
        });
        _.forEach(outConnectors, function (data, id) {
            var isScoped = id.startsWith('OUT_') && inConnectors.hasOwnProperty('IN_' + id.substr(4));
            (isScoped ? outConnectorsScoped : outConnectorsUnscoped).push(new Connector(id));
        });
        var hasMoreInThanOut = inConnectors.length > outConnectors.length ? 1 : 0;
        var hasMoreOutThanIn = outConnectors.length > inConnectors.length ? 1 : 0;
        for (var i = 0; i < inConnectorsUnscoped.length; ++i) {
            var isLeft = i < (inConnectorsUnscoped.length - hasMoreInThanOut) / 2;
            this.inConnectors[i + (isLeft ? 0 : inConnectorsScoped.length)] = inConnectorsUnscoped[i];
        }
        var offset = Math.ceil((inConnectorsUnscoped.length - hasMoreInThanOut) / 2);
        for (var i = 0; i < inConnectorsScoped.length; ++i) {
            this.inConnectors[i + offset] = inConnectorsScoped[i];
        }
        for (var i = 0; i < outConnectorsUnscoped.length; ++i) {
            var isLeft = i < (outConnectorsUnscoped.length - hasMoreOutThanIn) / 2;
            this.outConnectors[i + (isLeft ? 0 : outConnectorsScoped.length)] = outConnectorsUnscoped[i];
        }
        offset = Math.ceil((outConnectorsUnscoped.length - hasMoreOutThanIn) / 2);
        for (var i = 0; i < outConnectorsScoped.length; ++i) {
            this.outConnectors[i + offset] = outConnectorsScoped[i];
        }
        // update width
        this.width = Math.max(this.width, this.connectorsWidth());
    };
    SdfgNode.prototype.setPosition = function (position) {
        var prevX = this.x || 0;
        var prevY = this.y || 0;
        var offsetX = position.x - prevX;
        var offsetY = position.y - prevY;
        this.x = position.x;
        this.y = position.y;
        if (this.childGraph !== null) {
            this.childGraph.offsetChildren(offsetX, offsetY);
        }
    };
    SdfgNode.prototype.setSize = function (size) {
        this.width = size.width;
        this.height = size.height;
    };
    SdfgNode.prototype.setWidth = function (width) {
        this.width = width;
    };
    SdfgNode.prototype.offset = function (x, y) {
        this.x += x;
        this.y += y;
        if (this.childGraph !== null) {
            this.childGraph.offsetChildren(x, y);
        }
    };
    SdfgNode.prototype.size = function () {
        return {
            width: this.width,
            height: this.height,
        };
    };
    SdfgNode.prototype.boundingBox = function () {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        };
    };
    /**
     * Calculates the size of the label including some padding.
     */
    SdfgNode.prototype.labelSize = function () {
        if (this._labelSize === null && this._label !== null) {
            var constructor = this.constructor;
            var box = (new Text(0, 0, this._label, constructor.LABEL_FONT_SIZE)).boundingBox();
            this._labelSize = {
                width: box.width + 2 * constructor.LABEL_PADDING_X,
                height: box.height + 2 * constructor.LABEL_PADDING_Y,
            };
        }
        return this._labelSize;
    };
    /**
     * Adds an offset to center the label within the node (if necessary).
     */
    SdfgNode.prototype.labelPosition = function () {
        var constructor = this.constructor;
        var labelBox = {
            x: this.x + constructor.LABEL_PADDING_X,
            y: this.y + constructor.LABEL_PADDING_Y,
            width: this.labelSize().width,
            height: this.labelSize().height,
        };
        return LayoutUtil.addPadding(labelBox, this.size());
    };
    /**
     * Calculates the width to fit both the in-connectors and out-connectors including some padding.
     */
    SdfgNode.prototype.connectorsWidth = function () {
        var numConnectors = Math.max(this.inConnectors.length, this.outConnectors.length);
        return numConnectors * Connector.DIAMETER + (numConnectors - 1) * Connector.MARGIN + 2 * Connector.PADDING;
    };
    SdfgNode.prototype.connectorShapes = function () {
        var connectorDifference = this.inConnectors.length - this.outConnectors.length;
        var shapes = [];
        // add in-connectors
        if (this.inConnectors.length > 0) {
            var inConnectorsWidth = this.inConnectors.length * Connector.DIAMETER + (this.inConnectors.length - 1) * Connector.MARGIN;
            if (connectorDifference % 2 === -1) {
                inConnectorsWidth += Connector.DIAMETER + Connector.MARGIN;
            }
            var firstX_1 = this.x + (this.width - inConnectorsWidth) / 2;
            var y_1 = this.y - Connector.DIAMETER / 2;
            _.forEach(this.inConnectors, function (connector, i) {
                var circle = new Ellipse(connector, firstX_1 + (Connector.DIAMETER + Connector.MARGIN) * i, y_1, Connector.DIAMETER, Connector.DIAMETER);
                connector.shape = circle;
                shapes.push(circle);
            });
        }
        // add out-connectors
        if (this.outConnectors.length > 0) {
            var outConnectorsWidth = this.outConnectors.length * Connector.DIAMETER + (this.outConnectors.length - 1) * Connector.MARGIN;
            if (connectorDifference % 2 === 1) {
                outConnectorsWidth += Connector.DIAMETER + Connector.MARGIN;
            }
            var firstX_2 = this.x + (this.width - outConnectorsWidth) / 2;
            var y_2 = this.y + this.height - Connector.DIAMETER / 2;
            _.forEach(this.outConnectors, function (connector, i) {
                var circle = new Ellipse(connector, firstX_2 + (Connector.DIAMETER + Connector.MARGIN) * i, y_2, Connector.DIAMETER, Connector.DIAMETER);
                connector.shape = circle;
                shapes.push(circle);
            });
        }
        return shapes;
    };
    SdfgNode.prototype.retrieveConnector = function (type, id) {
        var connectors = (type === "IN" ? this.inConnectors : this.outConnectors);
        var match = null;
        _.forEach(connectors, function (connector) {
            if (connector.id === id) {
                match = connector;
            }
        });
        return match;
    };
    SdfgNode.prototype.childGraphShapes = function () {
        var shapes = [];
        if (this.childGraph !== null) {
            _.forEach(this.childGraph.shapes(), function (shape) {
                shapes.push(shape);
            });
        }
        return shapes;
    };
    SdfgNode.prototype.shapes = function () {
        return _.concat(this.childGraphShapes(), this.connectorShapes());
    };
    SdfgNode.CHILD_PADDING = 0;
    SdfgNode.LABEL_PADDING_X = 10;
    SdfgNode.LABEL_PADDING_Y = 10;
    SdfgNode.LABEL_FONT_SIZE = 12;
    return SdfgNode;
}());
export default SdfgNode;
//# sourceMappingURL=sdfgNode.js.map