module.exports = {
    layouter: {
        DagreLayouter: require('./layouter/dagreLayouter').default,
        SugiyamaLayouter: require('./layouter/sugiyamaLayouter').default,
        MagneticSpringLayouter: require('./layouter/magneticSpringLayouter').default,
        HybridLayouter: require('./layouter/hybridLayouter').default,
    },
    renderer: {
        PixiRenderer: require('./renderer/pixiRenderer').default,
        SvgRenderer: require('./renderer/svgRenderer').default,
    }
};
