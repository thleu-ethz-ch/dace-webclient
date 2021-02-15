import SdfgGraph from "./sdfgGraph";
import Group from "../layout/group";
import Size from "../layout/size";
import Shape from "../layout/shape";
import * as _ from "lodash";
import Connector from "./connector";
import LayoutUtil from "../layouter/layoutUtil";
import Position from "../layout/position";
import Ellipse from "../layout/ellipse";
import PlaceHolder from "../layout/placeHolder";
import Text from "../layout/text";

export default abstract class SdfgNode {
    public static LABEL_PADDING_X = 10;
    public static LABEL_PADDING_Y = 10;
    public static LABEL_FONT_SIZE = 12;

    public readonly id: number = null;
    public scopeEntry: number = null;
    public inConnectors: Array<Connector> = [];
    public outConnectors: Array<Connector> = [];

    protected _childLayout: Group = null;
    protected _label: string = null;
    protected _labelSize: Size = null;

    constructor(jsonNode) {
        this._label = jsonNode.label;
        this.id = parseInt(jsonNode.id);
    }

    /**
     * Places the scoped connectors in the middle and the unscoped evenly on both sides.
     * @param inConnectors
     * @param outConnectors
     */
    setConnectors(inConnectors, outConnectors) {
        const inConnectorsScoped = [];
        const inConnectorsUnscoped = [];
        const outConnectorsScoped = [];
        const outConnectorsUnscoped = [];
        _.forEach(inConnectors, (data, id) => {
            const isScoped = id.startsWith('IN_') && outConnectors.hasOwnProperty('OUT_' + id.substr(3));
            (isScoped ? inConnectorsScoped : inConnectorsUnscoped).push(new Connector(id));
        });
        _.forEach(outConnectors, (data, id) => {
            const isScoped = id.startsWith('OUT_') && inConnectors.hasOwnProperty('IN_' + id.substr(4));
            (isScoped ? outConnectorsScoped : outConnectorsUnscoped).push(new Connector(id));
        });
        const hasMoreInThanOut = inConnectors.length > outConnectors.length ? 1 : 0;
        const hasMoreOutThanIn = outConnectors.length > inConnectors.length ? 1 : 0;
        for (let i = 0; i < inConnectorsUnscoped.length; ++i) {
            const isLeft = i < (inConnectorsUnscoped.length - hasMoreInThanOut) / 2;
            this.inConnectors[i + (isLeft ? 0 : inConnectorsScoped.length)] = inConnectorsUnscoped[i];
        }
        let offset = Math.ceil((inConnectorsUnscoped.length - hasMoreInThanOut) / 2);
        for (let i = 0; i < inConnectorsScoped.length; ++i) {
            this.inConnectors[i + offset] = inConnectorsScoped[i];
        }
        for (let i = 0; i < outConnectorsUnscoped.length; ++i) {
            let isLeft = i < (outConnectorsUnscoped.length - hasMoreOutThanIn) / 2;
            this.outConnectors[i + (isLeft ? 0 : outConnectorsScoped.length)] = outConnectorsUnscoped[i];
        }
        offset = Math.ceil((outConnectorsUnscoped.length - hasMoreOutThanIn) / 2);
        for (let i = 0; i < outConnectorsScoped.length; ++i) {
            this.outConnectors[i + offset] = outConnectorsScoped[i];
        }
    }

    setScopeEntry(entryId) {
        if (entryId !== null) {
            this.scopeEntry = parseInt(entryId);
        }
    }

    abstract shape(x: number, y: number): Shape;

    childGraph(): SdfgGraph {
        return null;
    }

    childLayout(nodeId: number): Group {
        return null;
    }

    size(): Size {
        return {
            width: 0,
            height: 0,
        };
    }

    /**
     * Calculates the size of the label including some padding.
     */
    labelSize(): Size {
        if (this._labelSize === null && this._label !== null) {
            const constructor = <typeof SdfgNode>this.constructor;
            const box = (new Text(0, 0, this._label,  constructor.LABEL_FONT_SIZE)).boundingBox();
            this._labelSize =  {
                width: box.width + 2 * constructor.LABEL_PADDING_X,
                height: box.height + 2 * constructor.LABEL_PADDING_Y,
            }
        }
        return this._labelSize;
    }

    /**
     * Adds an offset to center the label within the node (if necessary).
     */
    labelPosition(): Position {
        const constructor = <typeof SdfgNode>this.constructor;
        const labelBox = {
            x: constructor.LABEL_PADDING_X,
            y: constructor.LABEL_PADDING_Y,
            width: this.labelSize().width,
            height: this.labelSize().height,
        };
        return LayoutUtil.addPadding(labelBox, this.size());
    }

    /**
     * Calculates the width to fit both the in-connectors and out-connectors including some padding.
     */
    connectorsWidth(): number {
        const numConnectors = Math.max(this.inConnectors.length, this.outConnectors.length);
        return numConnectors * Connector.WIDTH + (numConnectors - 1) * Connector.MARGIN + 2 * Connector.PADDING;
    }

    connectorShapes(x: number, y: number): Array<Shape> {
        const connectorDifference = this.inConnectors.length - this.outConnectors.length;
        const shapes = [];

        // create group of in-connectors if necessary
        if (this.inConnectors.length > 0) {
            const inConnectors = new Group(x, y - Connector.WIDTH / 2);
            _.forEach(this.inConnectors, (connector, i) => {
                const circle = new Ellipse((Connector.WIDTH + Connector.MARGIN) * i, 0, Connector.WIDTH, Connector.WIDTH);
                circle.reference = connector;
                inConnectors.addElement(circle);
                connector.shape = circle;
            });
            if (connectorDifference % 2 === -1) {
                const placeholder = new PlaceHolder((Connector.WIDTH + Connector.MARGIN) * this.inConnectors.length, 0, Connector.WIDTH, Connector.WIDTH)
                inConnectors.addElement(placeholder);
            }
            inConnectors.offset(LayoutUtil.calculatePaddingX(inConnectors.boundingBox(), this.size()), 0);
            shapes.push(inConnectors);
        }

        // create group of out-connectors if necessary
        if (this.outConnectors.length > 0) {
            const outConnectors = new Group(x, y + this.size().height - Connector.WIDTH / 2);
            _.forEach(this.outConnectors, (connector, i) => {
                const circle = new Ellipse((Connector.WIDTH + Connector.MARGIN) * i, 0, Connector.WIDTH, Connector.WIDTH);
                circle.reference = connector;
                outConnectors.addElement(circle);
                connector.shape = circle;
            });
            if (connectorDifference % 2 === 1) {
                const placeholder = new PlaceHolder((Connector.WIDTH + Connector.MARGIN) * this.outConnectors.length, 0, Connector.WIDTH, Connector.WIDTH)
                outConnectors.addElement(placeholder);
            }
            outConnectors.offset(LayoutUtil.calculatePaddingX(outConnectors.boundingBox(), this.size()), 0);
            shapes.push(outConnectors);
        }

        return shapes;
    }

    retrieveConnector(type: "IN" | "OUT", id: string): Connector {
        const connectors = (type === "IN" ? this.inConnectors : this.outConnectors);
        let match = null;
        _.forEach(connectors, (connector) => {
            if (connector.id === id) {
                match = connector;
            }
        });
        return match;
    }
}
