export default class Color
{
    public static TRANSPARENT = new Color(0, 0, 0, 0);

    public red: number = 0;
    public green: number = 0;
    public blue: number = 0;
    public alpha: number = 1;

    constructor(red: number, green: number, blue: number, alpha: number = 1) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }

    hex() {
        return 65536 * this.red + 256 * this.green + this.blue;
    }

    fade(alpha: number) {
        return new Color(this.red, this.green, this.blue, alpha);
    }
}