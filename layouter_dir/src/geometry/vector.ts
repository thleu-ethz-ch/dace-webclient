export default class Vector {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    clone() {
        return new Vector(this.x, this.y);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    angle(): number {
        return Math.atan2(this.y, this.x);
    }

    normalize() {
        const length = this.length();
        this.x /= length;
        this.y /= length;
        return this;
    }

    angleTo(otherVector: Vector) {
        return otherVector.angle() - this.angle();
    }

    acuteAngleTo(otherVector: Vector) {
        const angle = this.angleTo(otherVector);
        return Math.min(angle, Math.PI - angle);
    }

    multiplyScalar(scalar: number): Vector {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    add(otherVector: Vector) {
        this.x += otherVector.x;
        this.y += otherVector.y;
        return this;
    }

    sub(otherVector: Vector) {
        this.x -= otherVector.x;
        this.y -= otherVector.y;
        return this;
    }
}
