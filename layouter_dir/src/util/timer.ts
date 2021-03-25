export default class Timer
{
    private static _timers: Map<string, [number, number]> = new Map();

    public static start(name: string) {
        let sum = 0;
        const timer =  Timer._timers.get(name);
        if (timer !== undefined) {
            if (timer[1] !== null) {
                return;
            }
            sum = timer[0];
        }
        Timer._timers.set(name, [sum, Date.now()])
    }

    public static stop(name: string) {
        const time = Date.now();
        const timer = Timer._timers.get(name);
        timer[0] += time - timer[1];
        timer[1] = null;
    }

    public static printTimes(): void {
        Timer._timers.forEach(([sum, start], name) => {
            const timeString = (sum > 1000 ? ((sum / 1000).toFixed(3) + " s") : (sum + " ms"));
            console.log(name, timeString);
        });
    }
}