/**
 * Inspired by https://github.com/mrdoob/three.js/
 */
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
        return (Math.atan2(this.y, this.x) + 2 * Math.PI) % (2 * Math.PI);
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

    absoluteAngleTo(otherVector: Vector) {
        return Math.abs(this.angleTo(otherVector));
    }

    acuteAngleTo(otherVector: Vector) {
        const absAngle = this.absoluteAngleTo(otherVector);
        return Math.min(absAngle, Math.PI - absAngle);
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
