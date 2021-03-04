module.exports = {
    Bench: require('./bench/bench').default,
    Loader: require('./parse/loader').default,
    Parser: require('./parse/parser').default,
    RenderGraph: require('./renderGraph/renderGraph').default,
    layouter: {
        DagreLayouter: require('./layouter/dagreLayouter').default,
        DagreLayouterFast: require('./layouter/dagreLayouterFast').default,
        MagneticSpringLayouter: require('./layouter/magneticSpringLayouter').default,
    },
};
