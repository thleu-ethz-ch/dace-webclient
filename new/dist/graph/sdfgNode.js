import Group from "../layout/group";
import * as _ from "lodash";
import Connector from "./connector";
import LayoutUtil from "../layouter/layoutUtil";
import Ellipse from "../layout/ellipse";
import PlaceHolder from "../layout/placeHolder";
import Text from "../layout/text";
var SdfgNode = /** @class */ (function () {
    function SdfgNode(jsonNode) {
        this.id = null;
        this.scopeEntry = null;
        this.inConnectors = [];
        this.outConnectors = [];
        this._childGraph = null;
        this._childGraphSize = null;
        this._childGraphLayout = null;
        this._label = null;
        this._labelSize = null;
        this._label = jsonNode.label;
        this.id = parseInt(jsonNode.id);
    }
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
    };
    SdfgNode.prototype.setScopeEntry = function (entryId) {
        if (entryId !== null) {
            this.scopeEntry = parseInt(entryId);
        }
    };
    SdfgNode.prototype.childGraph = function () {
        return this._childGraph;
    };
    SdfgNode.prototype.size = function () {
        return {
            width: 0,
            height: 0,
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
            x: constructor.LABEL_PADDING_X,
            y: constructor.LABEL_PADDING_Y,
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
        return numConnectors * Connector.WIDTH + (numConnectors - 1) * Connector.MARGIN + 2 * Connector.PADDING;
    };
    SdfgNode.prototype.connectorShapes = function (x, y) {
        var connectorDifference = this.inConnectors.length - this.outConnectors.length;
        var shapes = [];
        // create group of in-connectors if necessary
        if (this.inConnectors.length > 0) {
            var inConnectors_1 = new Group(x, y - Connector.WIDTH / 2);
            _.forEach(this.inConnectors, function (connector, i) {
                var circle = new Ellipse((Connector.WIDTH + Connector.MARGIN) * i, 0, Connector.WIDTH, Connector.WIDTH);
                circle.reference = connector;
                inConnectors_1.addElement(circle);
                connector.shape = circle;
            });
            if (connectorDifference % 2 === -1) {
                var placeholder = new PlaceHolder((Connector.WIDTH + Connector.MARGIN) * this.inConnectors.length, 0, Connector.WIDTH, Connector.WIDTH);
                inConnectors_1.addElement(placeholder);
            }
            inConnectors_1.offset(LayoutUtil.calculatePaddingX(inConnectors_1.boundingBox(), this.size()), 0);
            shapes.push(inConnectors_1);
        }
        // create group of out-connectors if necessary
        if (this.outConnectors.length > 0) {
            var outConnectors_1 = new Group(x, y + this.size().height - Connector.WIDTH / 2);
            _.forEach(this.outConnectors, function (connector, i) {
                var circle = new Ellipse((Connector.WIDTH + Connector.MARGIN) * i, 0, Connector.WIDTH, Connector.WIDTH);
                circle.reference = connector;
                outConnectors_1.addElement(circle);
                connector.shape = circle;
            });
            if (connectorDifference % 2 === 1) {
                var placeholder = new PlaceHolder((Connector.WIDTH + Connector.MARGIN) * this.outConnectors.length, 0, Connector.WIDTH, Connector.WIDTH);
                outConnectors_1.addElement(placeholder);
            }
            outConnectors_1.offset(LayoutUtil.calculatePaddingX(outConnectors_1.boundingBox(), this.size()), 0);
            shapes.push(outConnectors_1);
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
    SdfgNode.prototype.setChildGraphSize = function (size) {
        this._childGraphSize = _.clone(size);
    };
    SdfgNode.prototype.setChildGraphLayout = function (layout) {
        this._childGraphLayout = _.clone(layout);
    };
    SdfgNode.CHILD_PADDING = 0;
    SdfgNode.LABEL_PADDING_X = 10;
    SdfgNode.LABEL_PADDING_Y = 10;
    SdfgNode.LABEL_FONT_SIZE = 12;
    return SdfgNode;
}());
export default SdfgNode;
//# sourceMappingURL=sdfgNode.js.map