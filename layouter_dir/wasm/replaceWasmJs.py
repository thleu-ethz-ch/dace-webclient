with open('countCrossings.js', 'r') as reader:
    content = reader.read()
    replacements = {
        'if(ENVIRONMENT_IS_NODE)': 'if(false)',
        'if (ENVIRONMENT_IS_NODE)': 'if (false)',
        'var wasmBinaryFile="countCrossings.wasm";': 'var wasmBinaryFile="../wasm/countCrossings.wasm";',
        'var wasmBinaryFile = \'countCrossings.wasm\';': 'var wasmBinaryFile = \'../wasm/countCrossings.wasm\';',
    }
    for key, value in replacements.items():
        content = content.replace(key, value)

    content += 'export {Module};'

    with open('reorder.js', 'w') as writer:
        writer.write(content)


