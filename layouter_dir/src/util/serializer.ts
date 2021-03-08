export default class Serializer
{
    static repeatFunction(fun, times, wait: number, foldFun: (prev: any, current: typeof prev) => typeof prev, foldNeutral: any) {
        const createRun = (run, prev, resolve) => {
            return new Promise(resolve => setTimeout(resolve, wait)).then(() => {
                const current = fun();
                const next = foldFun(prev, current);
                if (run < times) {
                    return createRun(run + 1, next, resolve);
                }
                return resolve(next);
            });
        };
        return new Promise(resolve => createRun(1, foldNeutral, resolve));
    }
}