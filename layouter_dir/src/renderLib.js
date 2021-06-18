module.exports = {
    layouter: {
        DagreLayouter: require('./layouter/dagreLayouter').default,
        SugiyamaLayouter: require('./layouter/sugiyamaLayouter').default,
        MagneticSpringLayouter: require('./layouter/magneticSpringLayouter').default,
        HybridLayouter: require('./layouter/hybridLayouter').default,
    },
    Renderer: require('./renderer/renderer').default,
};
