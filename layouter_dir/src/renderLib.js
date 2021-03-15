module.exports = {
    layouter: {
        DagreLayouter: require('./layouter/dagreLayouter').default,
        DagreLayouterFast: require('./layouter/dagreLayouterFast').default,
        SugiyamaLayouter: require('./layouter/sugiyamaLayouter').default,
        MagneticSpringLayouter: require('./layouter/magneticSpringLayouter').default,
    },
    Renderer: require('./renderer/renderer').default,
};
