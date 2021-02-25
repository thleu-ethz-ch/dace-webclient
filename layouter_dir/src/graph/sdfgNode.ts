import * as _ from "lodash";
import Connector from "./connector";
import Ellipse from "../layout/ellipse";
import LayoutUtil from "../layouter/layoutUtil";
import Point from "../layout/point";
import SdfgGraph from "./sdfgGraph";
import Shape from "../layout/shape";
import Size from "../layout/size";
import Text from "../layout/text";

export default abstract class SdfgNode {
    public static CHILD_PADDING = 0;
    public static LABEL_PADDING_X = 10;
    public static LABEL_PADDING_Y = 10;
    public static LABEL_FONT_SIZE = 12;

    public id: number = null;
    public graph: SdfgGraph = null;
    public inConnectors: Array<Connector> = [];
    public outConnectors: Array<Connector> = [];
    public scopeEntry: number = null;

    public x: number = null;
    public y: number = null;
    public width: number = null;
    public height: number = null;

    public childGraph: SdfgGraph = null;
    public isCollapsed: boolean = false;

    protected _label: string = null;
    protected _labelSize: Size = null;

    constructor(id: number, graph: SdfgGraph = null, label: string = null) {
        this._label = label;
        this.id = id;
        this.graph = graph;
        if (this._label !== null) {
            const labelSize = this.labelSize();
            this.width = labelSize.width
            this.height = labelSize.height;
        }
    }

    setChildGraph(childGraph: SdfgGraph) {
        this.childGraph = childGraph;
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

        // update width
        this.width = Math.max(this.width, this.connectorsWidth());
    }

    setPosition(position: Point) {
        const prevX = this.x || 0;
        const prevY = this.y || 0;
        const offsetX = position.x - prevX;
        const offsetY = position.y - prevY;
        this.x = position.x;
        this.y = position.y;
        if (this.childGraph !== null) {
            this.childGraph.offsetChildren(offsetX, offsetY);
        }
    }

    setSize(size: Size) {
        this.width = size.width;
        this.height = size.height;
    }

    setWidth(width: number) {
        this.width = width;
    }

    offset(x: number, y: number) {
        this.x += x;
        this.y += y;
        if (this.childGraph !== null) {
            this.childGraph.offsetChildren(x, y);
        }
    }

    size(): Size {
        return {
            width: this.width,
            height: this.height,
        };
    }

    boundingBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
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
    labelPosition(): Point {
        const constructor = <typeof SdfgNode>this.constructor;
        const labelBox = {
            x: this.x + constructor.LABEL_PADDING_X,
            y: this.y + constructor.LABEL_PADDING_Y,
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
        return numConnectors * Connector.DIAMETER + (numConnectors - 1) * Connector.MARGIN + 2 * Connector.PADDING;
    }

    connectorShapes(): Array<Shape> {
        const connectorDifference = this.inConnectors.length - this.outConnectors.length;
        const shapes = [];

        // add in-connectors
        if (this.inConnectors.length > 0) {
            let inConnectorsWidth = this.inConnectors.length * Connector.DIAMETER + (this.inConnectors.length - 1) * Connector.MARGIN;
            if (connectorDifference % 2 === -1) {
                inConnectorsWidth += Connector.DIAMETER + Connector.MARGIN;
            }
            const firstX = this.x + (this.width - inConnectorsWidth) / 2;
            const y = this.y - Connector.DIAMETER / 2;
            _.forEach(this.inConnectors, (connector, i) => {
                const circle = new Ellipse(connector, firstX + (Connector.DIAMETER + Connector.MARGIN) * i, y, Connector.DIAMETER, Connector.DIAMETER);
                connector.shape = circle;
                shapes.push(circle);
            });
        }

        // add out-connectors
        if (this.outConnectors.length > 0) {
            let outConnectorsWidth = this.outConnectors.length * Connector.DIAMETER + (this.outConnectors.length - 1) * Connector.MARGIN;
            if (connectorDifference % 2 === 1) {
                outConnectorsWidth += Connector.DIAMETER + Connector.MARGIN;
            }
            const firstX = this.x + (this.width - outConnectorsWidth) / 2;
            const y = this.y + this.height - Connector.DIAMETER / 2;
            _.forEach(this.outConnectors, (connector, i) => {
                const circle = new Ellipse(connector, firstX + (Connector.DIAMETER + Connector.MARGIN) * i, y, Connector.DIAMETER, Connector.DIAMETER);
                connector.shape = circle;
                shapes.push(circle);
            });
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

    childGraphShapes(): Array<Shape> {
        const shapes = [];
        if (this.childGraph !== null) {
            _.forEach(this.childGraph.shapes(), (shape: Shape) => {
                shapes.push(shape);
            });
        }
        return shapes;
    }

    shapes(): Array<Shape> {
        return _.concat(this.childGraphShapes(), this.connectorShapes());
    }
}
