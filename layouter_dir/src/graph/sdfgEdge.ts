import * as _ from "lodash";
import Connector from "./connector";
import Edge from "../layout/edge";
import Point from "../layout/point";
import SdfgGraph from "./sdfgGraph";
import Size from "../layout/size";
import Text from "../layout/text";
import Shape from "../layout/shape";
import Rectangle from "../layout/rectangle";
import SdfgState from "./sdfgState";
import Color from "../layout/color";

export default abstract class SdfgEdge {
    public static LABEL_FONT_SIZE = 10;

    public id: number = null;
    public graph: SdfgGraph = null;
    public src: number = null;
    public dst: number = null;
    public srcConnector: string = null;
    public dstConnector: string = null;
    public attributes: any = {};

    public x: number = null;
    public y: number = null;
    public width: number = null;
    public height: number = null;

    public labelX: number = null;
    public labelY: number = null;

    public points: Array<Point> = [];

    constructor(graph, src, dst, srcConnector, dstConnector, attributes) {
        this.graph = graph;
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = srcConnector || null;
        this.dstConnector = dstConnector || null;
        this.attributes = attributes;
    }

    boundingBox() {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, (point: Point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    updateBoundingBox(): void
    {
        const box = this.boundingBox();
        this.x = box.x;
        this.y = box.y;
        this.width = box.width;
        this.height = box.height;
    }

    offset(x: number, y: number): void
    {
        _.forEach(this.points, (point) => {
            point.x += x;
            point.y += y;
        });
        this.updateBoundingBox();
        if (this.labelX) {
            this.labelX += x;
            this.labelY += y;
        }
    }

    shapes(): Array<Shape> {
        this.matchEdgesToConnectors();
        const shapes: Array<Shape> = [new Edge(this, _.clone(this.points))];
        if (this.labelX) {
            const labelSize = this.labelSize();
            shapes.push(new Rectangle(null, this.labelX - 3, this.labelY - 3, labelSize.width + 6, labelSize.height + 6, new Color(255, 255, 255, 0.8), Color.TRANSPARENT));
            shapes.push(new Text(this.labelX, this.labelY, this.label(), SdfgEdge.LABEL_FONT_SIZE, 0x666666));
        }
        return shapes;
    }

    matchEdgesToConnectors(): void {
        if (this.srcConnector !== null) {
            const connector = this.graph.node(this.src).retrieveConnector("OUT", this.srcConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            position.y += Connector.DIAMETER;
            this.points[0] = position;
        }
        if (this.dstConnector !== null) {
            const connector = this.graph.node(this.dst).retrieveConnector("IN", this.dstConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            this.points[this.points.length - 1] = position;
        }
    }

    abstract label(): string;

    labelSize(): Size {
        const label = this.label();
        if (!label || label.length === 0) {
            return {
                width: 0,
                height: 0,
            };
        }
        const constructor = <typeof SdfgEdge>this.constructor;
        const box = (new Text(0, 0, label,  constructor.LABEL_FONT_SIZE)).boundingBox();
        return {
            width: box.width,
            height: box.height,
        }
    }

    protected sdfgPropertyToString(property: any): string
    {
        if (property === null) {
            return "";
        }
        if (typeof property === "boolean") {
            return property ? "True" : "False";
        } else if (property.type === "Indices" || property.type === "subsets.Indices") {
            let indices = property.indices;
            let preview = '[';
            for (let index of indices) {
                preview += this.sdfgPropertyToString(index) + ', ';
            }
            return preview.slice(0, -2) + ']';
        } else if (property.type === "Range" || property.type === "subsets.Range") {
            let ranges = property.ranges;

            // Generate string from range
            let preview = '[';
            for (let range of ranges) {
                preview += this.sdfgRangeToString(range) + ', ';
            }
            return preview.slice(0, -2) + ']';
        } else if (property.language !== undefined) {
            // Code
            if (property.string_data !== '' && property.string_data !== undefined && property.string_data !== null) {
                return '<pre class="code"><code>' + property.string_data.trim() +
                    '</code></pre><div class="clearfix"></div>';
            }
            return '';
        } else if (property.approx !== undefined && property.main !== undefined) {
            // SymExpr
            return property.main;
        } else if (property.constructor == Object) {
            // General dictionary
            return '<pre class="code"><code>' + JSON.stringify(property, undefined, 4) +
                '</code></pre><div class="clearfix"></div>';
        } else if (property.constructor == Array) {
            // General array
            let result = '[ ';
            let first = true;
            for (let subprop of property) {
                if (!first)
                    result += ', ';
                result += this.sdfgPropertyToString(subprop);
                first = false;
            }
            return result + ' ]';
        } else {
            return property;
        }
    }

    protected sdfgRangeToString(range) {
        let preview = '';
        if (range.start == range.end && range.step == 1 && range.tile == 1) {
            preview += this.sdfgPropertyToString(range.start);
        } else {
            let endp1 = this.sdfgPropertyToString(range.end) + ' + 1';
            // Try to simplify using math.js
            preview += this.sdfgPropertyToString(range.start) + ':' + endp1;

            if (range.step != 1) {
                preview += ':' + this.sdfgPropertyToString(range.step);
                if (range.tile != 1)
                    preview += ':' + this.sdfgPropertyToString(range.tile);
            } else if (range.tile != 1) {
                preview += '::' + this.sdfgPropertyToString(range.tile);
            }
        }
        return preview;
    }

};
