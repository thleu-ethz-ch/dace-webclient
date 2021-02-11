const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/sdfg.js',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        library: 'sdfg',
        filename: 'sdfg.js',
        path: path.resolve(__dirname, 'dist'),
    },
};